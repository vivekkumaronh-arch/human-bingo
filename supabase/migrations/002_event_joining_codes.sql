-- Migration 002: Event Joining Code System, Event Lifecycle & Organiser Event Management
-- Safe to run on an existing Human Bingo database. Preserves all existing events and participants.

create extension if not exists pgcrypto;

-- 1. Add joining_code, status, closed_at, and created_by to public.events
alter table public.events
  add column if not exists joining_code text,
  add column if not exists status text not null default 'active',
  add column if not exists closed_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Backfill existing events safely without losing any existing rows or participants
update public.events
set joining_code = upper(trim(joining_code))
where joining_code is not null;

update public.events e
set joining_code = case
  when e.id = 'default-event'
    and not exists (
      select 1
      from public.events other
      where upper(trim(other.joining_code)) = 'HB-2026-MAIN'
        and other.id <> e.id
    )
  then 'HB-2026-MAIN'
  else 'HB-2026-' || upper(substr(md5(e.id || coalesce(e.created_at::text, '')), 1, 4))
end
where e.joining_code is null or trim(e.joining_code) = '';

update public.events
set status = 'active'
where status is null or status not in ('active', 'closed');

alter table public.events
  alter column joining_code set not null;

-- 2. Enforce constraints and indexes for strict joining code uniqueness and fast lookups
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_status_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_status_check check (status in ('active', 'closed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_joining_code_format_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_joining_code_format_check
      check (
        joining_code = upper(trim(joining_code))
        and char_length(joining_code) >= 4
        and char_length(joining_code) <= 32
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_joining_code_key'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_joining_code_key unique (joining_code);
  end if;
end;
$$;

create unique index if not exists idx_events_joining_code_upper
  on public.events (upper(trim(joining_code)));

create index if not exists idx_events_status_created_at
  on public.events (status, created_at desc);

create index if not exists idx_participant_challenges_participant_id
  on public.participant_challenges (participant_id);

-- Defense-in-depth RLS policy for organiser-only event creation
drop policy if exists "Organisers can insert events" on public.events;
create policy "Organisers can insert events"
  on public.events for insert
  to authenticated
  with check (public.is_organiser());

-- 3. Server-side joining code validation (usable by anon and authenticated)
create or replace function public.validate_joining_code(p_joining_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_event public.events%rowtype;
begin
  v_code := upper(trim(coalesce(p_joining_code, '')));

  if char_length(v_code) < 4 then
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_format',
      'message', 'Please enter the joining code provided by your organiser.'
    );
  end if;

  select * into v_event
  from public.events
  where upper(trim(joining_code)) = v_code
  limit 1;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'reason', 'not_found',
      'message', 'Invalid joining code. Please check the code provided by your organiser.'
    );
  end if;

  if v_event.status <> 'active' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'closed',
      'message', 'This event has been closed by the organiser and is no longer accepting new participants.'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'event', to_jsonb(v_event)
  );
end;
$$;

-- 4. Update register_participant: require an existing, ACTIVE event (no auto-creation)
create or replace function public.register_participant(
  p_event_id text,
  p_full_name text,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_name text;
  v_event public.events%rowtype;
  v_existing public.participants%rowtype;
  v_existing_token uuid;
  v_count integer;
  v_participant public.participants%rowtype;
  v_secret uuid;
begin
  v_clean_name := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');

  if char_length(v_clean_name) < 2 or char_length(v_clean_name) > 80 then
    raise exception 'Please enter a valid full name (2 to 80 characters).';
  end if;

  if p_client_request_id is null then
    raise exception 'Missing client request identifier.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Invalid event. Please enter a valid joining code first.';
  end if;

  -- Idempotency check to prevent duplicate registrations from repeated clicks
  select * into v_existing
  from public.participants
  where event_id = p_event_id and client_request_id = p_client_request_id;

  if found then
    select session_token into v_existing_token
    from public.participant_secrets
    where participant_id = v_existing.id;

    return jsonb_build_object(
      'participant', to_jsonb(v_existing),
      'session_token', v_existing_token
    );
  end if;

  if v_event.status <> 'active' then
    raise exception 'This event has been closed by the organiser and is no longer accepting new participants.';
  end if;

  select count(*) into v_count
  from public.participants
  where event_id = p_event_id;

  if v_count >= v_event.max_participants then
    raise exception 'This event has reached its maximum participant limit (%).', v_event.max_participants;
  end if;

  insert into public.participants (event_id, client_request_id, full_name, started_at, updated_at)
  values (p_event_id, p_client_request_id, v_clean_name, now(), now())
  returning * into v_participant;

  insert into public.participant_secrets (participant_id)
  values (v_participant.id)
  returning session_token into v_secret;

  return jsonb_build_object(
    'participant', to_jsonb(v_participant),
    'session_token', v_secret
  );
end;
$$;

-- 5. Update set_challenge_status: reject new progress if the event has been closed
create or replace function public.set_challenge_status(
  p_participant_id uuid,
  p_session_token uuid,
  p_challenge_id integer,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
  v_participant public.participants%rowtype;
  v_event public.events%rowtype;
  v_count integer;
  v_now timestamptz := now();
  v_completed_ids integer[];
begin
  if p_challenge_id < 1 or p_challenge_id > 9 then
    raise exception 'Challenge ID must be between 1 and 9.';
  end if;

  select exists (
    select 1
    from public.participant_secrets
    where participant_id = p_participant_id
      and session_token = p_session_token
  ) into v_valid;

  if not v_valid then
    raise exception 'Invalid or expired participant session.';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Participant record not found.';
  end if;

  select * into v_event
  from public.events
  where id = v_participant.event_id;

  if not found or v_event.status <> 'active' then
    raise exception 'This event has been closed by the organiser and no longer accepts new progress.';
  end if;

  if p_completed then
    insert into public.participant_challenges (participant_id, challenge_id, completed_at)
    values (p_participant_id, p_challenge_id, v_now)
    on conflict (participant_id, challenge_id)
    do update set completed_at = excluded.completed_at;
  else
    delete from public.participant_challenges
    where participant_id = p_participant_id
      and challenge_id = p_challenge_id;
  end if;

  select count(*)::integer, coalesce(array_agg(challenge_id order by challenge_id), '{}')
  into v_count, v_completed_ids
  from public.participant_challenges
  where participant_id = p_participant_id;

  if v_count = 9 then
    update public.participants
    set
      completed_count = 9,
      is_completed = true,
      completed_at = coalesce(completed_at, v_now),
      duration_seconds = coalesce(
        duration_seconds,
        greatest(1, floor(extract(epoch from (coalesce(completed_at, v_now) - started_at)))::integer)
      ),
      updated_at = v_now
    where id = p_participant_id
    returning * into v_participant;
  else
    update public.participants
    set
      completed_count = v_count,
      is_completed = false,
      completed_at = null,
      duration_seconds = null,
      updated_at = v_now
    where id = p_participant_id
    returning * into v_participant;
  end if;

  return jsonb_build_object(
    'participant', to_jsonb(v_participant),
    'completed_challenge_ids', to_jsonb(v_completed_ids)
  );
end;
$$;

-- 6. Organiser-only RPCs for creating new games, closing games, and listing event history
create or replace function public.create_event_game(
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
  v_year text := to_char(now() at time zone 'utc', 'YYYY');
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_suffix text;
  v_code text;
  v_bytes bytea;
  v_attempt integer := 0;
  v_event public.events%rowtype;
begin
  if not public.is_organiser() then
    raise exception 'Organiser authentication is required to create a new game.';
  end if;

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
    if v_attempt > 30 then
      raise exception 'Could not allocate a unique joining code. Please try again.';
    end if;

    v_bytes := gen_random_bytes(4);
    v_suffix :=
      substr(v_chars, (get_byte(v_bytes, 0) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_bytes, 1) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_bytes, 2) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_bytes, 3) % length(v_chars)) + 1, 1);
    v_code := 'HB-' || v_year || '-' || v_suffix;

    begin
      insert into public.events (
        id,
        title,
        joining_code,
        status,
        allow_replay,
        max_participants,
        created_by
      )
      values (
        gen_random_uuid()::text,
        v_clean_title,
        v_code,
        'active',
        coalesce(p_allow_replay, true),
        p_max_participants,
        auth.uid()
      )
      returning * into v_event;

      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  return to_jsonb(v_event);
end;
$$;

create or replace function public.close_event_game(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_organiser() then
    raise exception 'Organiser authentication is required to close an event.';
  end if;

  update public.events
  set
    status = 'closed',
    closed_at = coalesce(closed_at, now())
  where id = p_event_id
  returning * into v_event;

  if not found then
    raise exception 'Event not found.';
  end if;

  return to_jsonb(v_event);
end;
$$;

create or replace function public.get_organiser_events_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_organiser() then
    raise exception 'Organiser authentication is required to view event history.';
  end if;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      e.id,
      e.title,
      e.joining_code,
      e.status,
      e.allow_replay,
      e.max_participants,
      e.created_at,
      e.closed_at,
      e.created_by,
      count(p.id)::integer as participant_count,
      count(p.id) filter (where p.is_completed)::integer as completed_count
    from public.events e
    left join public.participants p on p.event_id = e.id
    group by e.id
  ) item;

  return v_rows;
end;
$$;

-- 7. Least-privilege function & table grants
grant usage on schema public to anon, authenticated;

grant select on table public.events to anon, authenticated;
grant update (title, allow_replay, max_participants) on table public.events to authenticated;
grant select on table public.participants to anon, authenticated;
grant select on table public.participant_challenges to anon, authenticated;
grant select on table public.organisers to authenticated;

revoke all on function public.validate_joining_code(text) from public;
revoke all on function public.register_participant(text, text, uuid) from public;
revoke all on function public.set_challenge_status(uuid, uuid, integer, boolean) from public;
revoke all on function public.create_event_game(text, boolean, integer) from public, anon;
revoke all on function public.close_event_game(text) from public, anon;
revoke all on function public.get_organiser_events_summary() from public, anon;

grant execute on function public.validate_joining_code(text) to anon, authenticated;
grant execute on function public.register_participant(text, text, uuid) to anon, authenticated;
grant execute on function public.set_challenge_status(uuid, uuid, integer, boolean) to anon, authenticated;
grant execute on function public.create_event_game(text, boolean, integer) to authenticated;
grant execute on function public.close_event_game(text) to authenticated;
grant execute on function public.get_organiser_events_summary() to authenticated;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
