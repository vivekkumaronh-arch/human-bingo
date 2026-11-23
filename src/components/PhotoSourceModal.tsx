import React, { useEffect } from 'react';
import { AlertTriangle, Camera, ImagePlus, X } from 'lucide-react';
import type { ChallengeItem, UploadedPhoto } from '../data/challenges';

interface PhotoSourceModalProps {
  challenge: ChallengeItem | null;
  photo?: UploadedPhoto;
  onClose: () => void;
  onChooseGallery: (challengeId: number) => void;
  onCaptureLive: (challengeId: number) => void;
}

export const PhotoSourceModal: React.FC<PhotoSourceModalProps> = ({
  challenge,
  photo,
  onClose,
  onChooseGallery,
  onCaptureLive,
}) => {
  useEffect(() => {
    if (!challenge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenge, onClose]);

  if (!challenge) return null;

  const isRejected = photo?.verificationStatus === 'rejected';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-source-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B49]/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl sm:rounded-3xl bg-white border border-[#DCE3EC] shadow-xl overflow-hidden text-[#142B49]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#DCE3EC] bg-[#FBF6EE]">
          <div className="min-w-0">
            <span className="text-[11px] font-bold tabular-nums text-[#258A83] tracking-wider uppercase">
              {challenge.numberLabel} · {challenge.headline}
            </span>
            <h3
              id="photo-source-title"
              className="text-sm sm:text-base font-bold text-[#142B49] leading-snug mt-0.5"
            >
              {photo ? 'Replace Challenge Photo' : 'Add Challenge Photo'}
            </h3>
            <p className="text-xs text-[#4F627A] mt-0.5">{challenge.prompt}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo options"
            className="min-w-[36px] min-h-[36px] -mr-1 -mt-0.5 rounded-xl text-[#5D7088] hover:text-[#142B49] hover:bg-white/80 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2.5">
          {isRejected && (
            <div className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3 py-2.5 text-xs text-[#A63A24] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D96D57] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Previous photo was rejected</p>
                {photo?.rejectionReason && (
                  <p className="mt-0.5 text-[#7D2C1A]">{photo.rejectionReason}</p>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const targetId = challenge.id;
              onClose();
              onCaptureLive(targetId);
            }}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_3px_10px_rgba(37,138,131,0.22)]"
          >
            <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Capture Live Photo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetId = challenge.id;
              onClose();
              onChooseGallery(targetId);
            }}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[#142B49] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ImagePlus className="w-4 h-4 text-[#258A83] shrink-0" aria-hidden="true" />
            <span>Choose from Gallery</span>
          </button>
        </div>
      </div>
    </div>
  );
};
