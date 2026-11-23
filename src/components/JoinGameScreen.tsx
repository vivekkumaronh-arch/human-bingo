import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, Loader2, User } from 'lucide-react';

interface JoinGameScreenProps {
  initialCode?: string;
  isJoining: boolean;
  errorMessage: string | null;
  onJoinGame: (joiningCode: string, fullName: string) => Promise<void>;
  onClearError: () => void;
  onBack: () => void;
}

export const JoinGameScreen: React.FC<JoinGameScreenProps> = ({
  initialCode = '',
  isJoining,
  errorMessage,
  onJoinGame,
  onClearError,
  onBack,
}) => {
  const [joiningCode, setJoiningCode] = useState(() =>
    initialCode.replace(/\D/g, '').slice(0, 4),
  );
  const [fullName, setFullName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const cleaned = initialCode.replace(/\D/g, '').slice(0, 4);
    if (cleaned) {
      setJoiningCode(cleaned);
    }
  }, [initialCode]);

  const handleCodeChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 4);
    setJoiningCode(digitsOnly);
    if (localError) setLocalError(null);
    if (errorMessage) onClearError();
  };

  const handleNameChange = (value: string) => {
    setFullName(value);
    if (localError) setLocalError(null);
    if (errorMessage) onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoining) return;

    const cleanCode = joiningCode.replace(/\D/g, '');
    if (!/^\d{4}$/.test(cleanCode)) {
      setLocalError('Please enter the 4-digit numeric game joining code.');
      return;
    }

    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) {
      setLocalError('Please enter your name (at least 2 characters).');
      return;
    }

    setLocalError(null);
    await onJoinGame(cleanCode, cleanName);
  };

  const displayedError = localError || errorMessage;

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col">
      <header className="w-full max-w-md mx-auto px-4 pt-4 pb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isJoining}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs sm:text-sm font-semibold text-[#172E4D] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Back</span>
        </button>

        <span className="text-[11px] font-bold tracking-[0.16em] text-[#218F87] uppercase">
          HUMAN BINGO
        </span>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-3.5 py-4 sm:px-6 flex flex-col justify-center">
        <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_32px_rgba(23,46,77,0.08)]">
          <div className="text-center mb-5">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#218F87] uppercase">
              ENTER CODE &amp; NAME
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172E4D] mt-1">
              JOIN HUMAN BINGO
            </h1>
            <p className="text-xs sm:text-sm text-[#4F6075] mt-1.5">
              Enter the 4-digit game code and your name to start playing right away.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="join-code-input"
                className="block text-xs font-bold tracking-wider uppercase text-[#172E4D] mb-1.5"
              >
                4-Digit Joining Code
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#218F87] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="join-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  autoComplete="one-time-code"
                  maxLength={4}
                  value={joiningCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  disabled={isJoining}
                  placeholder="4829"
                  className="w-full min-h-[52px] rounded-2xl border border-[#DCE3EC] bg-white pl-10 pr-4 font-mono text-xl sm:text-2xl font-extrabold tracking-[0.28em] text-[#172E4D] placeholder:text-[#A4B2C2] placeholder:font-normal placeholder:tracking-[0.2em] focus:outline-none focus:border-[#218F87] focus:ring-2 focus:ring-[#218F87]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="join-name-input"
                className="block text-xs font-bold tracking-wider uppercase text-[#172E4D] mb-1.5"
              >
                Your Name
              </label>
              <div className="relative">
                <User
                  className="w-4 h-4 text-[#218F87] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="join-name-input"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={isJoining}
                  placeholder="Enter your name"
                  className="w-full min-h-[52px] rounded-2xl border border-[#DCE3EC] bg-white pl-10 pr-4 text-sm sm:text-base font-semibold text-[#172E4D] placeholder:text-[#9AA8B8] placeholder:font-normal focus:outline-none focus:border-[#218F87] focus:ring-2 focus:ring-[#218F87]/20 transition-all"
                />
              </div>
            </div>

            {displayedError && (
              <div
                role="alert"
                className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 flex items-start gap-2 text-xs sm:text-sm font-medium text-[#A63A24]"
              >
                <AlertCircle className="w-4 h-4 text-[#D96D57] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{displayedError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining}
              className="mt-1 w-full min-h-[54px] px-5 py-3.5 rounded-2xl bg-[#218F87] hover:bg-[#19756E] text-white text-sm sm:text-base font-bold tracking-wide inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_6px_18px_rgba(33,143,135,0.28)] cursor-pointer"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>Joining Game…</span>
                </>
              ) : (
                <>
                  <span>JOIN GAME</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
