-- Studio Funnel · initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Security model
--  * Visitors (anon) can't read or write tables directly. They call three
--    security-definer functions: get_public_studio, submit_lead, track_step.
--  * Owners/staff sign in with Supabase Auth and are linked to a studio in
--    studio_members. Row-level security limits every row to their own studio.
--  * External tools (Zapier, Make, ManyChat) post leads to the `ingest-lead`
--    edge function using the studio's private ingest_key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table public.studios (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  config      jsonb not null,
  ingest_key  text not null default encode(gen_random_bytes(18), 'hex'),
  created_at  timestamptz not null default now()
);

create table public.studio_members (
  studio_id  uuid not null references public.studios(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'staff')),
  primary key (studio_id, user_id)
);

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  studio_id       uuid not null references public.studios(id) on delete cascade,
  kind            text not null check (kind in ('booking', 'consult', 'lead', 'question', 'callback', 'chat')),
  status          text not null default 'new' check (status in ('new', 'contacted', 'booked', 'lost')),
  name            text not null check (char_length(name) between 1 and 80),
  phone           text not null check (char_length(phone) between 3 and 40),
  email           text check (email is null or char_length(email) <= 120),
  source          text not null default 'direct' check (source in ('ig-bio', 'ig-dm', 'ig-comment', 'meta-ad', 'meta-form', 'google', 'direct')),
  campaign        text check (campaign is null or char_length(campaign) <= 120),
  quiz            jsonb not null default '{}'::jsonb,
  service         text,
  preferred_day   text,
  preferred_time  text,
  message         text check (message is null or char_length(message) <= 2000),
  assigned_to     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index leads_studio_created on public.leads (studio_id, created_at desc);

create table public.lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  studio_id   uuid not null references public.studios(id) on delete cascade,
  type        text not null check (type in ('source', 'quiz_done', 'submitted', 'chat', 'status', 'assigned', 'note', 'call_logged', 'text_logged', 'auto')),
  text        text not null check (char_length(text) <= 2000),
  chat        jsonb,
  created_at  timestamptz not null default now()
);
create index lead_events_lead on public.lead_events (lead_id, created_at);

create table public.funnel_events (
  id          bigint generated always as identity primary key,
  studio_id   uuid not null references public.studios(id) on delete cascade,
  session_id  text not null check (char_length(session_id) <= 64),
  source      text not null,
  step        text not null check (step in ('visit', 'quiz_start', 'quiz_done', 'lead')),
  created_at  timestamptz not null default now()
);
create index funnel_events_studio_created on public.funnel_events (studio_id, created_at);

-- ---------------------------------------------------------------- membership helper
create or replace function public.is_member(p_studio uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.studio_members where studio_id = p_studio and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- row-level security
alter table public.studios        enable row level security;
alter table public.studio_members enable row level security;
alter table public.leads          enable row level security;
alter table public.lead_events    enable row level security;
alter table public.funnel_events  enable row level security;

create policy "members read their studio"   on public.studios for select to authenticated using (public.is_member(id));
create policy "members update their studio" on public.studios for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "see own memberships" on public.studio_members for select to authenticated using (user_id = auth.uid());

create policy "members read leads"   on public.leads for select to authenticated using (public.is_member(studio_id));
create policy "members update leads" on public.leads for update to authenticated using (public.is_member(studio_id)) with check (public.is_member(studio_id));

create policy "members read events" on public.lead_events for select to authenticated using (public.is_member(studio_id));
create policy "members add events"  on public.lead_events for insert to authenticated
  with check (public.is_member(studio_id) and exists (select 1 from public.leads l where l.id = lead_id and l.studio_id = lead_events.studio_id));

create policy "members read funnel" on public.funnel_events for select to authenticated using (public.is_member(studio_id));

-- The ingest key must never reach the browser: API roles get column-level access only.
revoke all on public.studios from anon, authenticated;
grant select (id, slug, config, created_at) on public.studios to authenticated;
grant update (config) on public.studios to authenticated;

-- ---------------------------------------------------------------- public functions (visitor side)
create or replace function public.get_public_studio(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', id, 'slug', slug, 'config', config) from public.studios where slug = p_slug;
$$;

create or replace function public.track_step(p_slug text, p_session text, p_source text, p_step text)
returns void
language plpgsql security definer set search_path = public
as $$
declare s_id uuid;
begin
  select id into s_id from public.studios where slug = p_slug;
  if s_id is null or p_step not in ('visit', 'quiz_start', 'quiz_done', 'lead') then return; end if;
  insert into public.funnel_events (studio_id, session_id, source, step)
  values (s_id, left(coalesce(p_session, 'none'), 64),
          case when p_source in ('ig-bio', 'ig-dm', 'ig-comment', 'meta-ad', 'meta-form', 'google') then p_source else 'direct' end,
          p_step);
end;
$$;

create or replace function public.submit_lead(p_slug text, p_lead jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  s_id     uuid;
  l_id     uuid;
  v_kind   text := p_lead->>'kind';
  v_source text := coalesce(p_lead->>'source', 'direct');
  v_phone  text := left(trim(coalesce(p_lead->>'phone', '')), 40);
  v_chat   jsonb := p_lead->'chat';
  v_label  text;
  v_what   text;
begin
  select id into s_id from public.studios where slug = p_slug;
  if s_id is null then raise exception 'Unknown studio'; end if;
  if v_kind not in ('booking', 'consult', 'lead', 'question', 'callback', 'chat') then raise exception 'Invalid kind'; end if;
  if v_source not in ('ig-bio', 'ig-dm', 'ig-comment', 'meta-ad', 'meta-form', 'google', 'direct') then v_source := 'direct'; end if;
  if char_length(v_phone) < 3 then raise exception 'Phone required'; end if;

  -- Simple abuse guard: at most 5 submissions per phone number per 10 minutes.
  if (select count(*) from public.leads where studio_id = s_id and phone = v_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many requests';
  end if;

  insert into public.leads (studio_id, kind, name, phone, email, source, campaign, quiz, service, preferred_day, preferred_time, message, assigned_to)
  values (
    s_id, v_kind,
    left(trim(coalesce(nullif(p_lead->>'name', ''), 'Unknown')), 80),
    v_phone,
    left(nullif(p_lead->>'email', ''), 120),
    v_source,
    left(nullif(p_lead->>'campaign', ''), 120),
    coalesce(p_lead->'quiz', '{}'::jsonb),
    left(nullif(p_lead->>'service', ''), 40),
    left(nullif(p_lead->>'preferredDay', ''), 40),
    left(nullif(p_lead->>'preferredTime', ''), 40),
    left(nullif(p_lead->>'message', ''), 2000),
    left(nullif(p_lead->>'assignedTo', ''), 40)
  )
  returning id into l_id;

  v_label := case v_source
    when 'ig-bio' then 'Instagram bio' when 'ig-dm' then 'Instagram DM' when 'ig-comment' then 'Instagram comment'
    when 'meta-ad' then 'Meta ad' when 'meta-form' then 'Meta lead form' when 'google' then 'Google profile' else 'Direct / other' end;
  insert into public.lead_events (lead_id, studio_id, type, text)
  values (l_id, s_id, 'source', 'Came from ' || v_label || coalesce(' · ' || nullif(p_lead->>'campaign', ''), ''));

  if (p_lead->'quiz') ? 'match' then
    insert into public.lead_events (lead_id, studio_id, type, text) values (l_id, s_id, 'quiz_done', 'Finished the 4 questions');
  end if;

  if jsonb_typeof(v_chat) = 'array' and jsonb_array_length(v_chat) > 0 then
    insert into public.lead_events (lead_id, studio_id, type, text, chat)
    values (l_id, s_id, 'chat', 'Chatted with the receptionist',
            (select jsonb_agg(e) from (select e from jsonb_array_elements(v_chat) e limit 20) x));
  end if;

  v_what := case v_kind
    when 'booking'  then 'Requested a time · ' || coalesce(p_lead->>'preferredDay', '') || ' at ' || coalesce(p_lead->>'preferredTime', '')
    when 'consult'  then 'Booked a free consult · ' || coalesce(p_lead->>'preferredDay', '') || ' at ' || coalesce(p_lead->>'preferredTime', '')
    when 'callback' then 'Requested a callback · ' || coalesce(p_lead->>'preferredTime', 'any time')
    when 'question' then 'Asked: "' || left(coalesce(p_lead->>'message', ''), 120) || '"'
    when 'lead'     then coalesce('Message: "' || left(nullif(p_lead->>'message', ''), 120) || '"', 'Asked for the price & guide')
    else 'Chatted with the receptionist' end;
  insert into public.lead_events (lead_id, studio_id, type, text) values (l_id, s_id, 'submitted', v_what);

  return l_id;
end;
$$;

-- ---------------------------------------------------------------- owner-side function
create or replace function public.funnel_counts(p_studio uuid, p_since timestamptz)
returns table (source text, step text, n bigint)
language sql stable security invoker set search_path = public
as $$
  select source, step, count(*) from public.funnel_events
  where studio_id = p_studio and created_at >= p_since
  group by source, step;
$$;

-- ---------------------------------------------------------------- permissions
revoke all on function public.get_public_studio(text) from public;
revoke all on function public.track_step(text, text, text, text) from public;
revoke all on function public.submit_lead(text, jsonb) from public;
revoke all on function public.funnel_counts(uuid, timestamptz) from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.get_public_studio(text) to anon, authenticated, service_role;
grant execute on function public.track_step(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.submit_lead(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.funnel_counts(uuid, timestamptz) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- ---------------------------------------------------------------- realtime (new leads appear live in the dashboard)
alter publication supabase_realtime add table public.leads, public.lead_events;