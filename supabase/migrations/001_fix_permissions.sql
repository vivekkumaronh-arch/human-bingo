-- Migration: 001_fix_permissions.sql
-- Purpose: Grant least-privilege schema, table, and RPC permissions to `anon` and `authenticated`
-- while keeping Row Level Security (RLS) enabled and secret/organiser-only data protected.
-- Safe to run multiple times (idempotent).

begin;

-- 1. Allow API roles to access objects in the public schema
grant usage on schema public to anon, authenticated;

-- 2. Ensure RLS remains enabled on all tables (never disable RLS globally)
alter table public.events enable row level security;
alter table public.organisers enable row level security;
alter table public.participants enable row level security;
alter table public.participant_secrets enable row level security;
alter table public.participant_challenges enable row level security;

-- 3. Reset direct table privileges to least-privilege defaults
revoke all on table public.events from anon, authenticated, public;
revoke all on table public.participants from anon, authenticated, public;
revoke all on table public.participant_challenges from anon, authenticated, public;
revoke all on table public.organisers from anon, authenticated, public;
revoke all on table public.participant_secrets from anon, authenticated, public;

-- 4. Grant required read / scoped-update privileges (filtered by RLS policies)
-- Events: participants and organisers can read event config; only authenticated organisers can update via RLS
grant select on table public.events to anon, authenticated;
grant update (title, allow_replay, max_participants) on table public.events to authenticated;

-- Participants & challenge progress: publicly readable for live progress/leaderboard;
-- direct INSERT/UPDATE/DELETE remain revoked (all writes go through validated SECURITY DEFINER RPCs)
grant select on table public.participants to anon, authenticated;
grant select on table public.participant_challenges to anon, authenticated;

-- Organisers: only authenticated users can check their own row (filtered by user_id = auth.uid())
grant select on table public.organisers to authenticated;

-- Note: public.participant_secrets intentionally has ZERO grants to anon/authenticated.

-- 5. Re-assert RLS policies
drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
  on public.events for select
  to anon, authenticated
  using (true);

drop policy if exists "Organisers can update events" on public.events;
create policy "Organisers can update events"
  on public.events for update
  to authenticated
  using (public.is_organiser())
  with check (public.is_organiser());

drop policy if exists "Users can check own organiser status" on public.organisers;
create policy "Users can check own organiser status"
  on public.organisers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Public can read participants" on public.participants;
create policy "Public can read participants"
  on public.participants for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read participant challenges" on public.participant_challenges;
create policy "Public can read participant challenges"
  on public.participant_challenges for select
  to anon, authenticated
  using (true);

drop policy if exists "No direct access to participant secrets" on public.participant_secrets;
create policy "No direct access to participant secrets"
  on public.participant_secrets for all
  to anon, authenticated
  using (false)
  with check (false);

-- 6. Function execution privileges
revoke all on function public.register_participant(text, text, uuid) from public;
revoke all on function public.resume_participant(uuid, uuid) from public;
revoke all on function public.set_challenge_status(uuid, uuid, integer, boolean) from public;
revoke all on function public.reset_event_leaderboard(text) from public, anon;
revoke all on function public.is_organiser() from public, anon;

grant execute on function public.register_participant(text, text, uuid) to anon, authenticated;
grant execute on function public.resume_participant(uuid, uuid) to anon, authenticated;
grant execute on function public.set_challenge_status(uuid, uuid, integer, boolean) to anon, authenticated;
grant execute on function public.reset_event_leaderboard(text) to authenticated;
grant execute on function public.is_organiser() to authenticated;

-- 7. Ensure default event row exists
insert into public.events (id, title, allow_replay, max_participants)
values ('default-event', 'Human Bingo Networking Challenge', true, 500)
on conflict (id) do nothing;

commit;

-- 8. Ask PostgREST to reload schema and privilege cache
notify pgrst, 'reload schema';

-- 9. Verification query (inspect output in Supabase SQL Editor)
select
  has_schema_privilege('anon', 'public', 'USAGE') as anon_schema_usage,
  has_table_privilege('anon', 'public.events', 'SELECT') as anon_events_select,
  has_table_privilege('anon', 'public.participants', 'SELECT') as anon_participants_select,
  has_table_privilege('anon', 'public.participant_challenges', 'SELECT') as anon_challenges_select,
  has_table_privilege('anon', 'public.participant_secrets', 'SELECT') as anon_secrets_select_should_be_false,
  has_table_privilege('anon', 'public.organisers', 'SELECT') as anon_organisers_select_should_be_false,
  has_table_privilege('authenticated', 'public.events', 'UPDATE') as auth_events_update,
  has_table_privilege('authenticated', 'public.organisers', 'SELECT') as auth_organisers_select;
