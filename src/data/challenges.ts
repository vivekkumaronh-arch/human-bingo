import type { VerificationStatus } from '../types/multiplayer';

export interface ChallengeItem {
  id: number;
  numberLabel: string;
  headline: string;
  prompt: string;
  shortPrompt: string;
}

export interface UploadedPhoto {
  dataUrl: string;
  storagePath?: string;
  fileName: string;
  updatedAt: number;
  verificationStatus?: VerificationStatus;
  rejectionReason?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
}

export type ChallengePhotoMap = Record<number, UploadedPhoto>;

export const CHALLENGES: ChallengeItem[] = [
  {
    id: 1,
    numberLabel: '01',
    headline: 'Birthday Twin',
    prompt: 'Find someone born in the same month as you.',
    shortPrompt: 'Birthday Twin',
  },
  {
    id: 2,
    numberLabel: '02',
    headline: 'Colour Connection',
    prompt: 'Find someone wearing the same dominant colour as you.',
    shortPrompt: 'Colour Connection',
  },
  {
    id: 3,
    numberLabel: '03',
    headline: 'Fellow Facilitator',
    prompt: 'Find someone who shares the same professional profile as yours.',
    shortPrompt: 'Fellow Facilitator',
  },
  {
    id: 4,
    numberLabel: '04',
    headline: 'Same, Same, But Different',
    prompt: 'Find someone whose first name starts with the same letter as yours.',
    shortPrompt: 'Same, Same, But Different',
  },
  {
    id: 5,
    numberLabel: '05',
    headline: 'The Learning Bug',
    prompt: 'Find someone who recently learned a completely new skill.',
    shortPrompt: 'The Learning Bug',
  },
  {
    id: 6,
    numberLabel: '06',
    headline: 'Passport Pals',
    prompt: 'Find someone who loves travelling as much as you do.',
    shortPrompt: 'Passport Pals',
  },
  {
    id: 7,
    numberLabel: '07',
    headline: 'Passion Match',
    prompt: 'Find someone who shares your favourite hobby.',
    shortPrompt: 'Passion Match',
  },
  {
    id: 8,
    numberLabel: '08',
    headline: 'Polyglot Pro',
    prompt: 'Find someone who can speak three or more languages.',
    shortPrompt: 'Polyglot Pro',
  },
  {
    id: 9,
    numberLabel: '09',
    headline: 'Roots & Routes',
    prompt: 'Find someone from your hometown (or who has lived there).',
    shortPrompt: 'Roots & Routes',
  },
];
