import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { buildEventInvitationText, getEffectiveEventStatus } from '../services/bingoApi';
import type { EventConfig } from '../types/multiplayer';
import { EventExpiryCountdown } from './EventExpiryCountdown';

interface EventCreatedScreenProps {
  event: EventConfig;
  managementCode: string;
  isOpeningManagement?: boolean;
  managementError?: string | null;
  onOpenManagement: () => void;
  onBackToWelcome: () => void;
}

export const EventCreatedScreen: React.FC<EventCreatedScreenProps> = ({
  event,
  managementCode,
  isOpeningManagement = false,
  managementError = null,
  onOpenManagement,
  onBackToWelcome,
}) => {
  const [copiedType, setCopiedType] = useState<'join' | 'manage' | null>(null);
  const [showPrivateCode, setShowPrivateCode] = useState(true);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const effectiveStatus = getEffectiveEventStatus(event);
  const hasCustomTitle =
    Boolean(event.title?.trim()) &&
    event.title.trim() !== 'Human Bingo Networking Challenge';

  const handleCopy = async (type: 'join' | 'manage', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(type);
      window.setTimeout(() => {
        setCopiedType((prev) => (prev === type ? null : prev));
      }, 2200);
    } catch {
      // Clipboard permission unavailable
    }
  };

  const handleShareEvent = async () => {
    const shareUrl =
      typeof window !== 'undefined' &&
      window.location?.origin &&
      window.location.origin.startsWith('http')
        ? window.location.origin
        : undefined;

    const invitationText = buildEventInvitationText({
      eventTitle: event.title,
      joiningCode: event.joining_code,
      appUrl: shareUrl,
    });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Human Bingo Event Invitation',
          text: invitationText,
          ...(shareUrl ? { url: shareUrl } : {}),
        });
        setShareFeedback('Invitation shared!');
        window.setTimeout(() => setShareFeedback(null), 2600);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Fall through to clipboard copy fallback if Web Share fails
      }
    }

    try {
      await navigator.clipboard.writeText(invitationText);
      setShareFeedback('Invitation copied to clipboard!');
      window.setTimeout(() => setShareFeedback(null), 2800);
    } catch {
      setShareFeedback('Could not copy invitation automatically.');
      window.setTimeout(() => setShareFeedback(null), 2800);
    }
  };

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col">
      <header className="w-full max-w-md mx-auto px-4 pt-5 pb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToWelcome}
          className="min-h-[44px] px-2 -ml-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#4F6075] hover:text-[#172E4D] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] rounded-lg"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Home</span>
        </button>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wider uppercase ${
            effectiveStatus === 'active'
              ? 'bg-[#CFE2D3]/80 text-[#1E6245]'
              : 'bg-[#FCE8E3] text-[#A63A24]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{effectiveStatus === 'active' ? 'ACTIVE' : 'CLOSED'}</span>
        </span>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-8 pt-1 flex flex-col gap-4">
        <section className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_34px_rgba(23,46,77,0.07)]">
          <header className="text-center">
            <h1 className="font-display text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-[#172E4D]">
              Your Event Is Ready!
            </h1>
            {hasCustomTitle && (
              <p className="mt-1 text-sm font-bold text-[#218F87] break-words">
                {event.title}
              </p>
            )}
          </header>

          {/* Real-time Server-Derived Countdown */}
          <div className="mt-4">
            <EventExpiryCountdown
              expiresAt={event.expires_at}
              status={effectiveStatus}
              variant="cream"
            />
          </div>

          {/* CARD 1: Public Joining Code */}
          <div className="mt-4 rounded-2xl bg-white border border-[#DCE3EC] p-4 sm:p-5 shadow-[0_4px_14px_rgba(23,46,77,0.05)]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase text-[#218F87]">
              <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>PUBLIC JOINING CODE</span>
            </div>

            <p className="mt-2.5 font-mono text-4xl sm:text-[2.5rem] font-extrabold tracking-[0.22em] text-[#172E4D] tabular-nums select-all">
              {event.joining_code}
            </p>

            <p className="mt-2 text-xs text-[#4F6075] leading-relaxed">
              Share this code with participants so they can join your event.
            </p>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleCopy('join', event.joining_code)}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-[#F4F6F8] hover:bg-[#E8EEF4] text-xs font-bold text-[#172E4D] inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87]"
              >
                {copiedType === 'join' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#218F87] shrink-0" aria-hidden="true" />
                    <span className="text-[#218F87]">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#218F87] shrink-0" aria-hidden="true" />
                    <span>COPY CODE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareEvent}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#218F87] hover:bg-[#19756E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-1"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>SHARE EVENT</span>
              </button>
            </div>

            {shareFeedback && (
              <p
                role="status"
                aria-live="polite"
                className="mt-2.5 rounded-xl bg-[#DEF1EE] border border-[#BEE2DC] px-3 py-2 text-xs font-semibold text-[#1B6E68] text-center"
              >
                {shareFeedback}
              </p>
            )}
          </div>

          {/* CARD 2: Private Management Code */}
          <div className="mt-3.5 rounded-2xl bg-[#172E4D] text-white p-4 sm:p-5 shadow-[0_6px_18px_rgba(23,46,77,0.18)]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase text-[#8CE0D9]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>PRIVATE MANAGEMENT CODE</span>
            </div>

            <p className="mt-2.5 font-mono text-4xl sm:text-[2.5rem] font-extrabold tracking-[0.22em] tabular-nums select-all">
              {showPrivateCode ? managementCode : '••••'}
            </p>

            <p className="mt-2 text-xs text-white/85 leading-relaxed">
              Keep this code private. Anyone with this code can access your event management.
            </p>

            <div className="mt-3 rounded-xl bg-white/10 border border-white/15 px-3 py-2 flex items-start gap-2">
              <AlertTriangle
                className="w-3.5 h-3.5 text-[#F5D67B] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-[11.5px] font-semibold text-[#F5D67B] leading-snug">
                Keep your management code private. Never share it with participants.
              </p>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleCopy('manage', managementCode)}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CE0D9]"
              >
                {copiedType === 'manage' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#8CE0D9] shrink-0" aria-hidden="true" />
                    <span className="text-[#8CE0D9]">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8CE0D9] shrink-0" aria-hidden="true" />
                    <span>COPY CODE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPrivateCode((prev) => !prev)}
                aria-pressed={!showPrivateCode}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-white/25 bg-transparent hover:bg-white/10 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CE0D9]"
              >
                {showPrivateCode ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>HIDE CODE</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>SHOW CODE</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {managementError && (
            <p
              role="alert"
              className="mt-3.5 rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 text-xs font-medium text-[#A63A24]"
            >
              {managementError}
            </p>
          )}

          {/* Primary Action: Open Event Management */}
          <button
            type="button"
            onClick={onOpenManagement}
            disabled={isOpeningManagement}
            className="mt-5 w-full min-h-[52px] px-5 py-3.5 rounded-2xl bg-[#218F87] hover:bg-[#19756E] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 shadow-[0_6px_18px_rgba(33,143,135,0.28)] active:scale-[0.98] disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6EE]"
          >
            {isOpeningManagement ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                <span>OPENING MANAGEMENT…</span>
              </>
            ) : (
              <>
                <span>OPEN EVENT MANAGEMENT</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBackToWelcome}
            className="mt-2.5 w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#4F6075] hover:text-[#172E4D] hover:bg-[#EAE0CF]/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87]"
          >
            Back to Home
          </button>
        </section>
      </main>
    </div>
  );
};
