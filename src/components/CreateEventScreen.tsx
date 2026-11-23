import React, { useState } from 'react';
import { ArrowLeft, Clock, Loader2, Plus } from 'lucide-react';

interface CreateEventScreenProps {
  isCreating: boolean;
  errorMessage: string | null;
  onCreateEvent: (title?: string) => Promise<void>;
  onClearError: () => void;
  onBack: () => void;
}

export const CreateEventScreen: React.FC<CreateEventScreenProps> = ({
  isCreating,
  errorMessage,
  onCreateEvent,
  onClearError,
  onBack,
}) => {
  const [eventName, setEventName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreating) return;

    const cleaned = eventName.trim().replace(/\s+/g, ' ');
    if (cleaned.length > 0 && cleaned.length < 2) {
      setValidationError('Event name must be at least 2 characters, or leave it blank.');
      return;
    }

    setValidationError(null);
    await onCreateEvent(cleaned || undefined);
  };

  const displayError = validationError || errorMessage;

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col">
      {/* Compact Top Bar */}
      <header className="w-full max-w-md mx-auto px-4 pt-5 pb-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className="min-h-[44px] px-2 -ml-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#4F6075] hover:text-[#172E4D] transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] rounded-lg"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Back to Home</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-8 pt-2 flex flex-col justify-center">
        <section className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-5 sm:p-7 shadow-[0_12px_34px_rgba(23,46,77,0.07)]">
          {/* Brand Nine-Square Accent */}
          <div className="grid grid-cols-3 gap-0.5 w-8 mb-4" aria-hidden="true">
            <span className="h-2 rounded-[2px] bg-[#F2B591]" />
            <span className="h-2 rounded-[2px] bg-[#97C9A4]" />
            <span className="h-2 rounded-[2px] bg-[#EBC766]" />
            <span className="h-2 rounded-[2px] bg-[#95BAE0]" />
            <span className="h-2 rounded-[2px] bg-[#DC9D88]" />
            <span className="h-2 rounded-[2px] bg-[#B7A4DA]" />
            <span className="h-2 rounded-[2px] bg-[#D7C6AC]" />
            <span className="h-2 rounded-[2px] bg-[#218F87]" />
            <span className="h-2 rounded-[2px] bg-[#E59D90]" />
          </div>

          <header>
            <h1 className="font-display text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-[#172E4D] leading-tight">
              Create Your Event
            </h1>
            <p className="mt-1.5 text-sm text-[#4F6075] leading-relaxed">
              Start a new networking experience in seconds.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="create-event-name"
                className="block text-xs font-bold text-[#172E4D] mb-1.5"
              >
                Event Name <span className="font-normal text-[#718096]">(optional)</span>
              </label>
              <input
                id="create-event-name"
                type="text"
                maxLength={100}
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value);
                  if (validationError) setValidationError(null);
                  if (errorMessage) onClearError();
                }}
                placeholder="e.g. College Networking 2026"
                disabled={isCreating}
                className="w-full min-h-[48px] rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm font-medium text-[#172E4D] placeholder:text-[#8A9BAE] focus:outline-none focus:border-[#218F87] focus:ring-2 focus:ring-[#218F87]/20 disabled:opacity-60 transition-colors"
              />
            </div>

            {/* 48-Hour Event Duration Info Card */}
            <div className="rounded-2xl bg-white border border-[#EAE0CF] p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#DEF1EE] text-[#218F87] flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-[#218F87]">
                  EVENT DURATION
                </p>
                <p className="font-display text-base font-extrabold text-[#172E4D] mt-0.5">
                  48 HOURS
                </p>
                <p className="mt-0.5 text-xs text-[#4F6075] leading-relaxed">
                  Your event automatically closes after 48 hours.
                </p>
              </div>
            </div>

            {displayError && (
              <p
                role="alert"
                className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 text-xs font-medium text-[#A63A24]"
              >
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="mt-1 w-full min-h-[52px] px-5 py-3.5 rounded-2xl bg-[#218F87] hover:bg-[#19756E] text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 shadow-[0_6px_18px_rgba(33,143,135,0.28)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6EE]"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>CREATING EVENT…</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>CREATE EVENT</span>
                </>
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};
