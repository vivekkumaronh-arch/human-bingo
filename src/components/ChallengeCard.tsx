import React, { useRef, useState } from 'react';
import { Camera, Check, Loader2, RefreshCw, X } from 'lucide-react';
import type { ChallengeItem, UploadedPhoto } from '../data/challenges';

interface ChallengeCardProps {
  challenge: ChallengeItem;
  photo?: UploadedPhoto;
  onSelectFile: (challengeId: number, file: File) => Promise<void>;
  onRemovePhoto: (challengeId: number) => void;
  onPreviewPhoto: (challengeId: number) => void;
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
    orbColor: 'bg-[#FFF5EE]/70',
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
    orbColor: 'bg-[#FDF4F0]/70',
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
  onSelectFile,
  onRemovePhoto,
  onPreviewPhoto,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    try {
      await onSelectFile(challenge.id, file);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      await onSelectFile(challenge.id, file);
    } finally {
      setIsProcessing(false);
    }
  };

  const isCompleted = Boolean(photo);
  const theme = TILE_THEMES[(challenge.id - 1) % TILE_THEMES.length];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative aspect-[1/1.22] sm:aspect-square w-full overflow-hidden rounded-lg sm:rounded-xl transition-all duration-150 ${
        isDragging
          ? 'ring-2 ring-[#258A83] scale-[0.99]'
          : isCompleted
            ? 'bg-white shadow-[0_2px_8px_rgba(20,43,73,0.12)] ring-2 ring-[#258A83]/70'
            : `${theme.gradient} shadow-[0_2px_6px_rgba(20,43,73,0.06)] ring-1 ring-black/[0.05] hover:shadow-[0_4px_12px_rgba(20,43,73,0.1)]`
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleFileChange}
        className="sr-only"
        aria-label={`Add photo for ${challenge.headline}: ${challenge.prompt}`}
      />

      {isProcessing ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#142B49]/75 p-2 bg-white/80">
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#258A83]" aria-hidden="true" />
          <span className="text-[10px] sm:text-xs font-medium">Saving…</span>
        </div>
      ) : photo ? (
        <>
          <button
            type="button"
            onClick={() => onPreviewPhoto(challenge.id)}
            className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-inset cursor-pointer group"
            aria-label={`View or replace photo for ${challenge.headline}: ${challenge.prompt}`}
          >
            <img
              src={photo.dataUrl}
              alt={`${challenge.headline}: ${challenge.prompt}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#0D1E35]/90 via-[#0D1E35]/35 to-transparent pointer-events-none"
              aria-hidden="true"
            />
          </button>

          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 pointer-events-none">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-[#258A83]/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] sm:text-[11px] font-bold tabular-nums text-white border border-white/20">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white stroke-[2.75]" aria-hidden="true" />
              {challenge.numberLabel}
            </span>
          </div>

          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center gap-1 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Replace photo"
              aria-label={`Replace photo for ${challenge.headline}`}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#142B49]/75 hover:bg-[#258A83] text-white border border-white/20 backdrop-blur-xs flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePhoto(challenge.id);
              }}
              title="Remove photo"
              aria-label={`Remove photo for ${challenge.headline}`}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#142B49]/75 hover:bg-[#D9534F] text-white border border-white/20 backdrop-blur-xs flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <X className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2.5 pointer-events-none">
            <p className="text-[9.5px] leading-[1.15] sm:text-xs font-bold text-white drop-shadow-xs truncate">
              {challenge.headline}
            </p>
            <p className="text-[8px] leading-[1.15] sm:text-[10.5px] sm:leading-tight font-medium text-white/85 line-clamp-2 mt-0.5">
              {challenge.prompt}
            </p>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={`Challenge ${challenge.id} ${challenge.headline}: ${challenge.prompt}. Add photo.`}
          className="relative w-full h-full p-1.5 sm:p-3 flex flex-col justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142B49] focus-visible:ring-inset cursor-pointer group overflow-hidden"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 w-5 h-5 sm:w-8 sm:h-8 rounded-full ${theme.orbColor} transition-transform duration-200 group-hover:scale-110`}
          />

          <svg
            aria-hidden="true"
            viewBox="0 0 120 56"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-[46%]"
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

          <div className="relative z-10 flex flex-col gap-0.5">
            <span className="text-[8.5px] sm:text-[11px] font-bold tabular-nums leading-none text-[#142B49]/65">
              {challenge.numberLabel}
            </span>
            <h2 className="text-[9.5px] leading-[1.12] sm:text-xs md:text-[13px] sm:leading-tight font-extrabold text-[#142B49]">
              {challenge.headline}
            </h2>
            <p className="text-[8px] leading-[1.18] sm:text-[11px] sm:leading-snug font-medium text-[#142B49]/80 line-clamp-3">
              {challenge.prompt}
            </p>
          </div>

          <div className="relative z-10 w-full rounded-lg border border-white/80 bg-white/75 group-hover:bg-white/95 backdrop-blur-[2px] py-1 sm:py-2 px-1 flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shadow-[0_1px_4px_rgba(20,43,73,0.06)]">
            <Camera
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#142B49] shrink-0"
              aria-hidden="true"
            />
            <span className="text-[8.5px] sm:text-[11px] font-semibold text-[#142B49] whitespace-nowrap leading-none">
              Add Photo
            </span>
          </div>
        </button>
      )}
    </div>
  );
};
