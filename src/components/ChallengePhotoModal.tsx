import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { ChallengeItem, UploadedPhoto } from '../data/challenges';
import { processImageLocally } from '../utils/imageProcessor';

interface ChallengePhotoModalProps {
  challenge: ChallengeItem | null;
  existingPhoto?: UploadedPhoto;
  isEventClosed: boolean;
  onClose: () => void;
  onOpenCamera: (challengeId: number) => void;
  onSubmitProcessedPhoto: (
    challengeId: number,
    processed: UploadedPhoto,
  ) => Promise<void>;
  onRemovePhoto: (challengeId: number) => Promise<void>;
}

export const ChallengePhotoModal: React.FC<ChallengePhotoModalProps> = ({
  challenge,
  existingPhoto,
  isEventClosed,
  onClose,
  onOpenCamera,
  onSubmitProcessedPhoto,
  onRemovePhoto,
}) => {
  const [stagedPhoto, setStagedPhoto] = useState<UploadedPhoto | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setStagedPhoto(null);
    setIsProcessingFile(false);
    setIsSubmitting(false);
    setIsRemoving(false);
    setLocalError(null);
  }, [challenge?.id]);

  useEffect(() => {
    if (!challenge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting && !isRemoving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenge, isRemoving, isSubmitting, onClose]);

  if (!challenge) return null;

  const isBusy = isProcessingFile || isSubmitting || isRemoving;

  const handleGalleryFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isBusy) return;

    setLocalError(null);
    setIsProcessingFile(true);
    try {
      const processed = await processImageLocally(file);
      setStagedPhoto(processed);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Please choose a JPG, JPEG, or PNG photograph.',
      );
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleSubmitStaged = async () => {
    if (!stagedPhoto || isBusy) return;
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await onSubmitProcessedPhoto(challenge.id, stagedPhoto);
      setStagedPhoto(null);
      onClose();
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Photo upload failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!existingPhoto || isBusy) return;
    setLocalError(null);
    setIsRemoving(true);
    try {
      await onRemovePhoto(challenge.id);
      onClose();
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Could not remove photograph. Please try again.',
      );
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-photo-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#142B49]/75 backdrop-blur-xs"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-[#DCE3EC] shadow-2xl overflow-hidden text-[#142B49] max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-[#DCE3EC] bg-[#FBF6EE] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#218F87] tabular-nums">
                CHALLENGE {challenge.numberLabel}
              </span>
              {existingPhoto && !stagedPhoto && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#DEF1EE] px-2 py-0.5 text-[10px] font-bold text-[#1B6E68]">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  <span>Completed</span>
                </span>
              )}
            </div>
            <h2
              id="challenge-photo-modal-title"
              className="font-display text-lg font-extrabold text-[#172E4D] leading-snug mt-0.5"
            >
              {challenge.headline}
            </h2>
            <p className="text-xs sm:text-sm text-[#4F6075] mt-1 leading-relaxed">
              {challenge.prompt}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close challenge modal"
            className="min-w-[40px] min-h-[40px] -mr-1 -mt-0.5 rounded-xl text-[#5D7088] hover:text-[#172E4D] hover:bg-white/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex flex-col gap-3.5">
          {localError && (
            <div
              role="alert"
              className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 flex items-start gap-2 text-xs font-medium text-[#A63A24]"
            >
              <AlertCircle className="w-4 h-4 text-[#D96D57] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{localError}</span>
            </div>
          )}

          {stagedPhoto ? (
            <>
              <div className="rounded-2xl bg-[#142B49] p-2 border border-[#DCE3EC]">
                <div className="w-full aspect-square max-h-[46vh] mx-auto rounded-xl overflow-hidden bg-black/30 flex items-center justify-center">
                  <img
                    src={stagedPhoto.dataUrl}
                    alt={`Selected preview for ${challenge.headline}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <p className="text-xs text-center text-[#4F6075]">
                Preview your photo before submitting it to the shared Photo Wall.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSubmitStaged}
                  disabled={isBusy || isEventClosed}
                  className="w-full min-h-[50px] px-4 py-3 rounded-2xl bg-[#218F87] hover:bg-[#19756E] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-[0_6px_16px_rgba(33,143,135,0.28)] cursor-pointer disabled:opacity-55"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                      <span>Submitting Photo…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Submit Photo</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStagedPhoto(null);
                    setLocalError(null);
                  }}
                  disabled={isBusy}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[#172E4D] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 text-[#218F87]" aria-hidden="true" />
                  <span>Choose Another Photo</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {existingPhoto && (
                <div className="rounded-2xl bg-[#142B49] p-2 border border-[#DCE3EC]">
                  <div className="w-full aspect-square max-h-[42vh] mx-auto rounded-xl overflow-hidden bg-black/30 flex items-center justify-center">
                    <img
                      src={existingPhoto.dataUrl}
                      alt={`Submitted photo for ${challenge.headline}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {isEventClosed ? (
                <div className="rounded-xl bg-[#F4F6F8] border border-[#DCE3EC] px-3.5 py-3 text-xs text-[#4F6075] text-center">
                  This game has ended. New photo submissions and edits are disabled.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      const targetId = challenge.id;
                      onClose();
                      onOpenCamera(targetId);
                    }}
                    className="w-full min-h-[52px] px-4 py-3 rounded-2xl bg-[#218F87] hover:bg-[#19756E] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-[0_6px_16px_rgba(33,143,135,0.26)] cursor-pointer disabled:opacity-55"
                  >
                    <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {existingPhoto ? 'Retake with Camera' : 'Take Live Photo'}
                    </span>
                  </button>

                  <label className="w-full min-h-[52px] px-4 py-3 rounded-2xl border border-[#DCE3EC] bg-[#FBF6EE] hover:bg-[#F5EDE0] text-[#172E4D] text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    {isProcessingFile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#218F87]" aria-hidden="true" />
                        <span>Preparing Preview…</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-4 h-4 text-[#218F87]" aria-hidden="true" />
                        <span>
                          {existingPhoto ? 'Choose Another from Gallery' : 'Choose from Gallery'}
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleGalleryFileChange}
                      disabled={isBusy}
                      className="sr-only"
                    />
                  </label>

                  {existingPhoto && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={isBusy}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#F08B76]/45 bg-[#FDF5F3] hover:bg-[#FCE8E3] text-[#A63A24] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isRemoving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          <span>Removing…</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove Submitted Photo</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
