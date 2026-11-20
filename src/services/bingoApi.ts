import { supabase } from '../lib/supabase';
import type {
  CreatedEventResult,
  EventConfig,
  JoinCodeValidationResult,
  ManagedEventSummary,
  ManagementCodeValidationResult,
  ParticipantRecord,
  RankedParticipant,
  StoredParticipantSession,
} from '../types/multiplayer';

const EVENT_SELECT_COLUMNS =
  'id, title, joining_code, status, allow_replay, max_participants, created_at, closed_at';

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

export function normalizeJoiningCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeManagementCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function rankCompletedParticipants(
  participants: ParticipantRecord[],
): RankedParticipant[] {
  const completed = participants
    .filter((p) => p.is_completed && Boolean(p.completed_at))
    .sort((a, b) => {
      const timeA = new Date(a.completed_at!).getTime();
      const timeB = new Date(b.completed_at!).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const durA = a.duration_seconds ?? Number.MAX_SAFE_INTEGER;
      const durB = b.duration_seconds ?? Number.MAX_SAFE_INTEGER;
      if (durA !== durB) return durA - durB;
      return a.id.localeCompare(b.id);
    });

  return completed.map((participant, index) => ({
    ...participant,
    rank: index + 1,
  }));
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) {
    return '—';
  }
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export function formatRankOrdinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th Place`;
  switch (rank % 10) {
    case 1:
      return `${rank}st Place`;
    case 2:
      return `${rank}nd Place`;
    case 3:
      return `${rank}rd Place`;
    default:
      return `${rank}th Place`;
  }
}

export async function validateJoiningCode(
  joiningCode: string,
): Promise<JoinCodeValidationResult> {
  const client = requireClient();
  const normalized = normalizeJoiningCode(joiningCode);

  const { data, error } = await client.rpc('validate_joining_code', {
    p_joining_code: normalized,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as JoinCodeValidationResult;
}

export async function createPublicEvent(
  title?: string,
  allowReplay = true,
  maxParticipants = 500,
): Promise<CreatedEventResult> {
  const client = requireClient();
  const { data, error } = await client.rpc('create_public_event', {
    p_title: title?.trim() || 'Human Bingo Networking Challenge',
    p_allow_replay: allowReplay,
    p_max_participants: maxParticipants,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data as CreatedEventResult;
}

export async function openEventManagement(
  managementCode: string,
): Promise<ManagementCodeValidationResult> {
  const client = requireClient();
  const normalized = normalizeManagementCode(managementCode);

  const { data, error } = await client.rpc('open_event_management', {
    p_management_code: normalized,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data as ManagementCodeValidationResult;
}

export async function fetchManagedEventsHistory(
  managementCodes: string[],
): Promise<ManagedEventSummary[]> {
  const normalized = Array.from(
    new Set(managementCodes.map(normalizeManagementCode).filter(Boolean)),
  );
  if (normalized.length === 0) return [];

  const client = requireClient();
  const { data, error } = await client.rpc('get_events_by_management_codes', {
    p_management_codes: normalized,
  });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as ManagedEventSummary[];
}

export async function updateManagedEvent(
  managementCode: string,
  updates: { title?: string; allow_replay?: boolean },
): Promise<EventConfig> {
  const client = requireClient();
  const { data, error } = await client.rpc('update_managed_event', {
    p_management_code: normalizeManagementCode(managementCode),
    p_title: updates.title ?? null,
    p_allow_replay: updates.allow_replay ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data as EventConfig;
}

export async function closeManagedEvent(managementCode: string): Promise<EventConfig> {
  const client = requireClient();
  const { data, error } = await client.rpc('close_managed_event', {
    p_management_code: normalizeManagementCode(managementCode),
  });

  if (error) {
    throw new Error(error.message);
  }
  return data as EventConfig;
}

export async function resetManagedEventLeaderboard(
  managementCode: string,
): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('reset_managed_event_leaderboard', {
    p_management_code: normalizeManagementCode(managementCode),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchEventConfig(eventId: string): Promise<EventConfig | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('events')
    .select(EVENT_SELECT_COLUMNS)
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data as EventConfig | null;
}

export async function fetchParticipants(eventId: string): Promise<ParticipantRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('participants')
    .select(
      'id, event_id, client_request_id, full_name, completed_count, is_completed, started_at, completed_at, duration_seconds, updated_at',
    )
    .eq('event_id', eventId)
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as ParticipantRecord[];
}

export async function registerParticipant(
  fullName: string,
  clientRequestId: string,
  event: EventConfig,
): Promise<{
  participant: ParticipantRecord;
  session: StoredParticipantSession;
}> {
  const client = requireClient();
  const { data, error } = await client.rpc('register_participant', {
    p_event_id: event.id,
    p_full_name: fullName,
    p_client_request_id: clientRequestId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as {
    participant: ParticipantRecord;
    session_token: string;
  };

  return {
    participant: payload.participant,
    session: {
      participantId: payload.participant.id,
      sessionToken: payload.session_token,
      eventId: payload.participant.event_id,
      joiningCode: event.joining_code,
      eventTitle: event.title,
      fullName: payload.participant.full_name,
      startedAt: payload.participant.started_at,
    },
  };
}

export async function resumeParticipant(
  participantId: string,
  sessionToken: string,
): Promise<{
  found: boolean;
  participant?: ParticipantRecord;
  completedChallengeIds?: number[];
}> {
  const client = requireClient();
  const { data, error } = await client.rpc('resume_participant', {
    p_participant_id: participantId,
    p_session_token: sessionToken,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as {
    found: boolean;
    participant?: ParticipantRecord;
    completed_challenge_ids?: number[];
  };

  return {
    found: Boolean(payload?.found),
    participant: payload?.participant,
    completedChallengeIds: payload?.completed_challenge_ids ?? [],
  };
}

export async function setChallengeStatus(
  participantId: string,
  sessionToken: string,
  challengeId: number,
  completed: boolean,
): Promise<{
  participant: ParticipantRecord;
  completedChallengeIds: number[];
}> {
  const client = requireClient();
  const { data, error } = await client.rpc('set_challenge_status', {
    p_participant_id: participantId,
    p_session_token: sessionToken,
    p_challenge_id: challengeId,
    p_completed: completed,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as {
    participant: ParticipantRecord;
    completed_challenge_ids?: number[];
  };

  return {
    participant: payload.participant,
    completedChallengeIds: payload.completed_challenge_ids ?? [],
  };
}

export function subscribeToEventUpdates(
  eventId: string,
  onParticipantsChange: () => void,
  onEventChange: () => void,
): () => void {
  const client = supabase;
  if (!client || !eventId) return () => {};

  const channel = client
    .channel(`bingo-event-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `event_id=eq.${eventId}`,
      },
      () => {
        onParticipantsChange();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: `id=eq.${eventId}`,
      },
      () => {
        onEventChange();
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
