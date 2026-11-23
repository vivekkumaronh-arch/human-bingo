-- Migration 009: Simplified Social Human Bingo Game
-- Non-destructive, idempotent migration for existing Supabase databases.
-- Preserves all existing events, participants, photos, storage objects, and leaderboard history.

-- 1. Support creator session tokens without requiring private management codes
alter table public.event_secrets
  add column if not exists creator_token uuid;

update public.event_secrets
set creator_token = gen_random_uuid()
where creator_token is null;

alter table public.event_secrets
  alter column creator_token set default gen_random_uuid(),
  alter column creator_token set not null;

alter table public.event_secrets
  alter column management_code drop not null;

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
    management_code is null
    or (
      management_code = upper(trim(management_code))
      and (
        management_code ~ '^[0-9]{4}$'
        or management_code ~ '^MGT-[A-Z0-9-]+$'
      )
    )
  );

create unique index if not exists idx_event_secrets_creator_token
  on public.event_secrets (creator_token);

-- 2. Ensure participant_challenges has a dedicated submission id column
alter table public.participant_challenges
  add column if not exists id uuid;

update public.participant_challenges
set id = gen_random_uuid()
where id is null;

alter table public.participant_challenges
  alter column id set default gen_random_uuid(),
  alter column id set not null;

-- 3. Simplified Create Game RPC: 1 unique 4-digit joining code + 48h expiry + creator session token (no management code)
create or replace function public.create_game(
  p_title text default 'Human Bingo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_title text;
  v_joining_code text;
  v_attempt integer := 0;
  v_now timestamptz := now();
  v_expires_at timestamptz := v_now + interval '48 hours';
  v_event public.events%rowtype;
  v_creator_token uuid;
begin
  perform public.expire_overdue_events();

  v_clean_title := regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g');
  if char_length(v_clean_title) < 2 then
    v_clean_title := 'Human Bingo';
  elsif char_length(v_clean_title) > 100 then
    v_clean_title := left(v_clean_title, 100);
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 250 then
      raise exception 'Could not allocate a unique 4-digit joining code. Please try again.';
    end if;

    v_joining_code := public.generate_four_digit_code();
    if v_joining_code !~ '^[0-9]{4}$' then
      continue;
    end if;

    if exists (
      select 1
      from public.events e
      where upper(trim(e.joining_code)) = v_joining_code
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
        true,
        500,
        v_now,
        v_expires_at
      )
      returning * into v_event;

      insert into public.event_secrets (event_id, management_code, creator_token)
      values (v_event.id, null, gen_random_uuid())
      returning creator_token into v_creator_token;

      exit;
    exception
      when unique_violation then
        v_event := null;
        continue;
    end;
  end loop;

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'creator_token', v_creator_token
  );
end;
$$;

-- 4. Creator-authorized game title update (no management code required)
create or replace function public.update_game_title(
  p_event_id text,
  p_creator_token uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authorized boolean;
  v_clean_title text;
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();

  select exists (
    select 1
    from public.event_secrets
    where event_id = p_event_id
      and creator_token = p_creator_token
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Only the game creator can update this game.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Game record not found.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= now() then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This game has expired and can no longer be edited.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This game has already ended.';
  end if;

  v_clean_title := regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g');
  if char_length(v_clean_title) < 2 then
    v_clean_title := 'Human Bingo';
  elsif char_length(v_clean_title) > 100 then
    v_clean_title := left(v_clean_title, 100);
  end if;

  update public.events
  set title = v_clean_title
  where id = p_event_id
  returning * into v_event;

  return to_jsonb(v_event);
end;
$$;

-- 5. Creator-authorized End Game RPC (preserves all records & photos)
create or replace function public.end_game(
  p_event_id text,
  p_creator_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authorized boolean;
  v_event public.events%rowtype;
begin
  perform public.expire_overdue_events();

  select exists (
    select 1
    from public.event_secrets
    where event_id = p_event_id
      and creator_token = p_creator_token
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Only the game creator can end this game.';
  end if;

  update public.events
  set
    status = case when status = 'expired' then 'expired' else 'closed' end,
    closed_at = coalesce(closed_at, now())
  where id = p_event_id
  returning * into v_event;

  if not found then
    raise exception 'Game record not found.';
  end if;

  return to_jsonb(v_event);
end;
$$;

-- 6. Single-step atomic Join Game RPC (validates 4-digit code with rate limiting + registers participant idempotently)
create or replace function public.join_game(
  p_joining_code text,
  p_full_name text,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
  v_code text;
  v_clean_name text;
  v_event public.events%rowtype;
  v_existing public.participants%rowtype;
  v_existing_token uuid;
  v_count integer;
  v_participant public.participants%rowtype;
  v_secret uuid;
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
  if v_code !~ '^[0-9]{4}$' and v_code !~ '^HB-[A-Z0-9-]+$' then
    perform public.record_failed_code_attempt('join');
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_format',
      'message', 'Please enter the 4-digit numeric game code.'
    );
  end if;

  v_clean_name := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  if char_length(v_clean_name) < 2 or char_length(v_clean_name) > 80 then
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_name',
      'message', 'Please enter your name (2 to 80 characters).'
    );
  end if;

  if p_client_request_id is null then
    raise exception 'Missing client request identifier.';
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
      'message', 'Game code not found. Please check the 4-digit code and try again.'
    );
  end if;

  -- Lock event row to prevent capacity race conditions
  select * into v_event
  from public.events
  where id = v_event.id
  for update;

  if v_event.status = 'expired' or v_event.expires_at <= now() then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    return jsonb_build_object(
      'valid', false,
      'reason', 'expired',
      'message', 'This game has expired after 48 hours.'
    );
  end if;

  if v_event.status <> 'active' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'closed',
      'message', 'This game has ended and is no longer accepting new players.'
    );
  end if;

  perform public.reset_code_attempts('join');

  select * into v_existing
  from public.participants
  where event_id = v_event.id
    and client_request_id = p_client_request_id;

  if found then
    select session_token into v_existing_token
    from public.participant_secrets
    where participant_id = v_existing.id;

    return jsonb_build_object(
      'valid', true,
      'event', to_jsonb(v_event),
      'participant', to_jsonb(v_existing) || jsonb_build_object(
        'submitted_count', v_existing.completed_count,
        'pending_count', 0,
        'rejected_count', 0,
        'uploads_completed_at', case when v_existing.is_completed then v_existing.completed_at else null end
      ),
      'session_token', v_existing_token
    );
  end if;

  select count(*) into v_count
  from public.participants
  where event_id = v_event.id;

  if v_count >= v_event.max_participants then
    return jsonb_build_object(
      'valid', false,
      'reason', 'full',
      'message', format('This game has reached its maximum player limit (%s).', v_event.max_participants)
    );
  end if;

  insert into public.participants (event_id, client_request_id, full_name, started_at, updated_at)
  values (v_event.id, p_client_request_id, v_clean_name, now(), now())
  returning * into v_participant;

  insert into public.participant_secrets (participant_id)
  values (v_participant.id)
  returning session_token into v_secret;

  return jsonb_build_object(
    'valid', true,
    'event', to_jsonb(v_event),
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

-- 7. Update submit_challenge_photo: mark challenge completed immediately upon valid backend submission
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
  v_expected_prefix text;
  v_clean_path text;
  v_clean_url text;
  v_now timestamptz := now();
  v_completed_count integer;
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
    raise exception 'Invalid or expired player session.';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Player record not found.';
  end if;

  select * into v_event
  from public.events
  where id = v_participant.event_id;

  if not found then
    raise exception 'Game record not found.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= v_now then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This game has expired.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This game has ended and no longer accepts new photos.';
  end if;

  v_clean_path := trim(coalesce(p_photo_path, ''));
  v_clean_url := trim(coalesce(p_photo_url, ''));
  v_expected_prefix := v_participant.event_id || '/' || p_participant_id::text || '/';

  if left(v_clean_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'Invalid storage path for this player.';
  end if;

  if v_clean_url !~ '^https?://' then
    raise exception 'Invalid photograph URL.';
  end if;

  -- Upsert ensures 1 submission per (participant_id, challenge_id), supporting intentional replacement without duplicate score inflation
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
    'approved',
    null,
    v_now,
    v_now,
    v_now
  )
  on conflict (participant_id, challenge_id)
  do update set
    event_id = excluded.event_id,
    photo_path = excluded.photo_path,
    photo_url = excluded.photo_url,
    verification_status = 'approved',
    rejection_reason = null,
    submitted_at = v_now,
    reviewed_at = v_now,
    completed_at = v_now;

  select count(distinct challenge_id)::integer
  into v_completed_count
  from public.participant_challenges
  where participant_id = p_participant_id
    and verification_status in ('approved', 'pending')
    and photo_url is not null;

  update public.participants
  set
    completed_count = v_completed_count,
    is_completed = (v_completed_count = 9),
    completed_at = case
      when v_completed_count = 9 then coalesce(completed_at, v_now)
      else null
    end,
    duration_seconds = case
      when v_completed_count = 9 then coalesce(
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
      'submitted_count', v_completed_count,
      'pending_count', 0,
      'rejected_count', 0,
      'uploads_completed_at', case when v_completed_count = 9 then v_now else null end
    ),
    'submissions', v_submissions
  );
end;
$$;

-- 8. Update remove_challenge_photo: allow removing a challenge photo while the game is active
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
  v_now timestamptz := now();
  v_completed_count integer;
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
    raise exception 'Invalid or expired player session.';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Player record not found.';
  end if;

  select * into v_event
  from public.events
  where id = v_participant.event_id;

  if not found then
    raise exception 'Game record not found.';
  end if;

  if v_event.status = 'expired' or v_event.expires_at <= v_now then
    if v_event.status = 'active' then
      update public.events set status = 'expired' where id = v_event.id;
    end if;
    raise exception 'This game has expired.';
  end if;

  if v_event.status <> 'active' then
    raise exception 'This game has ended and no longer accepts modifications.';
  end if;

  delete from public.participant_challenges
  where participant_id = p_participant_id
    and challenge_id = p_challenge_id;

  select count(distinct challenge_id)::integer
  into v_completed_count
  from public.participant_challenges
  where participant_id = p_participant_id
    and verification_status in ('approved', 'pending')
    and photo_url is not null;

  update public.participants
  set
    completed_count = v_completed_count,
    is_completed = (v_completed_count = 9),
    completed_at = case
      when v_completed_count = 9 then coalesce(completed_at, v_now)
      else null
    end,
    duration_seconds = case
      when v_completed_count = 9 then coalesce(
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
      'submitted_count', v_completed_count,
      'pending_count', 0,
      'rejected_count', 0,
      'uploads_completed_at', null
    ),
    'submissions', v_submissions
  );
end;
$$;

-- 9. Update get_event_participants & get_participant_event_wall so live progress counts reflect valid submissions accurately
create or replace function public.get_event_participants(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if nullif(trim(coalesce(p_event_id, '')), '') is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'event_id', p.event_id,
        'client_request_id', p.client_request_id,
        'full_name', p.full_name,
        'completed_count', greatest(p.completed_count, coalesce(stats.approved_count, 0)),
        'submitted_count', coalesce(stats.submitted_count, 0),
        'pending_count', coalesce(stats.pending_count, 0),
        'rejected_count', coalesce(stats.rejected_count, 0),
        'is_completed', p.is_completed,
        'started_at', p.started_at,
        'uploads_completed_at', stats.uploads_completed_at,
        'completed_at', p.completed_at,
        'duration_seconds', p.duration_seconds,
        'updated_at', p.updated_at
      )
      order by p.started_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.participants p
  left join (
    select
      pc.participant_id,
      count(*) filter (where pc.verification_status = 'approved' and pc.photo_url is not null)::integer as approved_count,
      count(*) filter (where pc.verification_status in ('pending', 'approved') and pc.photo_url is not null)::integer as submitted_count,
      count(*) filter (where pc.verification_status = 'pending')::integer as pending_count,
      count(*) filter (where pc.verification_status = 'rejected')::integer as rejected_count,
      case
        when count(*) filter (where pc.verification_status in ('pending', 'approved') and pc.photo_url is not null) = 9
          then max(pc.submitted_at)
        else null
      end as uploads_completed_at
    from public.participant_challenges pc
    inner join public.participants ep on ep.id = pc.participant_id
    where ep.event_id = p_event_id
    group by pc.participant_id
  ) stats on stats.participant_id = p.id
  where p.event_id = p_event_id;

  return v_rows;
end;
$$;

-- 10. Grants & schema reload
revoke all on function public.create_game(text) from public;
revoke all on function public.update_game_title(text, uuid, text) from public;
revoke all on function public.end_game(text, uuid) from public;
revoke all on function public.join_game(text, text, uuid) from public;
revoke all on function public.submit_challenge_photo(uuid, uuid, integer, text, text) from public;
revoke all on function public.remove_challenge_photo(uuid, uuid, integer) from public;
revoke all on function public.get_event_participants(text) from public;

grant execute on function public.create_game(text) to anon, authenticated;
grant execute on function public.update_game_title(text, uuid, text) to anon, authenticated;
grant execute on function public.end_game(text, uuid) to anon, authenticated;
grant execute on function public.join_game(text, text, uuid) to anon, authenticated;
grant execute on function public.submit_challenge_photo(uuid, uuid, integer, text, text) to anon, authenticated;
grant execute on function public.remove_challenge_photo(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.get_event_participants(text) to anon, authenticated;

notify pgrst, 'reload schema';
