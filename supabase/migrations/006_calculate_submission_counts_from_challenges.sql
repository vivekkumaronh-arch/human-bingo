-- Migration 006: Calculate Participant Submission Counts from participant_challenges
-- Self-contained, safe, backward-compatible migration for existing Supabase databases.
-- Does NOT add duplicate count columns to public.participants and does NOT delete or reset existing data.

-- 1. Ensure public.participant_challenges has photo storage & verification columns
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

-- Backfill event_id on any pre-existing participant_challenges rows
update public.participant_challenges pc
set event_id = p.event_id
from public.participants p
where pc.participant_id = p.id
  and pc.event_id is null;

-- Preserve legacy pre-photo challenge completions while ensuring new photo uploads default to 'pending'
update public.participant_challenges
set
  verification_status = 'approved',
  submitted_at = coalesce(submitted_at, completed_at, now()),
  reviewed_at = coalesce(reviewed_at, completed_at, now())
where photo_url is null
  and verification_status = 'pending';

create index if not exists idx_participant_challenges_participant_id
  on public.participant_challenges (participant_id);

create index if not exists idx_participant_challenges_event_status_submitted
  on public.participant_challenges (event_id, verification_status, submitted_at desc);

create index if not exists idx_participant_challenges_status_submitted
  on public.participant_challenges (verification_status, submitted_at desc);

-- 2. Lock down direct table access to public.participant_challenges
-- All reads/writes go through validated SECURITY DEFINER RPCs scoped to event_id.
revoke all on table public.participant_challenges from anon, authenticated, public;

drop policy if exists "Public can read participant challenges" on public.participant_challenges;
drop policy if exists "No direct access to participant challenges" on public.participant_challenges;
create policy "No direct access to participant challenges"
  on public.participant_challenges for all
  to anon, authenticated
  using (false)
  with check (false);

-- 3. Configure Supabase Storage bucket & upload/read policies for participant challenge photos
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
    )
  );

-- 4. RPC: fetch event participants with submission counts calculated dynamically from participant_challenges
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
        'completed_count', p.completed_count,
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
      count(*) filter (where pc.verification_status in ('pending', 'approved'))::integer as submitted_count,
      count(*) filter (where pc.verification_status = 'pending')::integer as pending_count,
      count(*) filter (where pc.verification_status = 'rejected')::integer as rejected_count,
      case
        when count(*) filter (where pc.verification_status in ('pending', 'approved')) = 9
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

-- 5. RPC: resume participant session with counts calculated from participant_challenges
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
  v_submissions jsonb;
  v_pending_count integer;
  v_rejected_count integer;
  v_submitted_count integer;
  v_uploads_completed_at timestamptz;
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

  select
    count(*) filter (where verification_status = 'pending')::integer,
    count(*) filter (where verification_status = 'rejected')::integer,
    count(*) filter (where verification_status in ('pending', 'approved'))::integer,
    case
      when count(*) filter (where verification_status in ('pending', 'approved')) = 9
        then max(submitted_at)
      else null
    end
  into v_pending_count, v_rejected_count, v_submitted_count, v_uploads_completed_at
  from public.participant_challenges
  where participant_id = p_participant_id;

  select coalesce(array_agg(challenge_id order by challenge_id), '{}')
  into v_completed_ids
  from public.participant_challenges
  where participant_id = p_participant_id
    and verification_status in ('pending', 'approved');

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
    'found', true,
    'participant', to_jsonb(v_participant) || jsonb_build_object(
      'submitted_count', coalesce(v_submitted_count, 0),
      'pending_count', coalesce(v_pending_count, 0),
      'rejected_count', coalesce(v_rejected_count, 0),
      'uploads_completed_at', v_uploads_completed_at
    ),
    'completed_challenge_ids', to_jsonb(v_completed_ids),
    'submissions', v_submissions
  );
end;
$$;

-- 6. RPC: submit or replace a challenge photograph (calculated counts returned from participant_challenges)
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

-- 7. RPC: remove an unapproved challenge photo
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

-- 8. RPC: shared Event Photo Wall strictly scoped to participant's own event
create or replace function public.get_participant_event_wall(
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
  v_event_id text;
  v_rows jsonb;
begin
  select exists (
    select 1
    from public.participant_secrets
    where participant_id = p_participant_id
      and session_token = p_session_token
  ) into v_valid;

  if not v_valid then
    raise exception 'Invalid or expired participant session.';
  end if;

  select event_id into v_event_id
  from public.participants
  where id = p_participant_id;

  if not found then
    raise exception 'Participant record not found.';
  end if;

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
      order by pc.submitted_at desc
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

-- 9. RPC: organiser fetch all submitted photos strictly for event matching management code
create or replace function public.get_event_submissions(p_management_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_event_id text;
  v_rows jsonb;
begin
  v_code := upper(trim(coalesce(p_management_code, '')));

  select event_id into v_event_id
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    raise exception 'Invalid management code. Action denied.';
  end if;

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

-- 10. RPC: organiser approve or reject a participant's submitted photo
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
  v_code text;
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
  if p_challenge_id < 1 or p_challenge_id > 9 then
    raise exception 'Challenge ID must be between 1 and 9.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Verification status must be approved or rejected.';
  end if;

  v_code := upper(trim(coalesce(p_management_code, '')));

  select event_id into v_event_id
  from public.event_secrets
  where upper(trim(management_code)) = v_code
  limit 1;

  if not found then
    raise exception 'Invalid management code. Action denied.';
  end if;

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

-- 11. Least-privilege grants & Realtime publication check
revoke all on function public.get_event_participants(text) from public;
revoke all on function public.resume_participant(uuid, uuid) from public;
revoke all on function public.submit_challenge_photo(uuid, uuid, integer, text, text) from public;
revoke all on function public.remove_challenge_photo(uuid, uuid, integer) from public;
revoke all on function public.get_participant_event_wall(uuid, uuid) from public;
revoke all on function public.get_event_submissions(text) from public;
revoke all on function public.verify_participant_submission(text, uuid, integer, text, text) from public;

grant execute on function public.get_event_participants(text) to anon, authenticated;
grant execute on function public.resume_participant(uuid, uuid) to anon, authenticated;
grant execute on function public.submit_challenge_photo(uuid, uuid, integer, text, text) to anon, authenticated;
grant execute on function public.remove_challenge_photo(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.get_participant_event_wall(uuid, uuid) to anon, authenticated;
grant execute on function public.get_event_submissions(text) to anon, authenticated;
grant execute on function public.verify_participant_submission(text, uuid, integer, text, text) to anon, authenticated;

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

notify pgrst, 'reload schema';
