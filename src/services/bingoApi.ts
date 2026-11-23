import { supabase } from '../lib/supabase';
import type { ChallengePhotoMap } from '../data/challenges';
import type {
  CreatedEventResult,
  CreatedGameResult,
  EventConfig,
  EventPhotoWallSubmission,
  EventStatus,
  JoinCodeValidationResult,
  JoinGameResult,
  ManagedEventSummary,
  ManagementCodeValidationResult,
  OrganiserGallerySubmission,
  ParticipantRecord,
  ParticipantSubmissionRecord,
  RankedParticipant,
  StoredParticipantSession,
  VerificationStatus,
} from '../types/multiplayer';

const EVENT_SELECT_COLUMNS =
  'id, title, joining_code, status, allow_replay, max_participants, created_at, expires_at, closed_at';

const EVENT_SELECT_FALLBACK_COLUMNS =
  'id, title, joining_code, status, allow_replay, max_participants, created_at, closed_at';

const PARTICIPANT_BASE_COLUMNS =
  'id, event_id, client_request_id, full_name, completed_count, is_completed, started_at, completed_at, duration_seconds, updated_at';

export const PHOTO_STORAGE_BUCKET = 'bingo-photos';

export function getEffectiveEventStatus(
  event: Pick<EventConfig, 'status' | 'expires_at'>,
): EventStatus {
  if (event.status === 'expired') return 'expired';
  if (event.status === 'closed') return 'closed';
  if (event.expires_at) {
    const expiresMs = new Date(event.expires_at).getTime();
    if (Number.isFinite(expiresMs) && Date.now() >= expiresMs) {
      return 'expired';
    }
  }
  return 'active';
}

function defaultExpiresAt(createdAt: string): string {
  const baseMs = new Date(createdAt).getTime();
  const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(safeBase + 48 * 60 * 60 * 1000).toISOString();
}

export function normalizeEventConfig<T extends Omit<EventConfig, 'expires_at'> & { expires_at?: string | null }>(
  raw: T,
): T & { expires_at: string; status: EventStatus } {
  const expiresAt = raw.expires_at || defaultExpiresAt(raw.created_at);
  const status = getEffectiveEventStatus({ status: raw.status, expires_at: expiresAt });
  return {
    ...raw,
    expires_at: expiresAt,
    status,
  };
}

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

function createRandomFileToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeJoiningCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeManagementCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidFourDigitCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export function buildEventInvitationText(params: {
  eventTitle?: string;
  joiningCode: string;
  appUrl?: string;
}): string {
  const cleanTitle = params.eventTitle?.trim();
  const includeTitle =
    Boolean(cleanTitle) && cleanTitle !== 'Human Bingo Networking Challenge';

  const lines = ["You're invited to play Human Bingo!", ''];
  if (includeTitle) {
    lines.push(`Game: ${cleanTitle}`);
  }
  lines.push(`Game Joining Code: ${params.joiningCode}`);
  lines.push('');
  if (params.appUrl) {
    lines.push(`Open Human Bingo (${params.appUrl}) and enter the 4-digit code to join.`);
  } else {
    lines.push('Open Human Bingo and enter the 4-digit code to join.');
  }

  return lines.join('\n');
}

export function submissionsToPhotoMap(
  submissions: ParticipantSubmissionRecord[],
  existing?: ChallengePhotoMap,
): ChallengePhotoMap {
  const next: ChallengePhotoMap = {};
  for (const sub of submissions) {
    const prev = existing?.[sub.challenge_id];
    const resolvedUrl = sub.photo_url || prev?.dataUrl;
    if (!resolvedUrl) continue;

    next[sub.challenge_id] = {
      dataUrl: resolvedUrl,
      storagePath: sub.photo_path ?? prev?.storagePath,
      fileName: prev?.fileName || `challenge-${sub.challenge_id}.jpg`,
      updatedAt: sub.submitted_at ? new Date(sub.submitted_at).getTime() : Date.now(),
      verificationStatus: sub.verification_status,
      rejectionReason: sub.rejection_reason,
      submittedAt: sub.submitted_at,
      reviewedAt: sub.reviewed_at,
    };
  }
  return next;
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

  const result = data as JoinCodeValidationResult;
  if (result.valid) {
    const normalizedEvent = normalizeEventConfig(result.event);
    if (normalizedEvent.status === 'expired') {
      return {
        valid: false,
        reason: 'expired',
        message: 'This event has expired.',
      };
    }
    return {
      valid: true,
      event: normalizedEvent,
    };
  }

  return result;
}

export async function createGame(title?: string): Promise<CreatedGameResult> {
  const client = requireClient();
  const { data, error } = await client.rpc('create_game', {
    p_title: title?.trim() || 'Human Bingo',
  });

  if (error) {
    throw new Error(error.message);
  }
  const result = data as CreatedGameResult;
  const normalizedEvent = normalizeEventConfig(result.event);

  if (!isValidFourDigitCode(normalizedEvent.joining_code) || !result.creator_token) {
    throw new Error(
      'Could not initialize game code. Please ensure database migration 009 has been applied.',
    );
  }

  return {
    event: normalizedEvent,
    creator_token: result.creator_token,
  };
}

export async function updateGameTitle(
  eventId: string,
  creatorToken: string,
  title: string,
): Promise<EventConfig> {
  const client = requireClient();
  const { data, error } = await client.rpc('update_game_title', {
    p_event_id: eventId,
    p_creator_token: creatorToken,
    p_title: title.trim() || 'Human Bingo',
  });

  if (error) {
    throw new Error(error.message);
  }
  return normalizeEventConfig(data as EventConfig);
}

export async function endGame(
  eventId: string,
  creatorToken: string,
): Promise<EventConfig> {
  const client = requireClient();
  const { data, error } = await client.rpc('end_game', {
    p_event_id: eventId,
    p_creator_token: creatorToken,
  });

  if (error) {
    throw new Error(error.message);
  }
  return normalizeEventConfig(data as EventConfig);
}

export async function joinGame(
  joiningCode: string,
  fullName: string,
  clientRequestId: string,
): Promise<
  | {
      valid: true;
      event: EventConfig;
      participant: ParticipantRecord;
      session: StoredParticipantSession;
    }
  | {
      valid: false;
      reason: string;
      message: string;
    }
> {
  const client = requireClient();
  const { data, error } = await client.rpc('join_game', {
    p_joining_code: normalizeJoiningCode(joiningCode),
    p_full_name: fullName,
    p_client_request_id: clientRequestId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as JoinGameResult;
  if (!result.valid) {
    return {
      valid: false,
      reason: result.reason,
      message: result.message,
    };
  }

  const normalizedEvent = normalizeEventConfig(result.event);
  if (normalizedEvent.status === 'expired') {
    return {
      valid: false,
      reason: 'expired',
      message: 'This game has expired after 48 hours.',
    };
  }

  return {
    valid: true,
    event: normalizedEvent,
    participant: result.participant,
    session: {
      participantId: result.participant.id,
      sessionToken: result.session_token,
      eventId: result.participant.event_id,
      joiningCode: normalizedEvent.joining_code,
      eventTitle: normalizedEvent.title,
      fullName: result.participant.full_name,
      startedAt: result.participant.started_at,
    },
  };
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
  const result = data as CreatedEventResult;
  const normalizedEvent = normalizeEventConfig(result.event);

  if (
    !isValidFourDigitCode(normalizedEvent.joining_code) ||
    !isValidFourDigitCode(result.management_code) ||
    normalizedEvent.joining_code === result.management_code
  ) {
    throw new Error(
      'Event codes did not match the 4-digit numeric format. Please ensure database migrations 007 and 008 have been applied.',
    );
  }

  return {
    event: normalizedEvent,
    management_code: result.management_code,
  };
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
  const result = data as ManagementCodeValidationResult;
  if (result.valid) {
    return {
      valid: true,
      event: normalizeEventConfig(result.event),
    };
  }
  return result;
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
  return ((data ?? []) as ManagedEventSummary[]).map((row) => normalizeEventConfig(row));
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
  return normalizeEventConfig(data as EventConfig);
}

export async function closeManagedEvent(managementCode: string): Promise<EventConfig> {
  const client = requireClient();
  const { data, error } = await client.rpc('close_managed_event', {
    p_management_code: normalizeManagementCode(managementCode),
  });

  if (error) {
    throw new Error(error.message);
  }
  return normalizeEventConfig(data as EventConfig);
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

  if (!error) {
    return data ? normalizeEventConfig(data as EventConfig) : null;
  }

  const msg = (error.message ?? '').toLowerCase();
  if (error.code === '42703' || msg.includes('expires_at')) {
    const { data: fallbackData, error: fallbackError } = await client
      .from('events')
      .select(EVENT_SELECT_FALLBACK_COLUMNS)
      .eq('id', eventId)
      .maybeSingle();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }
    return fallbackData ? normalizeEventConfig(fallbackData as EventConfig) : null;
  }

  throw new Error(error.message);
}

function isMissingRpcFunctionError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

export async function fetchParticipants(eventId: string): Promise<ParticipantRecord[]> {
  const client = requireClient();

  const { data: rpcData, error: rpcError } = await client.rpc('get_event_participants', {
    p_event_id: eventId,
  });

  if (!rpcError) {
    return (rpcData ?? []) as ParticipantRecord[];
  }

  if (!isMissingRpcFunctionError(rpcError)) {
    throw new Error(rpcError.message);
  }

  // Fallback for databases where Migration 006 has not been applied yet:
  // select strictly the core columns present in the base schema.
  const { data, error } = await client
    .from('participants')
    .select(PARTICIPANT_BASE_COLUMNS)
    .eq('event_id', eventId)
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ParticipantRecord[]).map((row) => ({
    ...row,
    submitted_count: row.completed_count,
    pending_count: 0,
    rejected_count: 0,
    uploads_completed_at: row.is_completed ? row.completed_at : null,
  }));
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
  submissions: ParticipantSubmissionRecord[];
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
    submissions?: ParticipantSubmissionRecord[];
  };

  return {
    found: Boolean(payload?.found),
    participant: payload?.participant,
    completedChallengeIds: payload?.completed_challenge_ids ?? [],
    submissions: payload?.submissions ?? [],
  };
}

export async function uploadChallengePhotoToStorage(
  eventId: string,
  participantId: string,
  challengeId: number,
  blob: Blob,
  contentType: 'image/jpeg' | 'image/png',
  extension: 'jpg' | 'png',
): Promise<{ path: string; publicUrl: string }> {
  const client = requireClient();
  const path = `${eventId}/${participantId}/c${challengeId}-${createRandomFileToken()}.${extension}`;

  const { error: uploadError } = await client.storage
    .from(PHOTO_STORAGE_BUCKET)
    .upload(path, blob, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Photo upload failed: ${uploadError.message}. Please ensure database migrations 006 through 009 have been applied.`,
    );
  }

  const { data } = client.storage.from(PHOTO_STORAGE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Could not generate photograph URL after upload.');
  }

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function submitChallengePhoto(
  participantId: string,
  sessionToken: string,
  challengeId: number,
  photoPath: string,
  photoUrl: string,
): Promise<{
  participant: ParticipantRecord;
  submissions: ParticipantSubmissionRecord[];
}> {
  const client = requireClient();
  const { data, error } = await client.rpc('submit_challenge_photo', {
    p_participant_id: participantId,
    p_session_token: sessionToken,
    p_challenge_id: challengeId,
    p_photo_path: photoPath,
    p_photo_url: photoUrl,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as {
    participant: ParticipantRecord;
    submissions?: ParticipantSubmissionRecord[];
  };

  return {
    participant: payload.participant,
    submissions: payload.submissions ?? [],
  };
}

export async function removeChallengePhoto(
  participantId: string,
  sessionToken: string,
  challengeId: number,
): Promise<{
  participant: ParticipantRecord;
  submissions: ParticipantSubmissionRecord[];
}> {
  const client = requireClient();
  const { data, error } = await client.rpc('remove_challenge_photo', {
    p_participant_id: participantId,
    p_session_token: sessionToken,
    p_challenge_id: challengeId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as {
    participant: ParticipantRecord;
    submissions?: ParticipantSubmissionRecord[];
  };

  return {
    participant: payload.participant,
    submissions: payload.submissions ?? [],
  };
}

export async function fetchParticipantEventWall(
  participantId: string,
  sessionToken: string,
): Promise<EventPhotoWallSubmission[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('get_participant_event_wall', {
    p_participant_id: participantId,
    p_session_token: sessionToken,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EventPhotoWallSubmission[];
}

export async function fetchEventSubmissions(
  managementCode: string,
): Promise<OrganiserGallerySubmission[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('get_event_submissions', {
    p_management_code: normalizeManagementCode(managementCode),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OrganiserGallerySubmission[];
}

export async function verifyParticipantSubmission(
  managementCode: string,
  participantId: string,
  challengeId: number,
  status: Exclude<VerificationStatus, 'pending'>,
  rejectionReason?: string,
): Promise<{
  participant: ParticipantRecord;
  submission: OrganiserGallerySubmission;
}> {
  const client = requireClient();
  const { data, error } = await client.rpc('verify_participant_submission', {
    p_management_code: normalizeManagementCode(managementCode),
    p_participant_id: participantId,
    p_challenge_id: challengeId,
    p_status: status,
    p_rejection_reason: status === 'rejected' ? rejectionReason?.trim() || null : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    participant: ParticipantRecord;
    submission: OrganiserGallerySubmission;
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
