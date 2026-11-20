-- Migration 003: Public, Code-Based Event Management System (No Login Required)
-- Safe to run on an existing database. Preserves all existing events, participants, and challenge records.

create extension if not exists pgcrypto;

-- 1. Create locked-down event_secrets table for private management codes
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

alter table public.event_secrets enable row level security;

drop policy if exists "No direct access to event secrets" on public.event_secrets;
create policy "No direct access to event secrets"
  on public.event_secrets for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.event_secrets from anon, authenticated, public;

-- 2. Backfill private management codes for any existing events without deleting or modifying data
do $$
declare
  v_evt record;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
begin
  for v_evt in
    select e.id
    from public.events e
    where not exists (
      select 1 from public.event_secrets s where s.event_id = e.id
    )
  loop
    loop
      v_bytes := gen_random_bytes(8);
      v_code := 'MGT-' ||
        substr(v_chars, (get_byte(v_bytes, 0) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 1) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 2) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 3) % length(v_chars)) + 1, 1) ||
        '-' ||
        substr(v_chars, (get_byte(v_bytes, 4) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 5) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 6) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 7) % length(v_chars)) + 1, 1);

      begin
        insert into public.event_secrets (event_id, management_code)
        values (v_evt.id, v_code);
        exit;
      exception
        when unique_violation then
          continue;
      end;
    end loop;
  end loop;
end;
$$;

-- 3. Tighten direct table permissions on public.events (all mutations go through validated RPCs)
revoke insert, update, delete on table public.events from anon, authenticated, public;
grant select on table public.events to anon, authenticated;

drop policy if exists "Organisers can insert events" on public.events;
drop policy if exists "Organisers can update events" on public.events;

-- 4. Public code-based event creation RPC (no login required)
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

    v_join_bytes := gen_random_bytes(4);
    v_joining_code := 'HB-' || v_year || '-' ||
      substr(v_chars, (get_byte(v_join_bytes, 0) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_join_bytes, 1) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_join_bytes, 2) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_join_bytes, 3) % length(v_chars)) + 1, 1);

    v_mgmt_bytes := gen_random_bytes(8);
    v_management_code := 'MGT-' ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 0) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 1) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 2) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 3) % length(v_chars)) + 1, 1) ||
      '-' ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 4) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 5) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 6) % length(v_chars)) + 1, 1) ||
      substr(v_chars, (get_byte(v_mgmt_bytes, 7) % length(v_chars)) + 1, 1);

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

-- 5. Validate a private management code on the server
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

-- 6. Fetch event history strictly for management codes held by the caller
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

-- 7. Update event title / replay setting using validated private management code
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

-- 8. Close an event using validated private management code (preserves historical records)
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

-- 9. Reset an event leaderboard using validated private management code
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

-- 10. Least-privilege function grants
revoke all on function public.create_public_event(text, boolean, integer) from public;
revoke all on function public.open_event_management(text) from public;
revoke all on function public.get_events_by_management_codes(text[]) from public;
revoke all on function public.update_managed_event(text, text, boolean) from public;
revoke all on function public.close_managed_event(text) from public;
revoke all on function public.reset_managed_event_leaderboard(text) from public;

grant execute on function public.create_public_event(text, boolean, integer) to anon, authenticated;
grant execute on function public.open_event_management(text) to anon, authenticated;
grant execute on function public.get_events_by_management_codes(text[]) to anon, authenticated;
grant execute on function public.update_managed_event(text, text, boolean) to anon, authenticated;
grant execute on function public.close_managed_event(text) to anon, authenticated;
grant execute on function public.reset_managed_event_leaderboard(text) to anon, authenticated;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
