-- Human Bingo Multiplayer Schema, RLS Policies & Server-Authoritative RPCs
-- Run this script in your Supabase SQL Editor for a fresh installation.
-- If upgrading an existing database, run supabase/migrations/003_public_code_management.sql instead.

create extension if not exists pgcrypto;

-- 1. Events table (publicly readable metadata; private management codes live in event_secrets)
create table if not exists public.events (
  id text primary key,
  title text not null default 'Human Bingo Networking Challenge',
  joining_code text not null unique check (
    joining_code = upper(trim(joining_code))
    and char_length(joining_code) >= 4
    and char_length(joining_code) <= 32
  ),
  status text not null default 'active' check (status in ('active', 'closed')),
  allow_replay boolean not null default true,
  max_participants integer not null default 500 check (max_participants > 0),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists idx_events_joining_code_upper
  on public.events (upper(trim(joining_code)));

create index if not exists idx_events_status_created_at
  on public.events (status, created_at desc);

-- 2. Private Event Management Secrets (locked down with RLS; never readable directly from client)
create table if not exists public.event_secrets (
  event_id text primary key references public.events(id) on delete cascade,
  management_code text not null unique check (
    management_code = upper(trim(management_code))
    and char_length(management_code) >= 8
    and char_length(management_code) <= 32
  ),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_event_secrets_management_code_upper
  on public.event_secrets (upper(trim(management_code)));

-- 3. Participants table (publicly readable per event for live leaderboard & progress; no secret tokens stored here)
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  client_request_id uuid not null,
  full_name text not null check (char_length(trim(full_name)) >= 2 and char_length(full_name) <= 80),
  completed_count integer not null default 0 check (completed_count >= 0 and completed_count <= 9),
  is_completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  updated_at timestamptz not null default now(),
  unique (event_id, client_request_id)
);

create index if not exists idx_participants_event_leaderboard
  on public.participants (event_id, is_completed desc, completed_at asc, duration_seconds asc);

-- 4. Participant session secrets (locked down with RLS; never readable directly from client)
create table if not exists public.participant_secrets (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  session_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 5. Per-challenge completion records (server timestamped)
create table if not exists public.participant_challenges (
  participant_id uuid not null references public.participants(id) on delete cascade,
  challenge_id integer not null check (challenge_id >= 1 and challenge_id <= 9),
  completed_at timestamptz not null default now(),
  primary key (participant_id, challenge_id)
);

create index if not exists idx_participant_challenges_participant_id
  on public.participant_challenges (participant_id);

-- 6. Enable Row Level Security on all tables
alter table public.events enable row level security;
alter table public.event_secrets enable row level security;
alter table public.participants enable row level security;
alter table public.participant_secrets enable row level security;
alter table public.participant_challenges enable row level security;

-- Events policies (read-only for clients; all mutations go through validated RPCs)
drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
  on public.events for select
  to anon, authenticated
  using (true);

-- Event secrets policies (no direct client access)
drop policy if exists "No direct access to event secrets" on public.event_secrets;
create policy "No direct access to event secrets"
  on public.event_secrets for all
  to anon, authenticated
  using (false)
  with check (false);

-- Participants policies (read-only for clients; mutations go through validated RPCs)
drop policy if exists "Public can read participants" on public.participants;
create policy "Public can read participants"
  on public.participants for select
  to anon, authenticated
  using (true);

-- Participant challenges policies (read-only for clients; mutations go through validated RPCs)
drop policy if exists "Public can read participant challenges" on public.participant_challenges;
create policy "Public can read participant challenges"
  on public.participant_challenges for select
  to anon, authenticated
  using (true);

-- Participant secrets policies (no direct client access)
drop policy if exists "No direct access to participant secrets" on public.participant_secrets;
create policy "No direct access to participant secrets"
  on public.participant_secrets for all
  to anon, authenticated
  using (false)
  with check (false);

-- 7. Server-authoritative RPCs

-- Validate a public joining code on the server before participant registration
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
      'message', 'Please enter the joining code provided for the event.'
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
      'message', 'Invalid joining code. Please check the code and try again.'
    );
  end if;

  if v_event.status <> 'active' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'closed',
      'message', 'This event has been closed by the creator and is no longer accepting new participants.'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'event', to_jsonb(v_event)
  );
end;
$$;

-- Create a new public event and return both public joining code and private management code
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
  v_year text := to_char(now() at time zone 'utc', 'YYYY');
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_join_bytes bytea;
  v_mgmt_bytes bytea;
  v_joining_code text;
  v_management_code text;
  v_attempt integer := 0;
  v_event public.events%rowtype;
begin
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
    if v_attempt > 40 then
      raise exception 'Could not allocate unique event codes. Please try again.';
    end if;

    v_join_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_joining_code := 'HB-' || v_year || '-' ||
      substr(v_chars, (get_byte(v_join_bytes, 0) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_join_bytes, 1) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_join_bytes, 2) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_join_bytes, 3) % length(v_chars)) + 1, 1);

    v_mgmt_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_management_code := 'MGT-' ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 0) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 1) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 2) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 3) % length(v_chars)) + 1, 1) ||
      '-' ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 4) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 5) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 10) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 11) % length(v_chars)) + 1, 1);

    begin
      insert into public.events (
        id,
        title,
        joining_code,
        status,
        allow_replay,
        max_participants
      )
      values (
        gen_random_uuid()::text,
        v_clean_title,
        v_joining_code,
        'active',
        coalesce(p_allow_replay, true),
        p_max_participants
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

-- Open event management using a private management code
create or replace function public.open_event_management(p_management_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_secret public.event_secrets%rowtype;
  v_event public.events%rowtype;
begin
  v_code := upper(trim(coalesce(p_management_code, '')));

  if char_length(v_code) < 8 then
    return jsonb_build_object(
      'valid', false,
      'message', 'Please enter a valid private management code.'
    );
  end if;

  select * into v_secret
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'message', 'Invalid management code. Please check the private code generated for your event.'
    );
  end if;

  select * into v_event
  from public.events
  where id = v_secret.event_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'message', 'Event record not found.'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'event', to_jsonb(v_event),
    'management_code', v_secret.management_code
  );
end;
$$;

-- Fetch event history strictly for management codes provided by the creator
create or replace function public.get_events_by_management_codes(p_management_codes text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text[];
  v_rows jsonb;
begin
  select coalesce(array_agg(distinct upper(trim(c))), '{}')
  into v_normalized
  from unnest(coalesce(p_management_codes, '{}')) as c
  where trim(coalesce(c, '')) <> '';

  if coalesce(array_length(v_normalized, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      e.id,
      e.title,
      e.joining_code,
      s.management_code,
      e.status,
      e.allow_replay,
      e.max_participants,
      e.created_at,
      e.closed_at,
      count(p.id)::integer as participant_count,
      count(p.id) filter (where p.is_completed)::integer as completed_count
    from public.event_secrets s
    inner join public.events e on e.id = s.event_id
    left join public.participants p on p.event_id = e.id
    where upper(trim(s.management_code)) = any(v_normalized)
    group by e.id, s.management_code
  ) item;

  return v_rows;
end;
$$;

-- Update event title or replay permission with a validated private management code
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
  v_code text;
  v_event_id text;
  v_clean_title text;
  v_event public.events%rowtype;
begin
  v_code := upper(trim(coalesce(p_management_code, '')));

  select event_id into v_event_id
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    raise exception 'Invalid management code. Action denied.';
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

-- Close an event using a validated private management code (preserves historical records)
create or replace function public.close_managed_event(p_management_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_event_id text;
  v_event public.events%rowtype;
begin
  v_code := upper(trim(coalesce(p_management_code, '')));

  select event_id into v_event_id
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    raise exception 'Invalid management code. Action denied.';
  end if;

  update public.events
  set
    status = 'closed',
    closed_at = coalesce(closed_at, now())
  where id = v_event_id
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

-- Reset an event leaderboard using a validated private management code
create or replace function public.reset_managed_event_leaderboard(p_management_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_event_id text;
begin
  v_code := upper(trim(coalesce(p_management_code, '')));

  select event_id into v_event_id
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    raise exception 'Invalid management code. Action denied.';
  end if;

  delete from public.participants
  where event_id = v_event_id;
end;
$$;

-- Register a new participant idempotently into an existing, ACTIVE event
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
    raise exception 'This event has been closed and is no longer accepting new participants.';
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

-- Resume an existing participant session securely
create or replace function public.resume_participant(
  p_participant_id uuid,
  p_session_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
  v_participant public.participants%rowtype;
  v_completed_ids integer[];
begin
  select exists (
    select 1
    from public.participant_secrets
    where participant_id = p_participant_id
      and session_token = p_session_token
  ) into v_valid;

  if not v_valid then
    return jsonb_build_object('found', false);
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(array_agg(challenge_id order by challenge_id), '{}')
  into v_completed_ids
  from public.participant_challenges
  where participant_id = p_participant_id;

  return jsonb_build_object(
    'found', true,
    'participant', to_jsonb(v_participant),
    'completed_challenge_ids', to_jsonb(v_completed_ids)
  );
end;
$$;

-- Update challenge completion status with authoritative server timestamp (only while event is active)
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
    raise exception 'This event has been closed and no longer accepts new progress.';
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

-- 7b. Schema, table, and function privileges (least-privilege with RLS enabled)
grant usage on schema public to anon, authenticated;

revoke all on table public.events from anon, authenticated, public;
revoke all on table public.event_secrets from anon, authenticated, public;
revoke all on table public.participants from anon, authenticated, public;
revoke all on table public.participant_challenges from anon, authenticated, public;
revoke all on table public.participant_secrets from anon, authenticated, public;

grant select on table public.events to anon, authenticated;
grant select on table public.participants to anon, authenticated;
grant select on table public.participant_challenges to anon, authenticated;

revoke all on function public.validate_joining_code(text) from public;
revoke all on function public.create_public_event(text, boolean, integer) from public;
revoke all on function public.open_event_management(text) from public;
revoke all on function public.get_events_by_management_codes(text[]) from public;
revoke all on function public.update_managed_event(text, text, boolean) from public;
revoke all on function public.close_managed_event(text) from public;
revoke all on function public.reset_managed_event_leaderboard(text) from public;
revoke all on function public.register_participant(text, text, uuid) from public;
revoke all on function public.resume_participant(uuid, uuid) from public;
revoke all on function public.set_challenge_status(uuid, uuid, integer, boolean) from public;

grant execute on function public.validate_joining_code(text) to anon, authenticated;
grant execute on function public.create_public_event(text, boolean, integer) to anon, authenticated;
grant execute on function public.open_event_management(text) to anon, authenticated;
grant execute on function public.get_events_by_management_codes(text[]) to anon, authenticated;
grant execute on function public.update_managed_event(text, text, boolean) to anon, authenticated;
grant execute on function public.close_managed_event(text) to anon, authenticated;
grant execute on function public.reset_managed_event_leaderboard(text) to anon, authenticated;
grant execute on function public.register_participant(text, text, uuid) to anon, authenticated;
grant execute on function public.resume_participant(uuid, uuid) to anon, authenticated;
grant execute on function public.set_challenge_status(uuid, uuid, integer, boolean) to anon, authenticated;

-- 8. Enable Supabase Realtime on participants and events
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end;
$$;
