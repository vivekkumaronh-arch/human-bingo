import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ImagePlus,
  Trash2,
  X,
} from 'lucide-react';
import type { ChallengeItem, UploadedPhoto } from '../data/challenges';

interface PhotoPreviewModalProps {
  challenge: ChallengeItem | null;
  photo?: UploadedPhoto;
  isEventClosed?: boolean;
  onClose: () => void;
  onChooseGallery: (challengeId: number) => void;
  onCaptureLive: (challengeId: number) => void;
  onRemovePhoto: (challengeId: number) => void;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  challenge,
  photo,
  isEventClosed = false,
  onClose,
  onChooseGallery,
  onCaptureLive,
  onRemovePhoto,
}) => {
  useEffect(() => {
    if (!challenge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenge, onClose]);

  if (!challenge || !photo) return null;

  const status = photo.verificationStatus ?? 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const canModify = !isEventClosed && !isApproved;

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
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#DCE3EC]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tabular-nums text-[#258A83]">
                {challenge.numberLabel} · {challenge.headline}
              </span>
              {isApproved ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#CFE2D3]/70 px-2 py-0.5 text-[10px] font-bold text-[#1E6245]">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  <span>Approved</span>
                </span>
              ) : isRejected ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FAE7E2] px-2 py-0.5 text-[10px] font-bold text-[#A63A24]">
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  <span>Rejected</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#9A5B13]">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>Pending Review</span>
                </span>
              )}
            </div>
            <h3
              id="preview-dialog-title"
              className="text-sm sm:text-base font-semibold text-[#142B49] leading-snug mt-1"
            >
              {challenge.prompt}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="min-w-[40px] min-h-[40px] -mr-1.5 -mt-1 rounded-xl text-[#5D7088] hover:text-[#142B49] hover:bg-[#F5F7FA] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 bg-[#F5F7FA] flex flex-col gap-3">
          <div className="w-full max-h-[50vh] rounded-xl overflow-hidden bg-white border border-[#DCE3EC] flex items-center justify-center">
            <img
              src={photo.dataUrl}
              alt={`Challenge ${challenge.id}: ${challenge.prompt}`}
              referrerPolicy="no-referrer"
              className="w-full max-h-[50vh] object-contain"
            />
          </div>

          {isRejected && (
            <div className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 text-xs text-[#A63A24] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D96D57] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Organiser Feedback — Replacement Required</p>
                <p className="mt-0.5 text-[#7D2C1A]">
                  {photo.rejectionReason
                    ? photo.rejectionReason
                    : 'This submission was marked invalid by the organiser. Please upload or capture a new photograph.'}
                </p>
              </div>
            </div>
          )}

          {isApproved && (
            <div className="rounded-xl border border-[#B8D1BE] bg-[#F1F8F3] px-3.5 py-2.5 text-xs text-[#1E6245] flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#258A83] shrink-0" aria-hidden="true" />
              <span>Verified and approved by the organiser.</span>
            </div>
          )}
        </div>

        {canModify ? (
          <div className="flex flex-wrap items-center gap-2 p-4 border-t border-[#DCE3EC] bg-white">
            <button
              type="button"
              onClick={() => {
                const targetId = challenge.id;
                onClose();
                onChooseGallery(targetId);
              }}
              className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[#142B49] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 shrink-0 text-[#258A83]" aria-hidden="true" />
              <span>Choose from Gallery</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const targetId = challenge.id;
                onClose();
                onCaptureLive(targetId);
              }}
              className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Capture Live Photo</span>
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
        ) : (
          <div className="p-4 border-t border-[#DCE3EC] bg-white flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-xs sm:text-sm font-semibold text-[#142B49] cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
