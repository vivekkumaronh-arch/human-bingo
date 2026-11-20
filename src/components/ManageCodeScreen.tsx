import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { normalizeManagementCode } from '../services/bingoApi';
import type { ManagedEventSummary } from '../types/multiplayer';

interface ManageCodeScreenProps {
  isValidating: boolean;
  errorMessage: string | null;
  recentEvents: ManagedEventSummary[];
  onValidateManagementCode: (code: string) => Promise<void>;
  onOpenRecentEvent: (event: ManagedEventSummary) => void;
  onClearError: () => void;
  onBack: () => void;
}

export const ManageCodeScreen: React.FC<ManageCodeScreenProps> = ({
  isValidating,
  errorMessage,
  recentEvents,
  onValidateManagementCode,
  onOpenRecentEvent,
  onClearError,
  onBack,
}) => {
  const [managementCode, setManagementCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidating) return;

    const normalized = normalizeManagementCode(managementCode);
    if (normalized.length < 8) {
      setValidationError('Please enter your private management code.');
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
            Enter the private management code generated when your event was created.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5" noValidate>
            <div>
              <label
                htmlFor="private-management-code"
                className="block text-xs font-bold text-[#142B49] mb-1.5"
              >
                Private Management Code <span className="text-[#E25546]">*</span>
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#7D6E5D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="private-management-code"
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={32}
                  value={managementCode}
                  onChange={(e) => {
                    setManagementCode(e.target.value.toUpperCase());
                    if (validationError) setValidationError(null);
                    if (errorMessage) onClearError();
                  }}
                  placeholder="e.g. MGT-8F2K-9Q3P"
                  disabled={isValidating}
                  className="w-full min-h-[48px] rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] pl-10 pr-3.5 py-2.5 text-sm sm:text-base font-mono font-bold tracking-wider text-[#142B49] uppercase placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-[#8A9BAE] focus:bg-white focus:outline-none focus:border-[#258A83] focus:ring-2 focus:ring-[#258A83]/20 disabled:opacity-60"
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

          {recentEvents.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#EEF2F6]">
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#7D6E5D] mb-2">
                Events Created on This Device
              </p>
              <div className="flex flex-col gap-2">
                {recentEvents.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => onOpenRecentEvent(evt)}
                    className="w-full rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#142B49] truncate">
                        {evt.title}
                      </p>
                      <p className="text-[11px] font-mono text-[#4F627A]">
                        {evt.joining_code} · {evt.participant_count} joined
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                        evt.status === 'active'
                          ? 'bg-[#CFE2D3]/70 text-[#1E6245]'
                          : 'bg-[#E6ECF3] text-[#4F627A]'
                      }`}
                    >
                      {evt.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
