import React, { useEffect, useRef } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import type { ChallengeItem, UploadedPhoto } from '../data/challenges';

interface PhotoPreviewModalProps {
  challenge: ChallengeItem | null;
  photo?: UploadedPhoto;
  onClose: () => void;
  onSelectFile: (challengeId: number, file: File) => Promise<void>;
  onRemovePhoto: (challengeId: number) => void;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  challenge,
  photo,
  onClose,
  onSelectFile,
  onRemovePhoto,
}) => {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!challenge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenge, onClose]);

  if (!challenge || !photo) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await onSelectFile(challenge.id, file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B49]/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#DCE3EC] shadow-xl overflow-hidden text-[#142B49]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={uploadInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={handleFileChange}
          className="sr-only"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          capture="environment"
          onChange={handleFileChange}
          className="sr-only"
        />

        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#DCE3EC]">
          <div>
            <span className="text-xs font-bold tabular-nums text-[#258A83]">
              Challenge {challenge.numberLabel}
            </span>
            <h3
              id="preview-dialog-title"
              className="text-sm sm:text-base font-semibold text-[#142B49] leading-snug mt-0.5"
            >
              {challenge.prompt}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="min-w-[40px] min-h-[40px] -mr-1.5 -mt-1 rounded-xl text-[#5D7088] hover:text-[#142B49] hover:bg-[#F5F7FA] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 bg-[#F5F7FA]">
          <div className="w-full max-h-[55vh] rounded-xl overflow-hidden bg-white border border-[#DCE3EC] flex items-center justify-center">
            <img
              src={photo.dataUrl}
              alt={`Challenge ${challenge.id}: ${challenge.prompt}`}
              referrerPolicy="no-referrer"
              className="w-full max-h-[55vh] object-contain"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-[#DCE3EC] bg-white">
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[#142B49] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <ImagePlus className="w-4 h-4 shrink-0 text-[#258A83]" aria-hidden="true" />
            <span>Replace</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRemovePhoto(challenge.id);
              onClose();
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#F08B76]/50 bg-[#FDF5F3] hover:bg-[#FAE7E3] text-[#B8432E] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
};
