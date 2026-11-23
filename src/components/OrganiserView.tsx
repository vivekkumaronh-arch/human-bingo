import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  History,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import {
  formatDuration,
  formatRankOrdinal,
  getEffectiveEventStatus,
  rankCompletedParticipants,
} from '../services/bingoApi';
import type {
  ManagedEventSummary,
  OrganiserGallerySubmission,
  ParticipantRecord,
  VerificationStatus,
} from '../types/multiplayer';
import { OrganiserPhotoGallery } from './OrganiserPhotoGallery';
import { EventExpiryCountdown } from './EventExpiryCountdown';

interface OrganiserViewProps {
  events: ManagedEventSummary[];
  selectedEvent: ManagedEventSummary | null;
  participants: ParticipantRecord[];
  submissions: OrganiserGallerySubmission[];
  isLoadingEvents: boolean;
  isLoadingGallery: boolean;
  galleryError: string | null;
  verifyingKeys: Record<string, boolean>;
  isCreatingEvent: boolean;
  closingEventId: string | null;
  actionError: string | null;
  onCreateNewEvent: (title?: string) => Promise<void>;
  onUpdateEventTitle: (eventId: string, title: string) => Promise<void>;
  onCloseEvent: (eventId: string) => Promise<void>;
  onSelectEvent: (eventId: string) => void;
  onSwitchManagementCode: () => void;
  onToggleAllowReplay: (eventId: string, allowReplay: boolean) => Promise<void>;
  onRefreshGallery: () => void;
  onVerifySubmission: (
    participantId: string,
    challengeId: number,
    status: Exclude<VerificationStatus, 'pending'>,
    rejectionReason?: string,
  ) => Promise<void>;
  onRequestResetEvent: () => void;
  onClearError: () => void;
  onBackHome: () => void;
}

export const OrganiserView: React.FC<OrganiserViewProps> = ({
  events,
  selectedEvent,
  participants,
  submissions,
  isLoadingEvents,
  isLoadingGallery,
  galleryError,
  verifyingKeys,
  isCreatingEvent,
  closingEventId,
  actionError,
  onCreateNewEvent,
  onUpdateEventTitle,
  onCloseEvent,
  onSelectEvent,
  onSwitchManagementCode,
  onToggleAllowReplay,
  onRefreshGallery,
  onVerifySubmission,
  onRequestResetEvent,
  onClearError,
  onBackHome,
}) => {
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [editTitle, setEditTitle] = useState(selectedEvent?.title ?? '');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);

  const leaderboardSectionRef = useRef<HTMLElement | null>(null);
  const gallerySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEditTitle(selectedEvent?.title ?? '');
    setTitleSaved(false);
  }, [selectedEvent?.id, selectedEvent?.title]);

  const selectedStatus = selectedEvent ? getEffectiveEventStatus(selectedEvent) : null;
  const isSelectedEventEditable = selectedStatus === 'active';

  const handleReplayToggle = async () => {
    if (!selectedEvent || isUpdatingSettings || !isSelectedEventEditable) return;
    setIsUpdatingSettings(true);
    try {
      await onToggleAllowReplay(selectedEvent.id, !selectedEvent.allow_replay);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleCreateEventSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreatingEvent) return;
    onClearError();
    await onCreateNewEvent(newEventTitle);
    setNewEventTitle('');
  };

  const handleSaveTitle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEvent || isSavingTitle || !isSelectedEventEditable) return;
    onClearError();
    setIsSavingTitle(true);
    try {
      await onUpdateEventTitle(
        selectedEvent.id,
        editTitle.trim() || 'Human Bingo Networking Challenge',
      );
      setTitleSaved(true);
      window.setTimeout(() => setTitleSaved(false), 2000);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCopyCode = async (key: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // Fallback ignored when clipboard permission is unavailable
    }
  };

  const handleViewEventLeaderboard = (eventId: string) => {
    onSelectEvent(eventId);
    window.setTimeout(() => {
      leaderboardSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const submissionStatsByParticipant = React.useMemo(() => {
    const map = new Map<
      string,
      { submitted: number; pending: number; rejected: number }
    >();
    for (const sub of submissions) {
      const current = map.get(sub.participant_id) ?? {
        submitted: 0,
        pending: 0,
        rejected: 0,
      };
      if (sub.verification_status === 'pending' || sub.verification_status === 'approved') {
        current.submitted += 1;
      }
      if (sub.verification_status === 'pending') {
        current.pending += 1;
      } else if (sub.verification_status === 'rejected') {
        current.rejected += 1;
      }
      map.set(sub.participant_id, current);
    }
    return map;
  }, [submissions]);

  const enrichedParticipants = React.useMemo(
    () =>
      participants.map((p) => {
        const derived = submissionStatsByParticipant.get(p.id);
        return {
          ...p,
          submitted_count: p.submitted_count ?? derived?.submitted ?? p.completed_count,
          pending_count: p.pending_count ?? derived?.pending ?? 0,
          rejected_count: p.rejected_count ?? derived?.rejected ?? 0,
        };
      }),
    [participants, submissionStatsByParticipant],
  );

  const totalRegistered = enrichedParticipants.length;
  const completedList = rankCompletedParticipants(enrichedParticipants);
  const completedCount = completedList.length;
  const allUploadedCount = enrichedParticipants.filter(
    (p) => (p.submitted_count ?? p.completed_count) === 9,
  ).length;
  const pendingPhotoReviews = submissions.filter(
    (s) => s.verification_status === 'pending',
  ).length;

  const sortedProgress = [...enrichedParticipants].sort((a, b) => {
    if (b.completed_count !== a.completed_count) {
      return b.completed_count - a.completed_count;
    }
    const subA = a.submitted_count ?? a.completed_count;
    const subB = b.submitted_count ?? b.completed_count;
    if (subB !== subA) {
      return subB - subA;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] px-3 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs sm:text-sm font-semibold text-[#142B49] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Home</span>
            </button>
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#258A83]">
                CODE-BASED EVENT MANAGEMENT
              </p>
              <h1 className="font-display text-lg sm:text-2xl font-extrabold text-[#142B49]">
                Human Bingo Event Control
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onSwitchManagementCode}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs font-semibold text-[#142B49] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
            <span>Unlock Another Event</span>
          </button>
        </header>

        {actionError && (
          <div
            role="alert"
            className="rounded-xl border border-[#F08B76]/50 bg-[#FDF5F3] px-3.5 py-2.5 flex items-center gap-2 text-xs font-medium text-[#A63A24]"
          >
            <AlertCircle className="w-4 h-4 text-[#D96D57] shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Selected Managed Event Details (Private Management Code intentionally hidden) */}
        {selectedEvent && selectedStatus && (
          <section className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-4 sm:p-5 shadow-[0_6px_22px_rgba(20,43,73,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.18em] text-[#258A83]">
                  MANAGING EVENT
                </span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    selectedStatus === 'active'
                      ? 'bg-[#CFE2D3]/70 text-[#1E6245]'
                      : selectedStatus === 'expired'
                        ? 'bg-[#FCE8E3] text-[#A63A24]'
                        : 'bg-[#E6ECF3] text-[#4F627A]'
                  }`}
                >
                  {selectedStatus === 'active'
                    ? 'Active'
                    : selectedStatus === 'expired'
                      ? 'Expired'
                      : 'Closed'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4F627A]">
                  <Clock className="w-3 h-3 text-[#7D6E5D]" aria-hidden="true" />
                  <span>
                    {selectedStatus === 'expired' ? 'Expired on ' : 'Expires '}
                    {new Date(selectedEvent.expires_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
              </div>

              {selectedStatus === 'active' &&
                (confirmCloseId === selectedEvent.id ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={closingEventId === selectedEvent.id}
                      onClick={async () => {
                        await onCloseEvent(selectedEvent.id);
                        setConfirmCloseId(null);
                      }}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#E25546] hover:bg-[#C94335] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      {closingEventId === selectedEvent.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>Confirm Close</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCloseId(null)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-[#DCE3EC] bg-white text-xs font-semibold text-[#4F627A] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCloseId(selectedEvent.id)}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] hover:bg-[#FAE7E2] text-xs font-bold text-[#A63A24] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Close Event</span>
                  </button>
                ))}
            </div>

            <div className="mb-3">
              <EventExpiryCountdown
                expiresAt={selectedEvent.expires_at}
                status={selectedStatus}
                variant="compact"
              />
            </div>

            {selectedStatus === 'expired' && (
              <div className="mb-3 rounded-xl border border-[#F08B76]/50 bg-[#FDF5F3] px-3 py-2 text-xs font-medium text-[#A63A24]">
                This event has expired after 48 hours. New joins, photo uploads, challenge submissions, and event edits are locked. You can review all historical results and submitted photos below.
              </div>
            )}

            {selectedStatus === 'closed' && (
              <div className="mb-3 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] px-3 py-2 text-xs font-medium text-[#4F627A]">
                This event is closed. New joins, photo uploads, challenge submissions, and event edits are locked. Historical records remain available below.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white border border-[#EAE0CF] p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wider uppercase text-[#258A83]">
                    Public Joining Code
                  </p>
                  <p className="font-mono text-2xl font-extrabold tracking-[0.2em] text-[#142B49] mt-0.5 truncate select-all">
                    {selectedEvent.joining_code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCode(`join-${selectedEvent.id}`, selectedEvent.joining_code)
                  }
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-xs font-bold text-[#142B49] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedKey === `join-${selectedEvent.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
                      <span className="text-[#258A83]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-2xl bg-[#142B49] text-white p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wider uppercase text-[#8CE0D9] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                    <span>Private Management Access</span>
                  </p>
                  <p className="text-xs font-semibold text-white/90 mt-1">
                    Unlocked with your 4-digit private management code
                  </p>
                  <p className="text-[10.5px] text-white/65 mt-0.5">
                    Hidden from view for event security
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveTitle} className="mt-3 flex gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (titleSaved) setTitleSaved(false);
                }}
                maxLength={100}
                disabled={!isSelectedEventEditable || isSavingTitle}
                aria-label="Event name"
                placeholder="Event name (optional)"
                className="flex-1 min-h-[40px] rounded-xl border border-[#DCE3EC] bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-[#142B49] focus:outline-none focus:border-[#258A83] disabled:bg-[#F5F7FA] disabled:text-[#7D6E5D]"
              />
              <button
                type="submit"
                disabled={!isSelectedEventEditable || isSavingTitle}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs font-bold text-[#142B49] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingTitle ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : titleSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
                    <span className="text-[#258A83]">Saved</span>
                  </>
                ) : (
                  <span>Save Name</span>
                )}
              </button>
            </form>
          </section>
        )}

        {/* Summary Stats */}
        {selectedEvent && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="rounded-2xl bg-white border border-[#DCE3EC] p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-[#4F627A] block">
                Total Registered
              </span>
              <span className="font-display text-xl sm:text-2xl font-extrabold tabular-nums text-[#142B49] mt-1 block">
                {totalRegistered}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                gallerySectionRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
              className="rounded-2xl bg-[#FFFBEB] border border-[#F5D67B] p-3 sm:p-4 text-left hover:bg-[#FEF3C7]/70 transition-colors cursor-pointer"
            >
              <span className="text-[11px] font-semibold text-[#9A5B13] block">
                Pending Photo Reviews
              </span>
              <span className="font-display text-xl sm:text-2xl font-extrabold tabular-nums text-[#C87A18] mt-1 block">
                {pendingPhotoReviews}
              </span>
            </button>
            <div className="rounded-2xl bg-white border border-[#DCE3EC] p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-[#4F627A] block">
                All 9 Uploaded
              </span>
              <span className="font-display text-xl sm:text-2xl font-extrabold tabular-nums text-[#E25546] mt-1 block">
                {allUploadedCount}
              </span>
              <span className="text-[10.5px] font-medium text-[#7D6E5D] tabular-nums">
                {submissions.length} total photos
              </span>
            </div>
            <div className="rounded-2xl bg-white border border-[#DCE3EC] p-3 sm:p-4">
              <span className="text-[11px] font-semibold text-[#4F627A] block">
                Verified 9/9
              </span>
              <span className="font-display text-xl sm:text-2xl font-extrabold tabular-nums text-[#258A83] mt-1 block">
                {completedCount}
              </span>
            </div>
          </section>
        )}

        {/* Event Controls */}
        {selectedEvent && (
          <section className="rounded-2xl bg-white border border-[#DCE3EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                id="allow-replay-toggle"
                type="checkbox"
                checked={Boolean(selectedEvent.allow_replay)}
                disabled={isUpdatingSettings || !isSelectedEventEditable}
                onChange={handleReplayToggle}
                className="w-4 h-4 accent-[#258A83] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="allow-replay-toggle"
                className={`text-xs sm:text-sm font-semibold ${
                  isSelectedEventEditable
                    ? 'text-[#142B49] cursor-pointer'
                    : 'text-[#7D6E5D] cursor-not-allowed'
                }`}
              >
                Permit participants to start another challenge after finishing
              </label>
            </div>

            <button
              type="button"
              onClick={onRequestResetEvent}
              disabled={totalRegistered === 0}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#E25546] hover:bg-[#C94335] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Reset Event Leaderboard</span>
            </button>
          </section>
        )}

        {/* Participant Photo Verification Gallery */}
        {selectedEvent && (
          <div ref={gallerySectionRef}>
            <OrganiserPhotoGallery
              eventJoiningCode={selectedEvent.joining_code}
              participants={participants}
              submissions={submissions}
              isLoading={isLoadingGallery}
              errorMessage={galleryError}
              verifyingKeys={verifyingKeys}
              onRefresh={onRefreshGallery}
              onVerifySubmission={onVerifySubmission}
            />
          </div>
        )}

        {/* Leaderboard Sorted by Completion Timestamp */}
        {selectedEvent && (
          <section
            ref={leaderboardSectionRef}
            className="rounded-2xl bg-white border border-[#DCE3EC] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-[#E25546]" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-bold text-[#142B49]">
                Leaderboard · {selectedEvent.joining_code} (Sorted by Server Completion Time)
              </h2>
            </div>

            {completedList.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#4F627A] py-3">
                No completed participants yet for this event.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#DCE3EC] text-[#4F627A]">
                      <th className="py-2 pr-3 font-semibold">Rank</th>
                      <th className="py-2 pr-3 font-semibold">Participant</th>
                      <th className="py-2 pr-3 font-semibold">Duration</th>
                      <th className="py-2 font-semibold">Finished At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F6]">
                    {completedList.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-2 pr-3 font-bold tabular-nums text-[#258A83]">
                          {formatRankOrdinal(entry.rank)}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-[#142B49]">
                          {entry.full_name}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-[#142B49]">
                          {formatDuration(entry.duration_seconds)}
                        </td>
                        <td className="py-2 tabular-nums text-[#4F627A]">
                          {entry.completed_at
                            ? new Date(entry.completed_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Live Progress of Every Participant */}
        {selectedEvent && (
          <section className="rounded-2xl bg-white border border-[#DCE3EC] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#258A83]" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-bold text-[#142B49]">
                Participants Live Progress · {selectedEvent.joining_code}
              </h2>
            </div>

            {sortedProgress.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#4F627A] py-3">
                No participants registered yet for this event.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[#EEF2F6]">
                {sortedProgress.map((p) => {
                  const uploadedCnt = p.submitted_count ?? p.completed_count;
                  const verifiedPct = Math.round((p.completed_count / 9) * 100);
                  const pendingCnt = p.pending_count ?? 0;
                  const rejectedCnt = p.rejected_count ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#142B49] truncate">
                          {p.full_name}
                        </p>
                        <p className="text-[11px] text-[#4F627A] tabular-nums">
                          Started{' '}
                          {new Date(p.started_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {pendingCnt > 0 ? ` · ${pendingCnt} pending` : ''}
                          {rejectedCnt > 0 ? ` · ${rejectedCnt} rejected` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0 tabular-nums text-xs">
                        <span className="rounded-md bg-[#F5F7FA] border border-[#DCE3EC] px-2 py-0.5 font-semibold text-[#142B49]">
                          Uploaded {uploadedCnt}/9
                        </span>
                        <span className="rounded-md bg-[#F2FAF8] border border-[#B8D1BE] px-2 py-0.5 font-bold text-[#258A83]">
                          Verified {p.completed_count}/9 ({verifiedPct}%)
                        </span>
                        {p.is_completed ? (
                          <CheckCircle2
                            className="w-4 h-4 text-[#258A83]"
                            aria-label="Verified Completed"
                          />
                        ) : uploadedCnt === 9 ? (
                          <span className="text-[11px] font-bold text-[#9A5B13]">
                            All 9 Uploaded
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#7D6E5D]">
                            Playing
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Create Another Event + Event History (Unlocked in this session) */}
        <section className="rounded-2xl bg-white border border-[#DCE3EC] p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#258A83]" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-bold text-[#142B49]">
                Unlocked Event History
              </h2>
            </div>
            {isLoadingEvents && (
              <Loader2 className="w-4 h-4 animate-spin text-[#258A83]" aria-hidden="true" />
            )}
          </div>

          <form
            onSubmit={handleCreateEventSubmit}
            className="mb-4 flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              maxLength={100}
              placeholder="New event name (optional)"
              disabled={isCreatingEvent}
              aria-label="New event name"
              className="flex-1 min-h-[42px] rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] px-3 py-1.5 text-xs sm:text-sm text-[#142B49] placeholder:text-[#8A9BAE] focus:bg-white focus:outline-none focus:border-[#258A83]"
            />
            <button
              type="submit"
              disabled={isCreatingEvent}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60 cursor-pointer"
            >
              {isCreatingEvent ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>CREATE NEW EVENT</span>
                </>
              )}
            </button>
          </form>

          {events.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#4F627A] py-2">
              No unlocked events in this session yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {events.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                const evtStatus = getEffectiveEventStatus(evt);
                const isActive = evtStatus === 'active';
                const isClosingThis = closingEventId === evt.id;

                return (
                  <div
                    key={evt.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-[#258A83] bg-[#F6FBFA]'
                        : 'border-[#DCE3EC] bg-[#FAFCFE]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-[#142B49] bg-white border border-[#DCE3EC] rounded-lg px-2 py-0.5">
                            {evt.joining_code}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              evtStatus === 'active'
                                ? 'bg-[#CFE2D3]/70 text-[#1E6245]'
                                : evtStatus === 'expired'
                                  ? 'bg-[#FCE8E3] text-[#A63A24]'
                                  : 'bg-[#E6ECF3] text-[#4F627A]'
                            }`}
                          >
                            {evtStatus === 'active'
                              ? 'Active'
                              : evtStatus === 'expired'
                                ? 'Expired'
                                : 'Closed'}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[#258A83]">
                              Viewing
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-[#142B49] mt-1 truncate">
                          {evt.title}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#4F627A] tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#7D6E5D]" aria-hidden="true" />
                            <span>
                              {new Date(evt.created_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}{' '}
                              {new Date(evt.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                          <span>
                            <strong className="text-[#142B49]">{evt.participant_count}</strong>{' '}
                            joined
                          </span>
                          <span>
                            <strong className="text-[#258A83]">{evt.completed_count}</strong>{' '}
                            completed
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(`hist-${evt.id}`, evt.joining_code)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[11px] font-semibold text-[#142B49] inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `hist-${evt.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                              <span className="text-[#258A83]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                              <span>Copy Joining Code</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleViewEventLeaderboard(evt.id)}
                          className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#142B49] text-white'
                              : 'bg-[#258A83] hover:bg-[#1E726C] text-white'
                          }`}
                        >
                          <Trophy className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>View Leaderboard</span>
                        </button>

                        {isActive &&
                          (confirmCloseId === evt.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isClosingThis}
                                onClick={async () => {
                                  await onCloseEvent(evt.id);
                                  setConfirmCloseId(null);
                                }}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#E25546] hover:bg-[#C94335] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                {isClosingThis ? (
                                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Lock className="w-3 h-3" aria-hidden="true" />
                                )}
                                <span>Confirm</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCloseId(null)}
                                className="min-h-[34px] px-2 py-1 rounded-lg border border-[#DCE3EC] bg-white text-[11px] font-semibold text-[#4F627A] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmCloseId(evt.id)}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#F08B76]/60 bg-[#FDF5F3] hover:bg-[#FAE7E2] text-[11px] font-bold text-[#A63A24] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              <span>Close Event</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
