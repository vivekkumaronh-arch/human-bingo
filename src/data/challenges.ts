export interface ChallengeItem {
  id: number;
  numberLabel: string;
  prompt: string;
  shortPrompt: string;
}

export interface UploadedPhoto {
  dataUrl: string;
  fileName: string;
  updatedAt: number;
}

export type ChallengePhotoMap = Record<number, UploadedPhoto>;

export const CHALLENGES: ChallengeItem[] = [
  {
    id: 1,
    numberLabel: '01',
    prompt: 'Find someone who shares your birth month.',
    shortPrompt: 'Same birth month?',
  },
  {
    id: 2,
    numberLabel: '02',
    prompt: 'Find someone who loves travelling.',
    shortPrompt: 'Loves travelling?',
  },
  {
    id: 3,
    numberLabel: '03',
    prompt: 'Find someone who shares your favourite hobby.',
    shortPrompt: 'Same favourite hobby?',
  },
  {
    id: 4,
    numberLabel: '04',
    prompt: 'Find someone who speaks three languages.',
    shortPrompt: 'Speaks 3 languages?',
  },
  {
    id: 5,
    numberLabel: '05',
    prompt: 'Find someone whose favourite food matches yours.',
    shortPrompt: 'Same favourite food?',
  },
  {
    id: 6,
    numberLabel: '06',
    prompt: 'Find someone from your hometown.',
    shortPrompt: 'From your hometown?',
  },
  {
    id: 7,
    numberLabel: '07',
    prompt: 'Find someone who shares your favourite colour.',
    shortPrompt: 'Same favourite colour?',
  },
  {
    id: 8,
    numberLabel: '08',
    prompt: 'Find someone who has the same birthday date as you.',
    shortPrompt: 'Same birthday date?',
  },
  {
    id: 9,
    numberLabel: '09',
    prompt: 'Find someone you met for the first time today.',
    shortPrompt: 'New friend today?',
  },
];
