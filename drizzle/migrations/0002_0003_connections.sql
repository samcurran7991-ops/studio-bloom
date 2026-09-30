-- Studio Funnel · one-tap account connections (Instagram, Meta ads, Google Business Profile)
-- Run after 0002_messaging.sql.
--
-- What this adds
--  * connections          One row per studio + provider: status and public details (no secrets). Owners can read it.
--  * connection_secrets   Access / refresh tokens. Only the server functions (service role) can read it.
--  * oauth_states         Short-lived "who started this login" records for the connect flow.
--  * leads                Instagram leads may have no phone yet: phone becomes optional, plus ig_user_id / ig_username.
--  * messages.channel     'sms' or 'instagram', so Instagram DMs live in the same thread as texts.

-- ---------------------------------------------------------------- connections (visible to the studio's members)
create table if not exists public.connections (
  studio_id     uuid not null references public.studios(id) on delete cascade,
  provider      text not null check (provider in ('instagram', 'meta', 'google')),
  status        text not null default 'connected' check (status in ('connected', 'needs_attention', 'disconnected')),
  account_name  text,
  external_ids  text[] not null default '{}',   -- page ids / Instagram account id, used to route webhooks
  details       jsonb not null default '{}'::jsonb,
  error         text,
  connected_by  uuid references auth.users(id) on delete set null,
  connected_at  timestamptz not null default now(),
  last_event_at timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (studio_id, provider)
);
create index if not exists connections_external on public.connections using gin (external_ids);

-- ---------------------------------------------------------------- secrets (server only)
create table if not exists public.connection_secrets (
  studio_id      uuid not null references public.studios(id) on delete cascade,
  provider       text not null,
  access_token   text,
  refresh_token  text,
  page_tokens    jsonb not null default '{}'::jsonb,   -- Meta: { "<page id>": "<page token>" }
  expires_at     timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (studio_id, provider)
);

create table if not exists public.oauth_states (
  state       text primary key,
  studio_id   uuid not null references public.studios(id) on delete cascade,
  user_id     uuid not null,
  provider    text not null,
  return_to   text not null default '/dashboard/connections',
  created_at  timestamptz not null default now()
);

alter table public.connections        enable row level security;
alter table public.connection_secrets enable row level security;
alter table public.oauth_states       enable row level security;

create policy "members read connections" on public.connections for select to authenticated using (public.is_member(studio_id));
revoke all on public.connections from anon;
revoke insert, update, delete on public.connections from authenticated;
-- No policies at all on these two: nobody but the service role can touch them.
revoke all on public.connection_secrets, public.oauth_states from anon, authenticated;

-- Owners disconnect through this function (it also wipes the tokens).
create or replace function public.disconnect_account(p_studio uuid, p_provider text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_member(p_studio) then raise exception 'Not allowed'; end if;
  delete from public.connection_secrets where studio_id = p_studio and provider = p_provider;
  update public.connections set status = 'disconnected', error = null, external_ids = '{}', updated_at = now()
  where studio_id = p_studio and provider = p_provider;
end;
$$;
revoke all on function public.disconnect_account(uuid, text) from public, anon;
grant execute on function public.disconnect_account(uuid, text) to authenticated;

-- ---------------------------------------------------------------- Instagram leads
alter table public.leads alter column phone drop not null;
alter table public.leads drop constraint if exists leads_phone_check;
alter table public.leads add constraint leads_phone_check check (phone is null or char_length(phone) between 3 and 40);
alter table public.leads add column if not exists ig_user_id text;
alter table public.leads add column if not exists ig_username text;
create index if not exists leads_studio_ig on public.leads (studio_id, ig_user_id);

alter table public.messages add column if not exists channel text not null default 'sms';
alter table public.messages drop constraint if exists messages_channel_check;
alter table public.messages add constraint messages_channel_check check (channel in ('sms', 'instagram'));

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.connections;

-- ---------------------------------------------------------------- daily token refresh (run once pg_cron + pg_net are on)
-- select cron.schedule('studio-token-refresh', '17 3 * * *', $$
--   select net.http_post(
--     url := (select value from private.config where key = 'functions_url') || '/refresh-tokens',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', (select value from private.config where key = 'hook_secret')),
--     body := '{}'::jsonb)
-- $$);