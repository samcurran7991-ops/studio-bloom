-- Studio Funnel · self-serve sign-up
-- Run after 0003_connections.sql.
-- A new owner signs up, picks their studio page address (slug), and gets a studio + owner membership.

-- Is this page address free? (letters, numbers and dashes, 2–60 characters)
create or replace function public.slug_available(p_slug text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_slug ~ '^[a-z0-9-]{2,60}$'
     and p_slug not in ('app', 'dashboard', 'admin', 'api', 'login', 'signup', 'onboarding', 'demo', 'www', 's')
     and not exists (select 1 from public.studios where slug = p_slug);
$$;
revoke all on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated;

-- Creates the studio and makes the signed-in user its owner. Returns the new studio id.
create or replace function public.create_studio(p_slug text, p_config jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'Please sign in first'; end if;
  if not public.slug_available(p_slug) then raise exception 'That page address is taken or not allowed'; end if;
  if jsonb_typeof(p_config) <> 'object' or coalesce(p_config->>'name', '') = '' then raise exception 'Studio name is required'; end if;
  if (select count(*) from public.studio_members where user_id = v_uid and role = 'owner') >= 3 then
    raise exception 'You already have 3 studios. Contact support to add more.';
  end if;
  insert into public.studios (slug, config) values (p_slug, p_config) returning id into v_id;
  insert into public.studio_members (studio_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end;
$$;
revoke all on function public.create_studio(text, jsonb) from public, anon;
grant execute on function public.create_studio(text, jsonb) to authenticated;