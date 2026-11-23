-- Migration 007: 4-Digit Numeric Event Codes, Management Code Protection, Rate Limiting, 48-Hour Expiry & Schema Cache Fix
-- Safe, non-destructive, idempotent migration for existing Supabase databases.
-- Preserves all existing events, participants, photos, and leaderboard data.

-- 1. Ensure participant_challenges photo/verification columns exist (idempotent)
alter table public.participant_challenges
  add column if not exists event_id text references public.events(id) on delete cascade,
  add column if not exists photo_path text,
  add column if not exists photo_url text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'participant_challenges_verification_status_check'
      and conrelid = 'public.participant_challenges'::regclass
  ) then
    alter table public.participant_challenges
      add constraint participant_challenges_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

update public.participant_challenges pc
set event_id = p.event_id
from public.participants p
where pc.participant_id = p.id
  and pc.event_id is null;

create index if not exists idx_participant_challenges_participant_id
  on public.participant_challenges (participant_id);

create index if not exists idx_participant_challenges_event_status_submitted
  on public.participant_challenges (event_id, verification_status, submitted_at desc);

revoke all on table public.participant_challenges from anon, authenticated, public;

drop policy if exists "Public can read participant challenges" on public.participant_challenges;
drop policy if exists "No direct access to participant challenges" on public.participant_challenges;
create policy "No direct access to participant challenges"
  on public.participant_challenges for all
  to anon, authenticated
  using (false)
  with check (false);

-- 2. Add 48-hour expiry support on public.events (preserves all existing events)
alter table public.events
  add column if not exists expires_at timestamptz;

update public.events
set expires_at = created_at + interval '48 hours'
where expires_at is null;

alter table public.events
  alter column expires_at set default (now() + interval '48 hours'),
  alter column expires_at set not null;

-- Update events.status check constraint to allow 'active', 'closed', and 'expired'
do $$
declare
  v_con record;
begin
  for v_con in
    select conname
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mstatus\M'
  loop
    execute format('alter table public.events drop constraint if exists %I', v_con.conname);
  end loop;
end;
$$;

alter table public.events
  add constraint events_status_check
  check (status in ('active', 'closed', 'expired'));

-- Mark any already-overdue active events as expired
update public.events
set status = 'expired'
where status = 'active'
  and expires_at <= now();

-- Replace global joining_code uniqueness with uniqueness strictly among active events
do $$
declare
  v_con record;
begin
  for v_con in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.events'::regclass
      and c.contype = 'u'
      and a.attname = 'joining_code'
  loop
    execute format('alter table public.events drop constraint if exists %I', v_con.conname);
  end loop;
end;
$$;

drop index if exists public.idx_events_joining_code_upper;

create unique index if not exists idx_events_active_joining_code_unique
  on public.events (upper(trim(joining_code)))
  where status = 'active';

create index if not exists idx_events_joining_code_lookup
  on public.events (upper(trim(joining_code)), created_at desc);

create index if not exists idx_events_active_expires_at
  on public.events (expires_at)
  where status = 'active';

-- 3. Update event_secrets constraint to support 4-digit numeric management codes (preserving legacy codes)
do $$
declare
  v_con record;
begin
  for v_con in
    select conname
    from pg_constraint
    where conrelid = 'public.event_secrets'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mmanagement_code\M'
  loop
    execute format('alter table public.event_secrets drop constraint if exists %I', v_con.conname);
  end loop;
end;
$$;

alter table public.event_secrets
  add constraint event_secrets_management_code_check
  check (
    management_code = upper(trim(management_code))
    and (
      management_code ~ '^[0-9]{4}$'
      or management_code ~ '^MGT-[A-Z0-9-]+$'
    )
  );

-- Lock down event_secrets strictly
alter table public.event_secrets enable row level security;
revoke all on table public.event_secrets from anon, authenticated, public;

drop policy if exists "No direct access to event secrets" on public.event_secrets;
create policy "No direct access to event secrets"
  on public.event_secrets for all
  to anon, authenticated
  using (false)
  with check (false);

-- 4. Server-side rate limiting table & helpers to protect 4-digit codes from brute-force guessing
create table if not exists public.code_attempt_limits (
  scope text not null,
  bucket_key text not null,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, bucket_key)
);

alter table public.code_attempt_limits enable row level security;
revoke all on table public.code_attempt_limits from anon, authenticated, public;

drop policy if exists "No direct access to code attempt limits" on public.code_attempt_limits;
create policy "No direct access to code attempt limits"
  on public.code_attempt_limits for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.get_request_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw_headers text;
  v_headers jsonb;
  v_ip text;
begin
  v_raw_headers := nullif(trim(coalesce(current_setting('request.headers', true), '')), '');
  if v_raw_headers is null then
    return 'unknown-client';
  end if;

  begin
    v_headers := v_raw_headers::jsonb;
  exception
    when others then
      return 'unknown-client';
  end;

  v_ip := coalesce(
    nullif(trim(split_part(coalesce(v_headers->>'cf-connecting-ip', ''), ',', 1)), ''),
    nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    nullif(trim(split_part(coalesce(v_headers->>'x-real-ip', ''), ',', 1)), ''),
    'unknown-client'
  );

  return left(v_ip, 128);
end;
$$;

create or replace function public.is_code_rate_limited(p_scope text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := public.get_request_client_ip();
  v_now timestamptz := now();
  v_locked_until timestamptz;
begin
  select max(locked_until)
  into v_locked_until
  from public.code_attempt_limits
  where scope = p_scope
    and bucket_key in ('ip:' || v_ip, 'global')
    and locked_until is not null
    and locked_until > v_now;

  return v_locked_until;
end;
$$;

create or replace function public.record_failed_code_attempt(p_scope text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := public.get_request_client_ip();
  v_now timestamptz := now();
  v_ip_window interval;
  v_ip_limit integer;
  v_ip_lock interval;
  v_global_limit integer;
  v_global_lock interval;
  v_rec public.code_attempt_limits%rowtype;
  v_locked_until timestamptz := null;
begin
  if p_scope = 'manage' then
    v_ip_window := interval '15 minutes';
    v_ip_limit := 5;
    v_ip_lock := interval '15 minutes';
    v_global_limit := 40;
    v_global_lock := interval '2 minutes';
  else
    v_ip_window := interval '5 minutes';
    v_ip_limit := 15;
    v_ip_lock := interval '5 minutes';
    v_global_limit := 120;
    v_global_lock := interval '1 minute';
  end if;

  -- Per-IP rate limit bucket
  insert into public.code_attempt_limits (scope, bucket_key, failed_count, window_started_at, updated_at)
  values (p_scope, 'ip:' || v_ip, 1, v_now, v_now)
  on conflict (scope, bucket_key) do update
    set
      failed_count = case
        when code_attempt_limits.window_started_at + v_ip_window <= v_now then 1
        else code_attempt_limits.failed_count + 1
      end,
      window_started_at = case
        when code_attempt_limits.window_started_at + v_ip_window <= v_now then v_now
        else code_attempt_limits.window_started_at
      end,
      locked_until = case
        when code_attempt_limits.locked_until is not null and code_attempt_limits.locked_until > v_now
          then code_attempt_limits.locked_until
        when (
          case
            when code_attempt_limits.window_started_at + v_ip_window <= v_now then 1
            else code_attempt_limits.failed_count + 1
          end
        ) >= v_ip_limit
          then v_now + v_ip_lock
        else null
      end,
      updated_at = v_now
  returning * into v_rec;

  if v_rec.locked_until is not null and v_rec.locked_until > v_now then
    v_locked_until := v_rec.locked_until;
  end if;

  -- Global burst circuit-breaker bucket
  insert into public.code_attempt_limits (scope, bucket_key, failed_count, window_started_at, updated_at)
  values (p_scope, 'global', 1, v_now, v_now)
  on conflict (scope, bucket_key) do update
    set
      failed_count = case
        when code_attempt_limits.window_started_at + interval '1 minute' <= v_now then 1
        else code_attempt_limits.failed_count + 1
      end,
      window_started_at = case
        when code_attempt_limits.window_started_at + interval '1 minute' <= v_now then v_now
        else code_attempt_limits.window_started_at
      end,
      locked_until = case
        when code_attempt_limits.locked_until is not null and code_attempt_limits.locked_until > v_now
          then code_attempt_limits.locked_until
        when (
          case
            when code_attempt_limits.window_started_at + interval '1 minute' <= v_now then 1
            else code_attempt_limits.failed_count + 1
          end
        ) >= v_global_limit
          then v_now + v_global_lock
        else null
      end,
      updated_at = v_now
  returning * into v_rec;

  if v_rec.locked_until is not null and v_rec.locked_until > v_now then
    v_locked_until := greatest(coalesce(v_locked_until, v_rec.locked_until), v_rec.locked_until);
  end if;

  return v_locked_until;
end;
$$;

create or replace function public.reset_code_attempts(p_scope text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := public.get_request_client_ip();
begin
  delete from public.code_attempt_limits
  where scope = p_scope
    and bucket_key = 'ip:' || v_ip;
end;
$$;

-- 5. Automatic 48-hour expiry helper + optional pg_cron schedule
create or replace function public.expire_overdue_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.events
  set status = 'expired'
  where status = 'active'
    and expires_at <= now();

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('human-bingo-expire-events');
    exception
      when others then
        null;
    end;

    begin
      perform cron.schedule(
        'human-bingo-expire-events',
        '*/5 * * * *',
        'select public.expire_overdue_events();'
      );
    exception
      when others then
        null;
    end;
  end if;
end;
$$;

-- 6. Server-side management code validator (checks rate limit + matches event_secrets)
create or replace function public.assert_valid_management_code(p_management_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
  v_code text;
  v_event_id text;
begin
  v_locked_until := public.is_code_rate_limited('manage');
  if v_locked_until is not null then
    raise exception 'Too many incorrect management code attempts. Please wait before trying again.';
  end if;

  v_code := upper(trim(coalesce(p_management_code, '')));
  if v_code = '' then
    raise exception 'Invalid management code. Action denied.';
  end if;

  select event_id into v_event_id
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    raise exception 'Invalid management code. Action denied.';
  end if;

  perform public.reset_code_attempts('manage');
  return v_event_id;
end;
$$;

-- 7. Uniform 4-digit numeric code generator using PostgreSQL built-in gen_random_uuid()
create or replace function public.generate_four_digit_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_bytes bytea;
  v_num bigint;
begin
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_num := (
      ((get_byte(v_bytes, 0)::bigint & 127) << 24) +
      (get_byte(v_bytes, 1)::bigint << 16) +
      (get_byte(v_bytes, 2)::bigint << 8) +
      get_byte(v_bytes, 3)::bigint
    );
    -- Rejection sampling eliminates modulo bias over 0..2147479999
    if v_num < 2147480000 then
      return lpad((v_num % 10000)::text, 4, '0');
    end if;
  end loop;
end;
$$;

-- 8. Update create_public_event: generates two distinct 4-digit numeric codes & 48-hour expires_at
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
    if v_attempt > 200 then
      raise exception 'Could not allocate unique 4-digit event codes. Please try again.';
    end if;

    v_joining_code := public.generate_four_digit_code();
    if exists (
      select 1
      from public.events
      where upper(trim(joining_code)) = v_joining_code
        and status = 'active'
    ) then
      continue;
    end if;

    v_management_code := public.generate_four_digit_code();
    if v_management_code = v_joining_code then
      continue;
    end if;

    if exists (
      select 1
      from public.event_secrets
      where upper(trim(management_code)) = v_management_code
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

  -- management_code is returned ONLY here at creation time
  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'management_code', v_management_code
  );
end;
$$;

-- 9. Update validate_joining_code: enforces rate limiting, expiry check, and active-first lookup
create or replace function public.validate_joining_code(p_joining_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
  v_code text;
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();

  v_locked_until := public.is_code_rate_limited('join');
  if v_locked_until is not null then
    return jsonb_build_object(
      'valid', false,
      'reason', 'rate_limited',
      'message', 'Too many invalid joining code attempts. Please wait a few minutes and try again.'
    );
  end if;

  v_code := upper(trim(coalesce(p_joining_code, '')));

  if char_length(v_code) < 4 then
    perform public.record_failed_code_attempt('join');
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_format',
      'message', 'Please enter the 4-digit joining code provided by your event host.'
    );
  end if;

  select * into v_event
  from public.events
  where upper(trim(joining_code)) = v_code
  order by
    case when status = 'active' then 0 else 1 end,
    created_at desc
  limit 1;

  if not found then
    perform public.record_failed_code_attempt('join');
    return jsonb_build_object(
      'valid', false,
      'reason', 'not_found',
      'message', 'Invalid joining code. Please check the 4-digit code and try again.'
    );
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= now() then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    return jsonb_build_object(
      'valid', false,
      'reason', 'expired',
      'message', 'This event has expired.'
    );
  end if;

  if v_event.status <> 'active' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'closed',
      'message', 'This event has been closed by the creator and is no longer accepting new participants.'
    );
  end if;

  perform public.reset_code_attempts('join');

  return jsonb_build_object(
    'valid', true,
    'event', to_jsonb(v_event)
  );
end;
$$;

-- 10. Update open_event_management: enforces rate limiting, hides management_code from response, allows historical expired events
create or replace function public.open_event_management(p_management_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
  v_code text;
  v_secret public.event_secrets%rowtype;
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();

  v_locked_until := public.is_code_rate_limited('manage');
  if v_locked_until is not null then
    return jsonb_build_object(
      'valid', false,
      'message', 'Too many incorrect management code attempts. Please wait 15 minutes before trying again.'
    );
  end if;

  v_code := upper(trim(coalesce(p_management_code, '')));

  if char_length(v_code) < 4 then
    perform public.record_failed_code_attempt('manage');
    return jsonb_build_object(
      'valid', false,
      'message', 'Please enter your 4-digit private management code.'
    );
  end if;

  select * into v_secret
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    perform public.record_failed_code_attempt('manage');
    return jsonb_build_object(
      'valid', false,
      'message', 'Invalid management code. Please check your 4-digit private management code and try again.'
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

  perform public.reset_code_attempts('manage');

  -- Never return management_code in the response payload
  return jsonb_build_object(
    'valid', true,
    'event', to_jsonb(v_event)
  );
end;
$$;

-- 11. Update get_events_by_management_codes: omit management_code from response payload
create or replace function public.get_events_by_management_codes(p_management_codes text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
  v_normalized text[];
  v_rows jsonb;
begin
  perform public.expire_overdue_events();

  v_locked_until := public.is_code_rate_limited('manage');
  if v_locked_until is not null then
    raise exception 'Too many incorrect management code attempts. Please wait before trying again.';
  end if;

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
      e.status,
      e.allow_replay,
      e.max_participants,
      e.created_at,
      e.expires_at,
      e.closed_at,
      count(p.id)::integer as participant_count,
      count(p.id) filter (where p.is_completed)::integer as completed_count
    from public.event_secrets s
    inner join public.events e on e.id = s.event_id
    left join public.participants p on p.event_id = e.id
    where upper(trim(s.management_code)) = any(v_normalized)
    group by e.id
  ) item;

  return v_rows;
end;
$$;

-- 12. Update management mutation RPCs to use assert_valid_management_code & expire_overdue_events
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

create or replace function public.close_managed_event(p_management_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();
  v_event_id := public.assert_valid_management_code(p_management_code);

  update public.events
  set
    status = case when status = 'expired' then 'expired' else 'closed' end,
    closed_at = coalesce(closed_at, now())
  where id = v_event_id
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

create or replace function public.reset_managed_event_leaderboard(p_management_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
begin
  perform public.expire_overdue_events();
  v_event_id := public.assert_valid_management_code(p_management_code);

  delete from public.participants
  where event_id = v_event_id;
end;
$$;

-- 13. Update register_participant, submit_challenge_photo, remove_challenge_photo to reject expired events
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
  perform public.expire_overdue_events();

  v_clean_name := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');

  if char_length(v_clean_name) < 2 or char_length(v_clean_name) > 80 then
    raise exception 'Please enter a valid full name (2 to 80 characters).';
  end if;

  if p_client_request_id is null then
    raise exception 'Missing client request identifier.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Invalid event. Please enter a valid joining code first.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= now() then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This event has expired.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This event has been closed and is no longer accepting new participants.';
  end if;

  select * into v_existing
  from public.participants
  where event_id = p_event_id and client_request_id = p_client_request_id;

  if found then
    select session_token into v_existing_token
    from public.participant_secrets
    where participant_id = v_existing.id;

    return jsonb_build_object(
      'participant', to_jsonb(v_existing) || jsonb_build_object(
        'submitted_count', 0,
        'pending_count', 0,
        'rejected_count', 0,
        'uploads_completed_at', null
      ),
      'session_token', v_existing_token
    );
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
    'participant', to_jsonb(v_participant) || jsonb_build_object(
      'submitted_count', 0,
      'pending_count', 0,
      'rejected_count', 0,
      'uploads_completed_at', null
    ),
    'session_token', v_secret
  );
end;
$$;

create or replace function public.submit_challenge_photo(
  p_participant_id uuid,
  p_session_token uuid,
  p_challenge_id integer,
  p_photo_path text,
  p_photo_url text
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
  v_existing public.participant_challenges%rowtype;
  v_expected_prefix text;
  v_clean_path text;
  v_clean_url text;
  v_now timestamptz := now();
  v_approved_count integer;
  v_pending_count integer;
  v_rejected_count integer;
  v_submitted_count integer;
  v_uploads_completed_at timestamptz;
  v_submissions jsonb;
begin
  perform public.expire_overdue_events();

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

  if not found then
    raise exception 'Event record not found.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= v_now then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This event has expired.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This event has been closed and no longer accepts new photo submissions.';
  end if;

  v_clean_path := trim(coalesce(p_photo_path, ''));
  v_clean_url := trim(coalesce(p_photo_url, ''));
  v_expected_prefix := v_participant.event_id || '/' || p_participant_id::text || '/';

  if left(v_clean_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'Invalid storage path for this participant.';
  end if;

  if v_clean_url !~ '^https?://' then
    raise exception 'Invalid photograph URL.';
  end if;

  select * into v_existing
  from public.participant_challenges
  where participant_id = p_participant_id
    and challenge_id = p_challenge_id
  for update;

  if found and v_existing.verification_status = 'approved' then
    raise exception 'This challenge has already been approved by the organiser.';
  end if;

  insert into public.participant_challenges (
    event_id,
    participant_id,
    challenge_id,
    photo_path,
    photo_url,
    verification_status,
    rejection_reason,
    submitted_at,
    reviewed_at,
    completed_at
  )
  values (
    v_participant.event_id,
    p_participant_id,
    p_challenge_id,
    v_clean_path,
    v_clean_url,
    'pending',
    null,
    v_now,
    null,
    v_now
  )
  on conflict (participant_id, challenge_id)
  do update set
    event_id = excluded.event_id,
    photo_path = excluded.photo_path,
    photo_url = excluded.photo_url,
    verification_status = 'pending',
    rejection_reason = null,
    submitted_at = v_now,
    reviewed_at = null,
    completed_at = v_now;

  select
    count(*) filter (where verification_status = 'approved')::integer,
    count(*) filter (where verification_status = 'pending')::integer,
    count(*) filter (where verification_status = 'rejected')::integer,
    count(*) filter (where verification_status in ('pending', 'approved'))::integer,
    case
      when count(*) filter (where verification_status in ('pending', 'approved')) = 9
        then max(submitted_at)
      else null
    end
  into v_approved_count, v_pending_count, v_rejected_count, v_submitted_count, v_uploads_completed_at
  from public.participant_challenges
  where participant_id = p_participant_id;

  update public.participants
  set
    completed_count = v_approved_count,
    is_completed = (v_approved_count = 9),
    completed_at = case
      when v_approved_count = 9 then coalesce(completed_at, v_now)
      else null
    end,
    duration_seconds = case
      when v_approved_count = 9 then coalesce(
        duration_seconds,
        greatest(1, floor(extract(epoch from (coalesce(completed_at, v_now) - started_at)))::integer)
      )
      else null
    end,
    updated_at = v_now
  where id = p_participant_id
  returning * into v_participant;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'challenge_id', pc.challenge_id,
        'photo_path', pc.photo_path,
        'photo_url', pc.photo_url,
        'verification_status', pc.verification_status,
        'rejection_reason', pc.rejection_reason,
        'submitted_at', pc.submitted_at,
        'reviewed_at', pc.reviewed_at
      )
      order by pc.challenge_id
    ),
    '[]'::jsonb
  )
  into v_submissions
  from public.participant_challenges pc
  where pc.participant_id = p_participant_id;

  return jsonb_build_object(
    'participant', to_jsonb(v_participant) || jsonb_build_object(
      'submitted_count', coalesce(v_submitted_count, 0),
      'pending_count', coalesce(v_pending_count, 0),
      'rejected_count', coalesce(v_rejected_count, 0),
      'uploads_completed_at', v_uploads_completed_at
    ),
    'submissions', v_submissions
  );
end;
$$;

create or replace function public.remove_challenge_photo(
  p_participant_id uuid,
  p_session_token uuid,
  p_challenge_id integer
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
  v_existing public.participant_challenges%rowtype;
  v_now timestamptz := now();
  v_approved_count integer;
  v_pending_count integer;
  v_rejected_count integer;
  v_submitted_count integer;
  v_uploads_completed_at timestamptz;
  v_submissions jsonb;
begin
  perform public.expire_overdue_events();

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

  if not found then
    raise exception 'Event record not found.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= v_now then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This event has expired.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This event has been closed and no longer accepts modifications.';
  end if;

  select * into v_existing
  from public.participant_challenges
  where participant_id = p_participant_id
    and challenge_id = p_challenge_id
  for update;

  if found and v_existing.verification_status = 'approved' then
    raise exception 'Approved challenge photographs cannot be removed.';
  end if;

  delete from public.participant_challenges
  where participant_id = p_participant_id
    and challenge_id = p_challenge_id;

  select
    count(*) filter (where verification_status = 'approved')::integer,
    count(*) filter (where verification_status = 'pending')::integer,
    count(*) filter (where verification_status = 'rejected')::integer,
    count(*) filter (where verification_status in ('pending', 'approved'))::integer,
    case
      when count(*) filter (where verification_status in ('pending', 'approved')) = 9
        then max(submitted_at)
      else null
    end
  into v_approved_count, v_pending_count, v_rejected_count, v_submitted_count, v_uploads_completed_at
  from public.participant_challenges
  where participant_id = p_participant_id;

  update public.participants
  set
    completed_count = v_approved_count,
    is_completed = (v_approved_count = 9),
    completed_at = case
      when v_approved_count = 9 then coalesce(completed_at, v_now)
      else null
    end,
    duration_seconds = case
      when v_approved_count = 9 then coalesce(
        duration_seconds,
        greatest(1, floor(extract(epoch from (coalesce(completed_at, v_now) - started_at)))::integer)
      )
      else null
    end,
    updated_at = v_now
  where id = p_participant_id
  returning * into v_participant;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'challenge_id', pc.challenge_id,
        'photo_path', pc.photo_path,
        'photo_url', pc.photo_url,
        'verification_status', pc.verification_status,
        'rejection_reason', pc.rejection_reason,
        'submitted_at', pc.submitted_at,
        'reviewed_at', pc.reviewed_at
      )
      order by pc.challenge_id
    ),
    '[]'::jsonb
  )
  into v_submissions
  from public.participant_challenges pc
  where pc.participant_id = p_participant_id;

  return jsonb_build_object(
    'participant', to_jsonb(v_participant) || jsonb_build_object(
      'submitted_count', coalesce(v_submitted_count, 0),
      'pending_count', coalesce(v_pending_count, 0),
      'rejected_count', coalesce(v_rejected_count, 0),
      'uploads_completed_at', v_uploads_completed_at
    ),
    'submissions', v_submissions
  );
end;
$$;

-- 14. Ensure get_event_submissions(p_management_code) & verify_participant_submission exist with exact signatures
create or replace function public.get_event_submissions(p_management_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
  v_rows jsonb;
begin
  perform public.expire_overdue_events();
  v_event_id := public.assert_valid_management_code(p_management_code);

  with participant_stats as (
    select
      pc2.participant_id,
      count(*) filter (where pc2.verification_status in ('pending', 'approved'))::integer as submitted_count,
      count(*) filter (where pc2.verification_status = 'approved')::integer as verified_count
    from public.participant_challenges pc2
    inner join public.participants p2 on p2.id = pc2.participant_id
    where p2.event_id = v_event_id
    group by pc2.participant_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'participant_name', p.full_name,
        'participant_submitted_count', coalesce(ps.submitted_count, 0),
        'participant_verified_count', coalesce(ps.verified_count, p.completed_count),
        'event_id', p.event_id,
        'challenge_id', pc.challenge_id,
        'photo_path', pc.photo_path,
        'photo_url', pc.photo_url,
        'verification_status', pc.verification_status,
        'rejection_reason', pc.rejection_reason,
        'submitted_at', pc.submitted_at,
        'reviewed_at', pc.reviewed_at
      )
      order by
        case pc.verification_status
          when 'pending' then 0
          when 'rejected' then 1
          else 2
        end,
        pc.submitted_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.participant_challenges pc
  inner join public.participants p on p.id = pc.participant_id
  left join participant_stats ps on ps.participant_id = p.id
  where p.event_id = v_event_id
    and pc.photo_url is not null;

  return v_rows;
end;
$$;

create or replace function public.verify_participant_submission(
  p_management_code text,
  p_participant_id uuid,
  p_challenge_id integer,
  p_status text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text;
  v_participant public.participants%rowtype;
  v_submission public.participant_challenges%rowtype;
  v_clean_reason text;
  v_now timestamptz := now();
  v_approved_count integer;
  v_pending_count integer;
  v_rejected_count integer;
  v_submitted_count integer;
  v_uploads_completed_at timestamptz;
begin
  perform public.expire_overdue_events();

  if p_challenge_id < 1 or p_challenge_id > 9 then
    raise exception 'Challenge ID must be between 1 and 9.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Verification status must be approved or rejected.';
  end if;

  v_event_id := public.assert_valid_management_code(p_management_code);

  select * into v_participant
  from public.participants
  where id = p_participant_id
    and event_id = v_event_id
  for update;

  if not found then
    raise exception 'Participant does not belong to this event.';
  end if;

  select * into v_submission
  from public.participant_challenges
  where participant_id = p_participant_id
    and challenge_id = p_challenge_id
  for update;

  if not found or v_submission.photo_url is null then
    raise exception 'No submitted photograph found for this challenge.';
  end if;

  if p_status = 'rejected' then
    v_clean_reason := nullif(left(regexp_replace(trim(coalesce(p_rejection_reason, '')), '\s+', ' ', 'g'), 240), '');
  else
    v_clean_reason := null;
  end if;

  update public.participant_challenges
  set
    verification_status = p_status,
    rejection_reason = v_clean_reason,
    reviewed_at = v_now
  where participant_id = p_participant_id
    and challenge_id = p_challenge_id
  returning * into v_submission;

  select
    count(*) filter (where verification_status = 'approved')::integer,
    count(*) filter (where verification_status = 'pending')::integer,
    count(*) filter (where verification_status = 'rejected')::integer,
    count(*) filter (where verification_status in ('pending', 'approved'))::integer,
    case
      when count(*) filter (where verification_status in ('pending', 'approved')) = 9
        then max(submitted_at)
      else null
    end
  into v_approved_count, v_pending_count, v_rejected_count, v_submitted_count, v_uploads_completed_at
  from public.participant_challenges
  where participant_id = p_participant_id;

  update public.participants
  set
    completed_count = v_approved_count,
    is_completed = (v_approved_count = 9),
    completed_at = case
      when v_approved_count = 9 then coalesce(completed_at, v_now)
      else null
    end,
    duration_seconds = case
      when v_approved_count = 9 then coalesce(
        duration_seconds,
        greatest(1, floor(extract(epoch from (coalesce(completed_at, v_now) - started_at)))::integer)
      )
      else null
    end,
    updated_at = v_now
  where id = p_participant_id
  returning * into v_participant;

  return jsonb_build_object(
    'participant', to_jsonb(v_participant) || jsonb_build_object(
      'submitted_count', coalesce(v_submitted_count, 0),
      'pending_count', coalesce(v_pending_count, 0),
      'rejected_count', coalesce(v_rejected_count, 0),
      'uploads_completed_at', v_uploads_completed_at
    ),
    'submission', jsonb_build_object(
      'participant_id', v_participant.id,
      'participant_name', v_participant.full_name,
      'participant_submitted_count', coalesce(v_submitted_count, 0),
      'participant_verified_count', v_participant.completed_count,
      'event_id', v_participant.event_id,
      'challenge_id', v_submission.challenge_id,
      'photo_path', v_submission.photo_path,
      'photo_url', v_submission.photo_url,
      'verification_status', v_submission.verification_status,
      'rejection_reason', v_submission.rejection_reason,
      'submitted_at', v_submission.submitted_at,
      'reviewed_at', v_submission.reviewed_at
    )
  );
end;
$$;

-- 15. Storage bucket & RLS policy: require event to be active AND not expired
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bingo-photos',
  'bingo-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view bingo challenge photos" on storage.objects;
create policy "Public can view bingo challenge photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'bingo-photos');

drop policy if exists "Participants can upload challenge photos" on storage.objects;
create policy "Participants can upload challenge photos"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'bingo-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
      from public.participants p
      join public.events e on e.id = p.event_id
      where e.id = (storage.foldername(name))[1]
        and p.id::text = (storage.foldername(name))[2]
        and e.status = 'active'
        and e.expires_at > now()
    )
  );

-- 16. Least-privilege grants (helpers remain internal; public RPCs granted explicitly)
revoke all on function public.get_request_client_ip() from public, anon, authenticated;
revoke all on function public.is_code_rate_limited(text) from public, anon, authenticated;
revoke all on function public.record_failed_code_attempt(text) from public, anon, authenticated;
revoke all on function public.reset_code_attempts(text) from public, anon, authenticated;
revoke all on function public.expire_overdue_events() from public, anon, authenticated;
revoke all on function public.assert_valid_management_code(text) from public, anon, authenticated;
revoke all on function public.generate_four_digit_code() from public, anon, authenticated;

revoke all on function public.create_public_event(text, boolean, integer) from public;
revoke all on function public.validate_joining_code(text) from public;
revoke all on function public.open_event_management(text) from public;
revoke all on function public.get_events_by_management_codes(text[]) from public;
revoke all on function public.update_managed_event(text, text, boolean) from public;
revoke all on function public.close_managed_event(text) from public;
revoke all on function public.reset_managed_event_leaderboard(text) from public;
revoke all on function public.register_participant(text, text, uuid) from public;
revoke all on function public.submit_challenge_photo(uuid, uuid, integer, text, text) from public;
revoke all on function public.remove_challenge_photo(uuid, uuid, integer) from public;
revoke all on function public.get_event_submissions(text) from public;
revoke all on function public.verify_participant_submission(text, uuid, integer, text, text) from public;

grant execute on function public.create_public_event(text, boolean, integer) to anon, authenticated;
grant execute on function public.validate_joining_code(text) to anon, authenticated;
grant execute on function public.open_event_management(text) to anon, authenticated;
grant execute on function public.get_events_by_management_codes(text[]) to anon, authenticated;
grant execute on function public.update_managed_event(text, text, boolean) to anon, authenticated;
grant execute on function public.close_managed_event(text) to anon, authenticated;
grant execute on function public.reset_managed_event_leaderboard(text) to anon, authenticated;
grant execute on function public.register_participant(text, text, uuid) to anon, authenticated;
grant execute on function public.submit_challenge_photo(uuid, uuid, integer, text, text) to anon, authenticated;
grant execute on function public.remove_challenge_photo(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.get_event_submissions(text) to anon, authenticated;
grant execute on function public.verify_participant_submission(text, uuid, integer, text, text) to anon, authenticated;

-- Reload PostgREST schema cache so get_event_submissions and updated RPCs are immediately visible
notify pgrst, 'reload schema';
