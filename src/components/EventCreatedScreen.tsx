import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type { EventConfig } from '../types/multiplayer';

interface EventCreatedScreenProps {
  event: EventConfig;
  managementCode: string;
  onUpdateEventName: (title: string) => Promise<void>;
  onOpenManagement: () => void;
  onBackToWelcome: () => void;
}

export const EventCreatedScreen: React.FC<EventCreatedScreenProps> = ({
  event,
  managementCode,
  onUpdateEventName,
  onOpenManagement,
  onBackToWelcome,
}) => {
  const [eventName, setEventName] = useState(
    event.title === 'Human Bingo Networking Challenge' ? '' : event.title,
  );
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'join' | 'manage' | null>(null);

  const handleCopy = async (type: 'join' | 'manage', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(type);
      window.setTimeout(() => {
        setCopiedType((prev) => (prev === type ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingName) return;

    const trimmed = eventName.trim().replace(/\s+/g, ' ');
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError('Event name must be at least 2 characters.');
      return;
    }

    setNameError(null);
    setIsSavingName(true);
    try {
      await onUpdateEventName(trimmed || 'Human Bingo Networking Challenge');
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not update event name.');
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_34px_rgba(20,43,73,0.08)]">
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              onClick={onBackToWelcome}
              className="text-xs font-semibold text-[#4F627A] hover:text-[#142B49] inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Home</span>
            </button>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#CFE2D3]/75 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1E6245]">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              <span>Active</span>
            </span>
          </div>

          <header className="text-center">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#258A83]">
              EVENT READY
            </p>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#142B49] mt-1">
              Your Event Codes
            </h1>
            <p className="text-xs sm:text-sm text-[#4F627A] mt-1">
              Share the public joining code with participants and keep your private management code safe.
            </p>
          </header>

          {/* Public Joining Code */}
          <div className="mt-5 rounded-2xl bg-white border border-[#DCE3EC] p-4 shadow-[0_2px_10px_rgba(20,43,73,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#258A83]">
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Public Joining Code</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy('join', event.joining_code)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[11px] font-bold text-[#142B49] inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedType === 'join' ? (
                  <>
                    <Check className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                    <span className="text-[#258A83]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 font-mono text-2xl font-extrabold tracking-wider text-[#142B49] select-all">
              {event.joining_code}
            </p>
            <p className="mt-1 text-[11px] text-[#5D7088]">
              Participants enter this code to join and play Human Bingo.
            </p>
          </div>

          {/* Private Management Code */}
          <div className="mt-3 rounded-2xl bg-[#142B49] text-white p-4 shadow-[0_4px_14px_rgba(20,43,73,0.16)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-[#8CE0D9]">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Private Management Code</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy('manage', managementCode)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white/12 hover:bg-white/20 text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedType === 'manage' ? (
                  <>
                    <Check className="w-3 h-3 text-[#8CE0D9]" aria-hidden="true" />
                    <span className="text-[#8CE0D9]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#8CE0D9]" aria-hidden="true" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 font-mono text-xl sm:text-2xl font-extrabold tracking-wider select-all">
              {managementCode}
            </p>
            <p className="mt-1 text-[11px] text-white/75">
              Keep this private. Anyone with this code can view live progress, close, or reset this event.
            </p>
          </div>

          {/* Optional Event Name */}
          <form onSubmit={handleSaveName} className="mt-4">
            <label
              htmlFor="created-event-title"
              className="block text-xs font-bold text-[#142B49] mb-1.5"
            >
              Event Name <span className="font-normal text-[#7D6E5D]">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="created-event-title"
                type="text"
                maxLength={100}
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value);
                  if (nameError) setNameError(null);
                  if (nameSaved) setNameSaved(false);
                }}
                placeholder="e.g. Q2 Leadership Mixer"
                className="flex-1 min-h-[42px] rounded-xl border border-[#DCE3EC] bg-white px-3 py-2 text-xs sm:text-sm font-medium text-[#142B49] placeholder:text-[#8A9BAE] focus:outline-none focus:border-[#258A83]"
              />
              <button
                type="submit"
                disabled={isSavingName}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs font-bold text-[#142B49] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {isSavingName ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : nameSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
                    <span className="text-[#258A83]">Saved</span>
                  </>
                ) : (
                  <span>Save Name</span>
                )}
              </button>
            </div>
            {nameError && (
              <p className="mt-1.5 text-xs font-medium text-[#A63A24]">{nameError}</p>
            )}
          </form>

          <button
            type="button"
            onClick={onOpenManagement}
            className="mt-5 w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors shadow-[0_4px_14px_rgba(37,138,131,0.28)] cursor-pointer"
          >
            <span>Open Event Management</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
