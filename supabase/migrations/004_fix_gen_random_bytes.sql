-- Migration 004: Replace gen_random_bytes(integer) with built-in gen_random_uuid()
-- Safe corrective migration for existing Supabase databases.
-- Does not reset, delete, or recreate any existing tables or participant data.

-- 1. Ensure event_secrets exists (non-destructive if already created by Migration 003)
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

-- 2. Backfill private management codes for any existing events missing one (using gen_random_uuid())
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
      v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      v_code := 'MGT-' ||
        substr(v_chars, (get_byte(v_bytes, 0) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 1) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 2) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 3) % length(v_chars)) + 1, 1) ||
        '-' ||
        substr(v_chars, (get_byte(v_bytes, 4) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 5) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 10) % length(v_chars)) + 1, 1) ||
        substr(v_chars, (get_byte(v_bytes, 11) % length(v_chars)) + 1, 1);

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

-- 3. Replace create_public_event using PostgreSQL built-in gen_random_uuid()
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

-- 4. Ensure legacy create_event_game (if present from Migration 002) also uses gen_random_uuid()
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
  v_result jsonb;
begin
  v_result := public.create_public_event(p_title, p_allow_replay, p_max_participants);
  return v_result->'event';
end;
$$;

-- 5. Ensure execution privileges and reload PostgREST schema cache
revoke all on function public.create_public_event(text, boolean, integer) from public;
grant execute on function public.create_public_event(text, boolean, integer) to anon, authenticated;

revoke all on function public.create_event_game(text, boolean, integer) from public, anon;

notify pgrst, 'reload schema';
