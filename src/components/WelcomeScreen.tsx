import React from 'react';
import { ArrowRight, KeyRound, Loader2, Plus, ShieldCheck } from 'lucide-react';

interface WelcomeScreenProps {
  isCreatingEvent: boolean;
  errorMessage: string | null;
  onCreateNewEvent: () => Promise<void>;
  onJoinExistingEvent: () => void;
  onOpenManageWithCode: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  isCreatingEvent,
  errorMessage,
  onCreateNewEvent,
  onJoinExistingEvent,
  onOpenManageWithCode,
}) => {
  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_34px_rgba(20,43,73,0.08)]">
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
              HUMAN BINGO
            </h1>
            <p className="text-sm sm:text-base font-semibold text-[#142B49]/85 mt-1.5">
              Meet people. Find connections.
            </p>
            <p className="text-xs sm:text-sm text-[#4F627A] mt-1.5 leading-relaxed">
              Launch a new networking session in one tap or join an active game with a joining code.
            </p>
          </header>

          {errorMessage && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-[#F08B76]/50 bg-[#FDF5F3] px-3 py-2 text-xs font-medium text-[#A63A24]"
            >
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onCreateNewEvent}
              disabled={isCreatingEvent}
              className="w-full min-h-[50px] px-4 py-3 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-[0_4px_14px_rgba(37,138,131,0.28)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-offset-2"
            >
              {isCreatingEvent ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>Creating Event…</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>CREATE NEW EVENT</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onJoinExistingEvent}
              disabled={isCreatingEvent}
              className="w-full min-h-[50px] px-4 py-3 rounded-xl bg-[#142B49] hover:bg-[#1E3B63] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-[0_4px_14px_rgba(20,43,73,0.18)] disabled:opacity-60 cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-offset-2"
            >
              <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>JOIN EXISTING EVENT</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Open Management with Private Code */}
        <div className="rounded-2xl bg-white border border-[#DCE3EC] px-4 py-3 shadow-[0_4px_14px_rgba(20,43,73,0.04)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#F5F7FA] border border-[#DCE3EC] text-[#142B49] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#258A83]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#142B49]">Already created an event?</p>
              <p className="text-[11px] text-[#5D7088] truncate">
                Enter your private management code
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenManageWithCode}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-xs font-bold text-[#142B49] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <span>Manage Event</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#258A83] shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
