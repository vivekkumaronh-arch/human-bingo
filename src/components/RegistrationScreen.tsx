import React, { useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  KeyRound,
  Loader2,
  Trophy,
  Users,
} from 'lucide-react';
import { getEffectiveEventStatus } from '../services/bingoApi';
import type { EventConfig } from '../types/multiplayer';

interface RegistrationScreenProps {
  activeEvent: EventConfig;
  participantCount: number;
  maxParticipants: number | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onRegister: (fullName: string) => Promise<void>;
  onChangeJoiningCode: () => void;
  onOpenLeaderboard: () => void;
}

export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({
  activeEvent,
  participantCount,
  maxParticipants,
  isSubmitting,
  errorMessage,
  onRegister,
  onChangeJoiningCode,
  onOpenLeaderboard,
}) => {
  const [fullName, setFullName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const effectiveStatus = getEffectiveEventStatus(activeEvent);
  const isExpired = effectiveStatus === 'expired';
  const isClosed = effectiveStatus !== 'active';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isClosed) return;

    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      setValidationError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (trimmed.length > 80) {
      setValidationError('Name must be 80 characters or fewer.');
      return;
    }

    setValidationError(null);
    await onRegister(trimmed);
  };

  const displayError =
    validationError ||
    errorMessage ||
    (isExpired
      ? 'This event has expired.'
      : isClosed
        ? 'This event has been closed and is no longer accepting new participants.'
        : null);

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Warm Cream / Ivory Event Card */}
        <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_34px_rgba(20,43,73,0.08)]">
          {/* Active Joining Code Strip */}
          <div className="mb-4 rounded-2xl bg-white/85 border border-[#EAE0CF] px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <KeyRound className="w-3.5 h-3.5 text-[#258A83] shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] text-[#7D6E5D] truncate">
                  {activeEvent.title}
                </p>
                <p className="text-xs font-mono font-bold text-[#142B49]">
                  {activeEvent.joining_code}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onChangeJoiningCode}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] px-2.5 py-1 text-[11px] font-semibold text-[#142B49] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
              <span>Change Code</span>
            </button>
          </div>

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
              NETWORKING CHALLENGE
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#142B49] leading-tight mt-1">
              WELCOME TO HUMAN BINGO
            </h1>
            <p className="text-sm sm:text-base font-semibold text-[#142B49]/85 mt-1.5">
              Meet people. Find connections.
            </p>
            <p className="text-xs sm:text-sm text-[#4F627A] mt-1.5 leading-relaxed">
              Complete 9 networking photo prompts, create your collage, and see where you finish on the live leaderboard.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5" noValidate>
            <div>
              <label
                htmlFor="participant-full-name"
                className="block text-xs font-bold text-[#142B49] mb-1.5"
              >
                Full Name <span className="text-[#E25546]">*</span>
              </label>
              <input
                id="participant-full-name"
                type="text"
                required
                autoComplete="name"
                maxLength={80}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Enter your full name"
                disabled={isSubmitting || isClosed}
                className="w-full min-h-[46px] rounded-xl border border-[#DCE3EC] bg-white px-3.5 py-2.5 text-sm font-medium text-[#142B49] placeholder:text-[#8A9BAE] focus:outline-none focus:border-[#258A83] focus:ring-2 focus:ring-[#258A83]/20 disabled:opacity-60"
              />
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
              disabled={isSubmitting || isClosed}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-[0_4px_14px_rgba(37,138,131,0.28)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-offset-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>Starting Session…</span>
                </>
              ) : (
                <>
                  <span>START CHALLENGE</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#EAE0CF] flex items-center justify-between gap-2 text-xs text-[#4F627A]">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Users className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
              <span>
                {participantCount} joined
                {maxParticipants ? ` / ${maxParticipants}` : ''}
              </span>
            </span>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex items-center gap-1 font-semibold text-[#142B49] hover:text-[#258A83] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trophy className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
              <span>Live Leaderboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
