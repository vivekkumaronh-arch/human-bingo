import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { normalizeManagementCode } from '../services/bingoApi';

interface ManageCodeScreenProps {
  isValidating: boolean;
  errorMessage: string | null;
  onValidateManagementCode: (code: string) => Promise<void>;
  onClearError: () => void;
  onBack: () => void;
}

export const ManageCodeScreen: React.FC<ManageCodeScreenProps> = ({
  isValidating,
  errorMessage,
  onValidateManagementCode,
  onClearError,
  onBack,
}) => {
  const [managementCode, setManagementCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidating) return;

    const normalized = normalizeManagementCode(managementCode);
    if (!/^\d{4}$/.test(normalized) && !/^MGT-[A-Z0-9-]+$/.test(normalized)) {
      setValidationError('Please enter your 4-digit private management code.');
      return;
    }

    setValidationError(null);
    await onValidateManagementCode(normalized);
  };

  const displayError = validationError || errorMessage;

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="rounded-3xl bg-white border border-[#DCE3EC] p-5 sm:p-7 shadow-[0_12px_34px_rgba(20,43,73,0.08)]">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-[#4F627A] hover:text-[#142B49] inline-flex items-center gap-1.5 mb-4 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2 text-[#258A83] mb-1">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-[0.18em]">
              EVENT MANAGEMENT
            </span>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#142B49]">
            Manage Existing Event
          </h1>
          <p className="text-xs sm:text-sm text-[#4F627A] mt-1">
            Enter the 4-digit private management code generated when your event was created.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5" noValidate>
            <div>
              <label
                htmlFor="private-management-code"
                className="block text-xs font-bold text-[#142B49] mb-1.5"
              >
                4-Digit Private Management Code <span className="text-[#E25546]">*</span>
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#7D6E5D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="private-management-code"
                  type="password"
                  inputMode="numeric"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                  value={managementCode}
                  onChange={(e) => {
                    setManagementCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
                    if (validationError) setValidationError(null);
                    if (errorMessage) onClearError();
                  }}
                  placeholder="Enter 4-digit code (e.g. 7392)"
                  disabled={isValidating}
                  className="w-full min-h-[48px] rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] pl-10 pr-3.5 py-2.5 text-base font-mono font-bold tracking-[0.25em] text-[#142B49] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-[#8A9BAE] focus:bg-white focus:outline-none focus:border-[#258A83] focus:ring-2 focus:ring-[#258A83]/20 disabled:opacity-60"
                />
              </div>
            </div>

            {displayError && (
              <p
                role="alert"
                className="rounded-xl border border-[#F08B76]/50 bg-[#FDF5F3] px-3 py-2 text-xs font-medium text-[#A63A24]"
              >
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={isValidating}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#142B49] hover:bg-[#1E3B63] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors shadow-[0_4px_14px_rgba(20,43,73,0.18)] disabled:opacity-60 cursor-pointer"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>Verifying Code…</span>
                </>
              ) : (
                <>
                  <span>OPEN EVENT MANAGEMENT</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
