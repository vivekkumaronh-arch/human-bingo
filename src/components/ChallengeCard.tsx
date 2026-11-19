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

// Ultra-subtle corporate pastel washes rotating cleanly across the 9 cards
const CARD_TINTS = [
  'bg-gradient-to-b from-white to-[#F7FAFD]', // subtle navy tint
  'bg-gradient-to-b from-white to-[#F3FAF9]', // subtle teal tint
  'bg-gradient-to-b from-white to-[#FDF7F5]', // subtle coral tint
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
  const tintClass = CARD_TINTS[(challenge.id - 1) % CARD_TINTS.length];
  const numberAccentClass =
    (challenge.id - 1) % 3 === 2 ? 'text-[#D96D57]' : 'text-[#258A83]';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative aspect-[1/1.16] sm:aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl border transition-all duration-150 ${
        isDragging
          ? 'border-[#258A83] ring-2 ring-[#258A83]/25 bg-[#F3FAF9]'
          : isCompleted
            ? 'border-[#258A83]/60 bg-white shadow-[0_3px_12px_rgba(20,43,73,0.08)]'
            : `border-[#DCE3EC] ${tintClass} hover:border-[#258A83]/60 shadow-[0_2px_8px_rgba(20,43,73,0.04)]`
      }`}
    >
      {/* Independent local file input supporting both camera and gallery on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleFileChange}
        className="sr-only"
        aria-label={`Add photo for challenge ${challenge.id}`}
      />

      {isProcessing ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#142B49]/70 p-2 bg-white">
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#258A83]" aria-hidden="true" />
          <span className="text-[10px] sm:text-xs font-medium">Loading…</span>
        </div>
      ) : photo ? (
        <>
          {/* Full-bleed cropped photo */}
          <button
            type="button"
            onClick={() => onPreviewPhoto(challenge.id)}
            className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-inset cursor-pointer group"
            aria-label={`View or replace photo for challenge ${challenge.id}: ${challenge.prompt}`}
          >
            <img
              src={photo.dataUrl}
              alt={`Challenge ${challenge.id}: ${challenge.prompt}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
            {/* Refined deep navy scrim for crisp white text readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#0D1E35]/90 via-[#0D1E35]/40 to-[#0D1E35]/10 pointer-events-none"
              aria-hidden="true"
            />
          </button>

          {/* Top-left numbered indicator */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 pointer-events-none">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-[#142B49]/80 backdrop-blur-xs px-1.5 py-0.5 text-[9px] sm:text-[11px] font-bold tabular-nums text-white border border-white/15">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#4FD1C5] stroke-[2.75]" aria-hidden="true" />
              {challenge.numberLabel}
            </span>
          </div>

          {/* Top-right discreet replace & remove controls */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center gap-1 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Replace photo"
              aria-label={`Replace photo for challenge ${challenge.id}`}
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
              aria-label={`Remove photo for challenge ${challenge.id}`}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#142B49]/75 hover:bg-[#D9534F] text-white border border-white/20 backdrop-blur-xs flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <X className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Bottom challenge question overlay */}
          <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2.5 pointer-events-none">
            <p className="text-[9.5px] leading-[1.2] sm:text-xs sm:leading-snug font-medium text-white drop-shadow-xs line-clamp-4">
              {challenge.prompt}
            </p>
          </div>
        </>
      ) : (
        /* Entire card/upload area clickable */
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={`Challenge ${challenge.id}: ${challenge.prompt}. Add photo.`}
          className="w-full h-full p-1.5 sm:p-3 flex flex-col justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-inset cursor-pointer group"
        >
          {/* Numbered indicator + Question */}
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className={`text-[9.5px] sm:text-xs font-bold tabular-nums leading-none ${numberAccentClass}`}>
              {challenge.numberLabel}
            </span>
            <p className="text-[9.5px] leading-[1.22] sm:text-xs md:text-[13px] sm:leading-snug font-semibold text-[#142B49]">
              {challenge.prompt}
            </p>
          </div>

          {/* Compact upload area */}
          <div className="w-full rounded-lg border border-dashed border-[#CBD6E4] group-hover:border-[#258A83] bg-white/80 group-hover:bg-[#258A83]/[0.06] py-1.5 sm:py-2.5 px-1 flex items-center justify-center gap-1 sm:gap-1.5 transition-colors">
            <Camera
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#258A83] shrink-0"
              aria-hidden="true"
            />
            <span className="text-[9px] sm:text-[11px] font-semibold text-[#142B49]/85 group-hover:text-[#258A83] whitespace-nowrap leading-none transition-colors">
              Add Photo
            </span>
          </div>
        </button>
      )}
    </div>
  );
};
