import React, { useEffect } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  completedCount: number;
  title?: string;
  description?: string;
  confirmLabel?: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  completedCount,
  title = 'Reset your photos?',
  description,
  confirmLabel = 'Reset Board',
  isBusy = false,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  const bodyText =
    description ??
    `This will clear ${completedCount} ${
      completedCount === 1 ? 'uploaded photo' : 'uploaded photos'
    } from your current Human Bingo board. This action cannot be undone.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B49]/60 backdrop-blur-xs"
      onClick={() => {
        if (!isBusy) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white border border-[#DCE3EC] shadow-xl p-5 text-[#142B49]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FDF5F3] border border-[#F08B76]/40 text-[#D96D57] flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Close confirmation"
            className="min-w-[40px] min-h-[40px] -mr-2 -mt-2 rounded-xl text-[#5D7088] hover:text-[#142B49] hover:bg-[#F5F7FA] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <h3
          id="reset-dialog-title"
          className="text-base font-bold text-[#142B49] mt-3"
        >
          {title}
        </h3>
        <p className="text-sm text-[#4F627A] mt-1.5 leading-relaxed">{bodyText}</p>

        <div className="flex items-center justify-end gap-2.5 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[#142B49] text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#E25546] hover:bg-[#C94335] text-white text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {isBusy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
