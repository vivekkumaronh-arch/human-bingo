import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import { normalizeJoiningCode } from '../services/bingoApi';

interface JoinEventScreenProps {
  isValidating: boolean;
  errorMessage: string | null;
  onJoinEvent: (joiningCode: string) => Promise<void>;
  onBack: () => void;
  onClearError: () => void;
}

export const JoinEventScreen: React.FC<JoinEventScreenProps> = ({
  isValidating,
  errorMessage,
  onJoinEvent,
  onBack,
  onClearError,
}) => {
  const [joiningCode, setJoiningCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isValidating) return;

    const normalized = normalizeJoiningCode(joiningCode);
    if (!/^\d{4}$/.test(normalized)) {
      setValidationError('Please enter the 4-digit numeric joining code (e.g. 4821).');
      return;
    }

    setValidationError(null);
    await onJoinEvent(normalized);
  };

  const displayError = validationError || errorMessage;

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_34px_rgba(20,43,73,0.08)]">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-[#4F627A] hover:text-[#142B49] inline-flex items-center gap-1.5 mb-3 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          {/* Mini 3x3 pastel motif */}
          <div className="grid grid-cols-3 gap-1 w-14 mx-auto mb-4" aria-hidden="true">
            <span className="h-3 rounded-sm bg-[#F8D3BC]" />
            <span className="h-3 rounded-sm bg-[#CFE2D3]" />
            <span className="h-3 rounded-sm bg-[#F7E3AC]" />
            <span className="h-3 rounded-sm bg-[#CBDCF0]" />
            <span className="h-3 rounded-sm bg-[#EAC1B2]" />
            <span className="h-3 rounded-sm bg-[#DDD2EE]" />
            <span className="h-3 rounded-sm bg-[#EAE0CF]" />
            <span className="h-3 rounded-sm bg-[#C9E3DF]" />
            <span className="h-3 rounded-sm bg-[#F2CCC5]" />
          </div>

          <header className="text-center">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#258A83]">
              NETWORKING ACTIVITY
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#142B49] leading-tight mt-1">
              JOIN A HUMAN BINGO EVENT
            </h1>
            <p className="text-sm sm:text-base font-medium text-[#4F627A] mt-1.5">
              Enter the 4-digit joining code provided by your event host.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5" noValidate>
            <div>
              <label
                htmlFor="event-joining-code"
                className="block text-xs font-bold text-[#142B49] mb-1.5"
              >
                4-Digit Joining Code <span className="text-[#E25546]">*</span>
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#7D6E5D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="event-joining-code"
                  type="text"
                  inputMode="numeric"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={4}
                  value={joiningCode}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setJoiningCode(digitsOnly);
                    if (validationError) setValidationError(null);
                    if (errorMessage) onClearError();
                  }}
                  placeholder="e.g. 4821"
                  disabled={isValidating}
                  className="w-full min-h-[48px] rounded-xl border border-[#DCE3EC] bg-white pl-10 pr-3.5 py-2.5 text-base font-mono font-bold tracking-[0.25em] text-[#142B49] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-[#8A9BAE] focus:outline-none focus:border-[#258A83] focus:ring-2 focus:ring-[#258A83]/20 disabled:opacity-60"
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
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-[0_4px_14px_rgba(37,138,131,0.28)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-offset-2"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>Validating Code…</span>
                </>
              ) : (
                <>
                  <span>JOIN EVENT</span>
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
