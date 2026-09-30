-- Studio Funnel · texting, alerts, follow-ups, push notifications
-- Run after 0001_init.sql.
--
-- What this adds
--  * studios.messaging   Owner-editable texting + alert settings (not public).
--  * leads.phone_e164    Normalised phone, used to match incoming texts/calls to leads.
--  * messages            Two-way SMS thread per lead.
--  * followups           Automatic follow-up sequence per lead.
--  * opt_outs            Numbers that texted STOP (never text them again).
--  * push_subscriptions  Owner devices that receive new-lead push notifications.
--  * new-lead trigger    Calls the on-new-lead function (alerts + instant reply).

-- ---------------------------------------------------------------- settings on the studio
alter table public.studios add column if not exists messaging jsonb not null default '{}'::jsonb;
grant select (messaging) on public.studios to authenticated;
grant update (messaging) on public.studios to authenticated;

-- ---------------------------------------------------------------- phone normalisation (US/Canada)
create or replace function public.to_e164(p text)
returns text
language sql immutable
as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) = 10 then '+1' || regexp_replace(p, '\D', '', 'g')
    when length(regexp_replace(p, '\D', '', 'g')) = 11 and left(regexp_replace(p, '\D', '', 'g'), 1) = '1' then '+' || regexp_replace(p, '\D', '', 'g')
    when left(trim(p), 1) = '+' then '+' || regexp_replace(p, '\D', '', 'g')
    else null
  end;
$$;

alter table public.leads add column if not exists phone_e164 text generated always as (public.to_e164(phone)) stored;
alter table public.leads add column if not exists has_unread boolean not null default false;
alter table public.leads add column if not exists last_message_at timestamptz;
create index if not exists leads_studio_phone on public.leads (studio_id, phone_e164);

-- ---------------------------------------------------------------- messages
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null references public.studios(id) on delete cascade,
  lead_id      uuid references public.leads(id) on delete cascade,
  direction    text not null check (direction in ('out', 'in')),
  body         text not null check (char_length(body) <= 1600),
  status       text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'received', 'blocked')),
  sent_by      text,             -- 'auto', 'followup', or the sender's user id
  provider_id  text,             -- Twilio message SID
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists messages_lead on public.messages (lead_id, created_at);

-- ---------------------------------------------------------------- follow-ups
create table if not exists public.followups (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null references public.studios(id) on delete cascade,
  lead_id      uuid not null unique references public.leads(id) on delete cascade,
  step         int not null default 0,            -- index of the next step to send
  next_at      timestamptz,
  status       text not null default 'active' check (status in ('active', 'stopped', 'done')),
  stop_reason  text,
  created_at   timestamptz not null default now()
);
create index if not exists followups_due on public.followups (status, next_at);

-- ---------------------------------------------------------------- opt-outs (STOP)
create table if not exists public.opt_outs (
  studio_id   uuid not null references public.studios(id) on delete cascade,
  phone_e164  text not null,
  created_at  timestamptz not null default now(),
  primary key (studio_id, phone_e164)
);

-- ---------------------------------------------------------------- push subscriptions
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- row-level security
alter table public.messages           enable row level security;
alter table public.followups          enable row level security;
alter table public.opt_outs           enable row level security;
alter table public.push_subscriptions enable row level security;

-- Owners read threads; sending goes through the send-sms function (service role).
create policy "members read messages"  on public.messages  for select to authenticated using (public.is_member(studio_id));
create policy "members read followups" on public.followups for select to authenticated using (public.is_member(studio_id));
create policy "members stop followups" on public.followups for update to authenticated using (public.is_member(studio_id)) with check (public.is_member(studio_id) and status in ('active', 'stopped'));
create policy "members read opt-outs"  on public.opt_outs  for select to authenticated using (public.is_member(studio_id));

create policy "own push subs read"   on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own push subs add"    on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid() and public.is_member(studio_id));
create policy "own push subs remove" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

revoke all on public.messages, public.followups, public.opt_outs from anon;
revoke all on public.push_subscriptions from anon;
revoke insert, delete on public.messages from authenticated;
revoke insert, delete on public.followups from authenticated;
revoke insert, update, delete on public.opt_outs from authenticated;

-- ---------------------------------------------------------------- public: is texting switched on?
-- The studio page uses this to decide whether it can promise "check your texts".
create or replace function public.get_public_studio(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', id, 'slug', slug, 'config', config,
    'texting', coalesce(nullif(messaging->>'twilioNumber', ''), null) is not null and coalesce((messaging->>'autoReply')::boolean, true)
  )
  from public.studios where slug = p_slug;
$$;

-- ---------------------------------------------------------------- owner: intake key for Zapier / Make / ManyChat
create or replace function public.get_ingest_key(p_studio uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select ingest_key from public.studios where id = p_studio and public.is_member(p_studio);
$$;
revoke all on function public.get_ingest_key(uuid) from public, anon;
grant execute on function public.get_ingest_key(uuid) to authenticated;

-- ---------------------------------------------------------------- new-lead trigger → on-new-lead function
-- Private settings, never exposed through the API. Fill in after deploying functions:
--   insert into private.config (key, value) values
--     ('functions_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('hook_secret',   '<same value as the HOOK_SECRET function secret>');
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.config (key text primary key, value text not null);

create or replace function private.notify_new_lead()
returns trigger
language plpgsql security definer set search_path = public, private
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.config where key = 'functions_url';
  select value into v_secret from private.config where key = 'hook_secret';
  if v_url is null or v_secret is null or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return new;
  end if;
  begin
    perform net.http_post(
      url     := v_url || '/on-new-lead',
      body    := jsonb_build_object('lead_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret)
    );
  exception when others then
    -- Never block a lead from being saved because an alert failed.
    raise warning 'notify_new_lead failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists leads_notify_new on public.leads;
create trigger leads_notify_new after insert on public.leads for each row execute function private.notify_new_lead();

-- Follow-ups stop by themselves once a lead is booked or marked not interested.
create or replace function private.stop_followups_on_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('booked', 'lost') and old.status is distinct from new.status then
    update public.followups set status = 'stopped', stop_reason = 'status: ' || new.status
    where lead_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;
drop trigger if exists leads_stop_followups on public.leads;
create trigger leads_stop_followups after update of status on public.leads for each row execute function private.stop_followups_on_status();

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.messages, public.followups;

-- ---------------------------------------------------------------- scheduled follow-ups (run in the SQL editor once pg_cron and pg_net are enabled)
-- select cron.schedule('studio-followups', '*/10 * * * *', $$
--   select net.http_post(
--     url := (select value from private.config where key = 'functions_url') || '/run-followups',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', (select value from private.config where key = 'hook_secret')),
--     body := '{}'::jsonb)
-- $$);