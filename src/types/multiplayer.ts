export type EventStatus = 'active' | 'closed' | 'expired';

export interface EventConfig {
  id: string;
  title: string;
  joining_code: string;
  status: EventStatus;
  allow_replay: boolean;
  max_participants: number;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
}

export interface ManagedEventSummary extends EventConfig {
  participant_count: number;
  completed_count: number;
}

export interface CreatedEventResult {
  event: EventConfig;
  management_code: string;
}

export interface CreatedGameResult {
  event: EventConfig;
  creator_token: string;
}

export type JoinCodeValidationResult =
  | {
      valid: true;
      event: EventConfig;
    }
  | {
      valid: false;
      reason: 'invalid_format' | 'not_found' | 'closed' | 'expired' | 'rate_limited';
      message: string;
    };

export type JoinGameResult =
  | {
      valid: true;
      event: EventConfig;
      participant: ParticipantRecord;
      session_token: string;
    }
  | {
      valid: false;
      reason:
        | 'invalid_format'
        | 'invalid_name'
        | 'not_found'
        | 'closed'
        | 'expired'
        | 'rate_limited'
        | 'full';
      message: string;
    };

export type ManagementCodeValidationResult =
  | {
      valid: true;
      event: EventConfig;
    }
  | {
      valid: false;
      message: string;
    };

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ParticipantRecord {
  id: string;
  event_id: string;
  client_request_id: string;
  full_name: string;
  completed_count: number;
  submitted_count?: number;
  pending_count?: number;
  rejected_count?: number;
  is_completed: boolean;
  started_at: string;
  uploads_completed_at?: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  updated_at: string;
}

export interface ParticipantSubmissionRecord {
  challenge_id: number;
  photo_path: string | null;
  photo_url: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface OrganiserGallerySubmission {
  participant_id: string;
  participant_name: string;
  participant_submitted_count?: number;
  participant_verified_count?: number;
  event_id: string;
  challenge_id: number;
  photo_path: string | null;
  photo_url: string;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export type EventPhotoWallSubmission = OrganiserGallerySubmission;

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
