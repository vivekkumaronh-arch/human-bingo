export type EventStatus = 'active' | 'closed';

export interface EventConfig {
  id: string;
  title: string;
  joining_code: string;
  status: EventStatus;
  allow_replay: boolean;
  max_participants: number;
  created_at: string;
  closed_at: string | null;
}

export interface ManagedEventSummary extends EventConfig {
  management_code: string;
  participant_count: number;
  completed_count: number;
}

export interface CreatedEventResult {
  event: EventConfig;
  management_code: string;
}

export type JoinCodeValidationResult =
  | {
      valid: true;
      event: EventConfig;
    }
  | {
      valid: false;
      reason: 'invalid_format' | 'not_found' | 'closed';
      message: string;
    };

export type ManagementCodeValidationResult =
  | {
      valid: true;
      event: EventConfig;
      management_code: string;
    }
  | {
      valid: false;
      message: string;
    };

export interface ParticipantRecord {
  id: string;
  event_id: string;
  client_request_id: string;
  full_name: string;
  completed_count: number;
  is_completed: boolean;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  updated_at: string;
}

export interface StoredParticipantSession {
  participantId: string;
  sessionToken: string;
  eventId: string;
  joiningCode?: string;
  eventTitle?: string;
  fullName: string;
  startedAt: string;
}

export interface RankedParticipant extends ParticipantRecord {
  rank: number;
}
