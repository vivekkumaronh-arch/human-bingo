-- Migration 008: Step 2 Event Creation Hardening (Cross-Code Active Uniqueness & Expired Event Modification Guard)
-- Safe, non-destructive, idempotent migration. Preserves all existing events, legacy alphanumeric codes, participants, photos, and leaderboard data.

-- 1. Ensure create_public_event guarantees 4-digit numeric codes that are:
--    - Distinct from each other (joining_code <> management_code)
--    - Unique across ALL active public joining codes and active private management codes
--    - Stored as TEXT with leading zeros preserved
--    - Automatically assigned UTC created_at and expires_at = created_at + 48 hours
create or replace function public.create_public_event(
  p_title text default 'Human Bingo Networking Challenge',
  p_allow_replay boolean default true,
  p_max_participants integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_title text;
  v_joining_code text;
  v_management_code text;
  v_attempt integer := 0;
  v_now timestamptz := now();
  v_expires_at timestamptz := v_now + interval '48 hours';
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();

  v_clean_title := regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g');
  if char_length(v_clean_title) < 2 then
    v_clean_title := 'Human Bingo Networking Challenge';
  elsif char_length(v_clean_title) > 100 then
    v_clean_title := left(v_clean_title, 100);
  end if;

  if p_max_participants is null or p_max_participants < 1 or p_max_participants > 10000 then
    raise exception 'Maximum participants must be between 1 and 10,000.';
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 250 then
      raise exception 'Could not allocate unique 4-digit event codes. Please try again.';
    end if;

    v_joining_code := public.generate_four_digit_code();
    if v_joining_code !~ '^[0-9]{4}$' then
      continue;
    end if;

    -- Joining code must not match any active event joining code OR any active event's management code
    if exists (
      select 1
      from public.events e
      where upper(trim(e.joining_code)) = v_joining_code
        and e.status = 'active'
    ) or exists (
      select 1
      from public.event_secrets s
      inner join public.events e on e.id = s.event_id
      where upper(trim(s.management_code)) = v_joining_code
        and e.status = 'active'
    ) then
      continue;
    end if;

    v_management_code := public.generate_four_digit_code();
    if v_management_code !~ '^[0-9]{4}$' or v_management_code = v_joining_code then
      continue;
    end if;

    -- Management code must be globally unique across event_secrets AND must not match any active joining code
    if exists (
      select 1
      from public.event_secrets s
      where upper(trim(s.management_code)) = v_management_code
    ) or exists (
      select 1
      from public.events e
      where upper(trim(e.joining_code)) = v_management_code
        and e.status = 'active'
    ) then
      continue;
    end if;

    begin
      insert into public.events (
        id,
        title,
        joining_code,
        status,
        allow_replay,
        max_participants,
        created_at,
        expires_at
      )
      values (
        gen_random_uuid()::text,
        v_clean_title,
        v_joining_code,
        'active',
        coalesce(p_allow_replay, true),
        p_max_participants,
        v_now,
        v_expires_at
      )
      returning * into v_event;

      insert into public.event_secrets (event_id, management_code)
      values (v_event.id, v_management_code);

      exit;
    exception
      when unique_violation then
        v_event := null;
        continue;
    end;
  end loop;

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'management_code', v_management_code
  );
end;
$$;

-- 2. Prevent further event modifications after expiry or manual closure
create or replace function public.update_managed_event(
  p_management_code text,
  p_title text default null,
  p_allow_replay boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
  v_clean_title text;
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();
  v_event_id := public.assert_valid_management_code(p_management_code);

  select * into v_event
  from public.events
  where id = v_event_id
  for update;

  if not found then
    raise exception 'Event record not found.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= now() then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This event has expired and can no longer be modified.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This event has been closed and can no longer be modified.';
  end if;

  if p_title is not null then
    v_clean_title := regexp_replace(trim(p_title), '\s+', ' ', 'g');
    if char_length(v_clean_title) < 2 then
      v_clean_title := 'Human Bingo Networking Challenge';
    elsif char_length(v_clean_title) > 100 then
      v_clean_title := left(v_clean_title, 100);
    end if;
  end if;

  update public.events
  set
    title = coalesce(v_clean_title, title),
    allow_replay = coalesce(p_allow_replay, allow_replay)
  where id = v_event_id
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

revoke all on function public.create_public_event(text, boolean, integer) from public;
revoke all on function public.update_managed_event(text, text, boolean) from public;
grant execute on function public.create_public_event(text, boolean, integer) to anon, authenticated;
grant execute on function public.update_managed_event(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
