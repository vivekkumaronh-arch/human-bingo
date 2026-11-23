import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Edit3,
  Loader2,
  Share2,
  Sparkles,
} from 'lucide-react';
import { buildEventInvitationText } from '../services/bingoApi';
import type { EventConfig } from '../types/multiplayer';
import { EventExpiryCountdown } from './EventExpiryCountdown';

interface GameCreatedScreenProps {
  event: EventConfig;
  isUpdatingTitle: boolean;
  onUpdateTitle: (title: string) => Promise<void>;
  onStartPlaying: (joiningCode: string) => void;
  onBackToHome: () => void;
}

export const GameCreatedScreen: React.FC<GameCreatedScreenProps> = ({
  event,
  isUpdatingTitle,
  onUpdateTitle,
  onStartPlaying,
  onBackToHome,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(event.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleSaved, setTitleSaved] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(event.joining_code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard may be blocked in restricted contexts
    }
  };

  const handleShareInvitation = async () => {
    const appUrl =
      typeof window !== 'undefined' ? window.location.origin : undefined;
    const text = buildEventInvitationText({
      eventTitle: event.title,
      joiningCode: event.joining_code,
      appUrl,
    });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: event.title || 'Human Bingo',
          text,
        });
        setShareFeedback('Invitation shared!');
        window.setTimeout(() => setShareFeedback(null), 2400);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback('Invitation copied to clipboard!');
      window.setTimeout(() => setShareFeedback(null), 2600);
    } catch {
      setShareFeedback(`Share code ${event.joining_code} with your players.`);
      window.setTimeout(() => setShareFeedback(null), 3200);
    }
  };

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftTitle.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      setTitleError('Please enter at least 2 characters for the game name.');
      return;
    }
    setTitleError(null);
    try {
      await onUpdateTitle(trimmed);
      setIsEditingTitle(false);
      setTitleSaved(true);
      window.setTimeout(() => setTitleSaved(false), 2200);
    } catch (err) {
      setTitleError(
        err instanceof Error ? err.message : 'Could not update game name.',
      );
    }
  };

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col">
      <header className="w-full max-w-lg mx-auto px-4 pt-4 pb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToHome}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs sm:text-sm font-semibold text-[#172E4D] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Back to Home</span>
        </button>

        <span className="text-[11px] font-bold tracking-[0.16em] text-[#218F87] uppercase">
          HUMAN BINGO
        </span>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 py-4 sm:px-6 sm:py-6 flex flex-col justify-center">
        <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_32px_rgba(23,46,77,0.08)] flex flex-col gap-4">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#DEF1EE] px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-[#1B6E68]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>ACTIVE FOR 48 HOURS</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172E4D] mt-2.5">
              YOUR GAME IS READY!
            </h1>

            {/* Optional Game Name Display / Quick Edit */}
            {!isEditingTitle ? (
              <div className="mt-1.5 inline-flex items-center justify-center gap-1.5 max-w-full">
                <p className="text-sm font-semibold text-[#4F6075] truncate">
                  {event.title}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDraftTitle(event.title);
                    setTitleError(null);
                    setIsEditingTitle(true);
                  }}
                  aria-label="Rename game"
                  className="p-1.5 rounded-lg text-[#218F87] hover:bg-white/80 transition-colors cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                {titleSaved && (
                  <span className="text-[11px] font-bold text-[#218F87]">Saved</span>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSaveTitle}
                className="mt-2.5 flex flex-col gap-1.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => {
                      setDraftTitle(e.target.value);
                      if (titleError) setTitleError(null);
                    }}
                    maxLength={80}
                    placeholder="Optional game name"
                    className="flex-1 min-w-0 min-h-[42px] rounded-xl border border-[#DCE3EC] bg-white px-3 text-sm font-medium text-[#172E4D] focus:outline-none focus:border-[#218F87]"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingTitle}
                    className="min-h-[42px] px-3.5 rounded-xl bg-[#218F87] hover:bg-[#19756E] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isUpdatingTitle ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      'Save'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    disabled={isUpdatingTitle}
                    className="min-h-[42px] px-3 rounded-xl border border-[#DCE3EC] bg-white text-xs font-semibold text-[#4F6075] cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
                {titleError && (
                  <p className="text-xs font-medium text-[#A63A24]">{titleError}</p>
                )}
              </form>
            )}
          </div>

          {/* Prominent 4-Digit Joining Code Card */}
          <div className="rounded-2xl bg-white border border-[#DCE3EC] p-4 sm:p-5 text-center shadow-[0_4px_14px_rgba(23,46,77,0.05)]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#4F6075] uppercase">
              GAME JOINING CODE
            </p>
            <p
              aria-label={`Game Joining Code ${event.joining_code}`}
              className="mt-1.5 font-mono text-4xl sm:text-5xl font-extrabold tracking-[0.22em] text-[#172E4D] tabular-nums pl-[0.22em]"
            >
              {event.joining_code}
            </p>
            <p className="mt-2 text-xs text-[#5A6B80]">
              Share this 4-digit code so players can join in seconds.
            </p>
          </div>

          {/* Copy Code & Share Invitation */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#172E4D] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 text-[#218F87] shrink-0" aria-hidden="true" />
                  <span>Copied Code</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#218F87] shrink-0" aria-hidden="true" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareInvitation}
              className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#218F87]/35 bg-[#E6F4F2] hover:bg-[#D5ECE9] text-[#145B56] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#218F87] shrink-0" aria-hidden="true" />
              <span>Share Invitation</span>
            </button>
          </div>

          {shareFeedback && (
            <p
              role="status"
              className="text-center text-xs font-semibold text-[#1B6E68] bg-[#DEF1EE] rounded-xl px-3 py-2"
            >
              {shareFeedback}
            </p>
          )}

          {/* 48-hour expiry countdown */}
          <EventExpiryCountdown
            expiresAt={event.expires_at}
            status={event.status}
            variant="compact"
          />

          {/* Primary Start Playing Action */}
          <button
            type="button"
            onClick={() => onStartPlaying(event.joining_code)}
            className="w-full min-h-[52px] px-5 py-3.5 rounded-2xl bg-[#218F87] hover:bg-[#19756E] text-white text-sm sm:text-base font-bold tracking-wide inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_6px_18px_rgba(33,143,135,0.28)] cursor-pointer"
          >
            <span>Start Playing</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>

          <p className="text-center text-[11px] text-[#5A6B80] leading-relaxed">
            As the game creator, you can share this code or end the game anytime from the{' '}
            <strong className="text-[#172E4D]">Players</strong> tab in this browser.
          </p>
        </div>
      </main>
    </div>
  );
};
