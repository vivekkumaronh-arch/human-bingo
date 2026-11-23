import React, { useState } from 'react';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import type { ChallengeItem, UploadedPhoto } from '../data/challenges';

interface ChallengeCardProps {
  challenge: ChallengeItem;
  photo?: UploadedPhoto;
  isUploading?: boolean;
  isEventClosed?: boolean;
  onSelectCard: (challengeId: number) => void;
  onDropFile?: (challengeId: number, file: File) => void;
}

interface TileTheme {
  gradient: string;
  orbColor: string;
  wavePrimary: string;
  waveSecondary: string;
  variant: 0 | 1 | 2;
}

const TILE_THEMES: TileTheme[] = [
  {
    gradient: 'bg-gradient-to-br from-[#FCE3D2] via-[#F8D3BC] to-[#F1BEA0]',
    orbColor: 'bg-[#FFF5EE]/75',
    wavePrimary: 'rgba(255, 248, 243, 0.55)',
    waveSecondary: 'rgba(229, 146, 108, 0.28)',
    variant: 0,
  },
  {
    gradient: 'bg-gradient-to-br from-[#E2EDE4] via-[#CFE2D3] to-[#B8D1BE]',
    orbColor: 'bg-[#F5FAF6]/75',
    wavePrimary: 'rgba(247, 252, 248, 0.58)',
    waveSecondary: 'rgba(116, 158, 128, 0.25)',
    variant: 1,
  },
  {
    gradient: 'bg-gradient-to-br from-[#FBF0CC] via-[#F7E3AC] to-[#EED082]',
    orbColor: 'bg-[#FFFDF2]/75',
    wavePrimary: 'rgba(255, 252, 240, 0.58)',
    waveSecondary: 'rgba(212, 166, 62, 0.24)',
    variant: 2,
  },
  {
    gradient: 'bg-gradient-to-br from-[#DDE8F3] via-[#CBDCF0] to-[#B2CAE2]',
    orbColor: 'bg-[#F5F9FD]/75',
    wavePrimary: 'rgba(246, 250, 255, 0.58)',
    waveSecondary: 'rgba(104, 142, 184, 0.24)',
    variant: 1,
  },
  {
    gradient: 'bg-gradient-to-br from-[#F4D6CB] via-[#EAC1B2] to-[#DDA693]',
    orbColor: 'bg-[#FDF4F0]/75',
    wavePrimary: 'rgba(255, 245, 241, 0.52)',
    waveSecondary: 'rgba(196, 104, 78, 0.25)',
    variant: 2,
  },
  {
    gradient: 'bg-gradient-to-br from-[#EAE3F6] via-[#DDD2EE] to-[#C8BAE0]',
    orbColor: 'bg-[#F9F6FE]/75',
    wavePrimary: 'rgba(250, 247, 255, 0.56)',
    waveSecondary: 'rgba(138, 118, 178, 0.24)',
    variant: 0,
  },
  {
    gradient: 'bg-gradient-to-br from-[#F3EADF] via-[#EAE0CF] to-[#DCD0B9]',
    orbColor: 'bg-[#FCF9F4]/75',
    wavePrimary: 'rgba(255, 252, 247, 0.58)',
    waveSecondary: 'rgba(176, 152, 118, 0.24)',
    variant: 2,
  },
  {
    gradient: 'bg-gradient-to-br from-[#DCEEEB] via-[#C9E3DF] to-[#B0D4CE]',
    orbColor: 'bg-[#F4FBFA]/75',
    wavePrimary: 'rgba(245, 252, 251, 0.58)',
    waveSecondary: 'rgba(72, 148, 140, 0.24)',
    variant: 0,
  },
  {
    gradient: 'bg-gradient-to-br from-[#F9E1DC] via-[#F2CCC5] to-[#E6B3AA]',
    orbColor: 'bg-[#FFF6F4]/75',
    wavePrimary: 'rgba(255, 247, 245, 0.55)',
    waveSecondary: 'rgba(212, 114, 98, 0.24)',
    variant: 1,
  },
];

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  photo,
  isUploading = false,
  isEventClosed = false,
  onSelectCard,
  onDropFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const canModify = !isEventClosed && !isUploading;
  const theme = TILE_THEMES[(challenge.id - 1) % TILE_THEMES.length];

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!canModify) return;
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!canModify || !onDropFile) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onDropFile(challenge.id, file);
    }
  };

  const cardSurfaceClass = isDragging
    ? 'ring-2 ring-[#218F87] scale-[0.98]'
    : photo
      ? 'bg-white ring-2 ring-[#218F87] shadow-[0_3px_10px_rgba(33,143,135,0.18)]'
      : `${theme.gradient} ring-1 ring-black/[0.06] shadow-[0_2px_8px_rgba(23,46,77,0.06)] hover:shadow-[0_6px_14px_rgba(23,46,77,0.12)]`;

  return (
    <button
      type="button"
      onClick={() => onSelectCard(challenge.id)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      disabled={isUploading}
      aria-label={
        photo
          ? `Challenge ${challenge.numberLabel} ${challenge.headline} completed. Tap to view or update photo.`
          : `Challenge ${challenge.numberLabel} ${challenge.headline}: ${challenge.prompt}. Tap to add photo.`
      }
      className={`relative aspect-[1/1.18] sm:aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl text-left transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-1 disabled:cursor-wait ${cardSurfaceClass}`}
    >
      {isUploading ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#172E4D]/80 p-2 bg-white/92">
          <Loader2
            className="w-5 h-5 animate-spin text-[#218F87]"
            aria-hidden="true"
          />
          <span className="text-[10px] sm:text-xs font-bold">Saving…</span>
        </div>
      ) : photo ? (
        <>
          <img
            src={photo.dataUrl}
            alt={`${challenge.headline}: ${challenge.prompt}`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#0D1E35]/90 via-[#0D1E35]/25 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 inline-flex items-center gap-0.5 rounded-md bg-[#218F87]/95 backdrop-blur-xs px-1.5 py-0.5 text-[8.5px] sm:text-[10.5px] font-bold text-white border border-white/25 shadow-xs">
            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" aria-hidden="true" />
            <span>Done</span>
          </span>

          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2.5 pointer-events-none">
            <p className="text-[9.5px] leading-[1.15] sm:text-xs font-bold text-white drop-shadow-xs truncate">
              {challenge.numberLabel} · {challenge.headline}
            </p>
          </div>
        </>
      ) : (
        <div className="relative w-full h-full p-2 sm:p-3 flex flex-col justify-between overflow-hidden">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 w-5 h-5 sm:w-8 sm:h-8 rounded-full ${theme.orbColor}`}
          />

          <svg
            aria-hidden="true"
            viewBox="0 0 120 56"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-[42%]"
          >
            {theme.variant === 0 && (
              <>
                <path
                  d="M0,56 L0,30 Q36,6 82,28 T120,22 L120,56 Z"
                  fill={theme.waveSecondary}
                />
                <circle cx="60" cy="58" r="36" fill={theme.wavePrimary} />
              </>
            )}
            {theme.variant === 1 && (
              <>
                <circle cx="28" cy="56" r="34" fill={theme.waveSecondary} />
                <path
                  d="M0,56 L0,36 Q62,8 120,34 L120,56 Z"
                  fill={theme.wavePrimary}
                />
              </>
            )}
            {theme.variant === 2 && (
              <>
                <circle cx="92" cy="54" r="34" fill={theme.waveSecondary} />
                <path
                  d="M0,56 L0,24 Q50,42 120,18 L120,56 Z"
                  fill={theme.wavePrimary}
                />
              </>
            )}
          </svg>

          <div className="relative z-10 flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[11px] font-bold tabular-nums leading-none text-[#172E4D]/70">
              {challenge.numberLabel}
            </span>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/75 flex items-center justify-center shadow-2xs shrink-0">
              <Camera className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#218F87]" aria-hidden="true" />
            </span>
          </div>

          <div className="relative z-10 mt-1 flex flex-col gap-0.5 min-w-0">
            <h2 className="font-display text-[10px] leading-[1.14] min-[375px]:text-[11px] sm:text-[13px] sm:leading-tight font-extrabold text-[#172E4D] line-clamp-2 break-words">
              {challenge.headline}
            </h2>
            <p className="text-[8.5px] leading-[1.22] min-[375px]:text-[9.5px] sm:text-[11px] sm:leading-snug font-medium text-[#172E4D]/82 line-clamp-2 sm:line-clamp-3 break-words">
              {challenge.prompt}
            </p>
          </div>
        </div>
      )}
    </button>
  );
};
