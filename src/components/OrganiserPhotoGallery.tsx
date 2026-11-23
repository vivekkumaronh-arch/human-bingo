import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Expand,
  Filter,
  Grid3X3,
  Images,
  Loader2,
  RefreshCw,
  Search,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { CHALLENGES } from '../data/challenges';
import type {
  OrganiserGallerySubmission,
  ParticipantRecord,
  VerificationStatus,
} from '../types/multiplayer';

interface OrganiserPhotoGalleryProps {
  eventJoiningCode: string;
  participants: ParticipantRecord[];
  submissions: OrganiserGallerySubmission[];
  isLoading: boolean;
  errorMessage: string | null;
  verifyingKeys: Record<string, boolean>;
  onRefresh: () => void;
  onVerifySubmission: (
    participantId: string,
    challengeId: number,
    status: Exclude<VerificationStatus, 'pending'>,
    rejectionReason?: string,
  ) => Promise<void>;
}

const CHALLENGE_MAP = new Map(CHALLENGES.map((c) => [c.id, c]));

const QUICK_REJECTION_REASONS = [
  'Photo does not match the challenge prompt',
  'Subject or person is not clearly visible',
  'Image is too blurry or dark',
  'Duplicate or placeholder photo',
];

function StatusBadge({ status }: { status: VerificationStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#CFE2D3]/80 px-2 py-0.5 text-[10.5px] font-bold text-[#1E6245]">
        <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Approved</span>
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#FAE7E2] px-2 py-0.5 text-[10.5px] font-bold text-[#A63A24]">
        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Rejected</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] font-bold text-[#9A5B13]">
      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>Pending Review</span>
    </span>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })}, ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export const OrganiserPhotoGallery: React.FC<OrganiserPhotoGalleryProps> = ({
  eventJoiningCode,
  participants,
  submissions,
  isLoading,
  errorMessage,
  verifyingKeys,
  onRefresh,
  onVerifySubmission,
}) => {
  const [viewMode, setViewMode] = useState<'all' | 'participant'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [participantFilter, setParticipantFilter] = useState<string>('all');
  const [challengeFilter, setChallengeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('all');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');

  // Full image modal & rejection reason dialog states
  const [lightboxKey, setLightboxKey] = useState<{
    participantId: string;
    challengeId: number;
  } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrganiserGallerySubmission | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const s of submissions) {
      if (s.verification_status === 'approved') approved += 1;
      else if (s.verification_status === 'rejected') rejected += 1;
      else pending += 1;
    }
    return {
      total: submissions.length,
      pending,
      approved,
      rejected,
    };
  }, [submissions]);

  const participantOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) {
      map.set(p.id, p.full_name);
    }
    for (const s of submissions) {
      if (!map.has(s.participant_id)) {
        map.set(s.participant_id, s.participant_name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, submissions]);

  const filteredSubmissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (participantFilter !== 'all' && sub.participant_id !== participantFilter) {
        return false;
      }
      if (challengeFilter !== 'all' && String(sub.challenge_id) !== challengeFilter) {
        return false;
      }
      if (statusFilter !== 'all' && sub.verification_status !== statusFilter) {
        return false;
      }
      if (query) {
        const challenge = CHALLENGE_MAP.get(sub.challenge_id);
        const matchesName = sub.participant_name.toLowerCase().includes(query);
        const matchesId = sub.participant_id.toLowerCase().includes(query);
        const matchesChallenge = challenge
          ? challenge.headline.toLowerCase().includes(query)
          : false;
        if (!matchesName && !matchesId && !matchesChallenge) {
          return false;
        }
      }
      return true;
    });
  }, [challengeFilter, participantFilter, searchQuery, statusFilter, submissions]);

  const activeParticipantId = useMemo(() => {
    if (
      selectedParticipantId &&
      participantOptions.some((p) => p.id === selectedParticipantId)
    ) {
      return selectedParticipantId;
    }
    return participantOptions[0]?.id ?? '';
  }, [participantOptions, selectedParticipantId]);

  const activeParticipantRecord = useMemo(
    () => participants.find((p) => p.id === activeParticipantId) ?? null,
    [activeParticipantId, participants],
  );

  const activeParticipantSubmissions = useMemo(() => {
    const map = new Map<number, OrganiserGallerySubmission>();
    for (const sub of submissions) {
      if (sub.participant_id === activeParticipantId) {
        map.set(sub.challenge_id, sub);
      }
    }
    return map;
  }, [activeParticipantId, submissions]);

  const lightboxSubmission = useMemo(() => {
    if (!lightboxKey) return null;
    return (
      submissions.find(
        (s) =>
          s.participant_id === lightboxKey.participantId &&
          s.challenge_id === lightboxKey.challengeId,
      ) ?? null
    );
  }, [lightboxKey, submissions]);

  const handleOpenParticipantView = (participantId: string) => {
    setSelectedParticipantId(participantId);
    setViewMode('participant');
  };

  const handleOpenRejectModal = (submission: OrganiserGallerySubmission) => {
    setRejectTarget(submission);
    setRejectReasonInput(submission.rejection_reason ?? '');
  };

  const handleConfirmReject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejectTarget) return;
    const key = `${rejectTarget.participant_id}:${rejectTarget.challenge_id}`;
    if (verifyingKeys[key]) return;

    await onVerifySubmission(
      rejectTarget.participant_id,
      rejectTarget.challenge_id,
      'rejected',
      rejectReasonInput.trim() || undefined,
    );
    setRejectTarget(null);
    setRejectReasonInput('');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    participantFilter !== 'all' ||
    challengeFilter !== 'all' ||
    statusFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setParticipantFilter('all');
    setChallengeFilter('all');
    setStatusFilter('all');
  };

  return (
    <section
      id="participant-photo-gallery"
      className="rounded-2xl sm:rounded-3xl bg-white border border-[#DCE3EC] p-4 sm:p-5 shadow-[0_6px_22px_rgba(20,43,73,0.05)]"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-[#258A83]" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#142B49]">
              PARTICIPANT PHOTO VERIFICATION
            </h2>
          </div>
          <p className="text-xs text-[#4F627A] mt-0.5">
            Inspect and verify submitted challenge photos for event{' '}
            <strong className="font-mono text-[#142B49]">{eventJoiningCode}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Gallery view mode"
            className="inline-flex rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'all'}
              onClick={() => setViewMode('all')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'all'
                  ? 'bg-[#142B49] text-white shadow-xs'
                  : 'text-[#4F627A] hover:text-[#142B49]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>All Photos</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'participant'}
              onClick={() => setViewMode('participant')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'participant'
                  ? 'bg-[#142B49] text-white shadow-xs'
                  : 'text-[#4F627A] hover:text-[#142B49]'
              }`}
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span>By Participant</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh gallery"
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-xs font-semibold text-[#142B49] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#258A83] ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setViewMode('all');
            setStatusFilter('all');
          }}
          className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
            viewMode === 'all' && statusFilter === 'all'
              ? 'border-[#142B49] bg-[#F5F7FA]'
              : 'border-[#DCE3EC] bg-white hover:bg-[#FAFCFE]'
          }`}
        >
          <span className="text-[10.5px] font-semibold text-[#4F627A] block">
            Total Photos
          </span>
          <span className="font-display text-lg font-extrabold tabular-nums text-[#142B49]">
            {counts.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('all');
            setStatusFilter('pending');
          }}
          className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
            viewMode === 'all' && statusFilter === 'pending'
              ? 'border-[#C87A18] bg-[#FFFBEB]'
              : 'border-[#DCE3EC] bg-white hover:bg-[#FFFDF5]'
          }`}
        >
          <span className="text-[10.5px] font-semibold text-[#9A5B13] block">
            Pending Review
          </span>
          <span className="font-display text-lg font-extrabold tabular-nums text-[#C87A18]">
            {counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('all');
            setStatusFilter('approved');
          }}
          className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
            viewMode === 'all' && statusFilter === 'approved'
              ? 'border-[#258A83] bg-[#F2FAF8]'
              : 'border-[#DCE3EC] bg-white hover:bg-[#F7FCFB]'
          }`}
        >
          <span className="text-[10.5px] font-semibold text-[#1E6245] block">
            Approved
          </span>
          <span className="font-display text-lg font-extrabold tabular-nums text-[#258A83]">
            {counts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('all');
            setStatusFilter('rejected');
          }}
          className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
            viewMode === 'all' && statusFilter === 'rejected'
              ? 'border-[#E25546] bg-[#FDF5F3]'
              : 'border-[#DCE3EC] bg-white hover:bg-[#FEF8F7]'
          }`}
        >
          <span className="text-[10.5px] font-semibold text-[#A63A24] block">
            Rejected
          </span>
          <span className="font-display text-lg font-extrabold tabular-nums text-[#E25546]">
            {counts.rejected}
          </span>
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-medium text-[#A63A24]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-[#D96D57] shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-2.5 py-1 rounded-lg bg-white border border-[#F08B76]/50 text-[11px] font-bold text-[#A63A24] cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {viewMode === 'all' ? (
        <>
          {/* Filters Bar */}
          <div className="rounded-2xl bg-[#FBF6EE] border border-[#EAE0CF] p-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-[#7D6E5D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search participant…"
                  aria-label="Search participants by name"
                  className="w-full min-h-[38px] rounded-xl border border-[#DCE3EC] bg-white pl-8 pr-3 py-1.5 text-xs text-[#142B49] placeholder:text-[#8A9BAE] focus:outline-none focus:border-[#258A83]"
                />
              </div>

              <select
                value={participantFilter}
                onChange={(e) => setParticipantFilter(e.target.value)}
                aria-label="Filter by participant"
                className="w-full min-h-[38px] rounded-xl border border-[#DCE3EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#142B49] focus:outline-none focus:border-[#258A83]"
              >
                <option value="all">All Participants</option>
                {participantOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={challengeFilter}
                onChange={(e) => setChallengeFilter(e.target.value)}
                aria-label="Filter by Bingo challenge"
                className="w-full min-h-[38px] rounded-xl border border-[#DCE3EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#142B49] focus:outline-none focus:border-[#258A83]"
              >
                <option value="all">All 9 Challenges</option>
                {CHALLENGES.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.numberLabel} · {c.headline}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | VerificationStatus)
                }
                aria-label="Filter by verification status"
                className="w-full min-h-[38px] rounded-xl border border-[#DCE3EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#142B49] focus:outline-none focus:border-[#258A83]"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {hasActiveFilters && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#4F627A]">
                <span className="inline-flex items-center gap-1">
                  <Filter className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                  Showing {filteredSubmissions.length} of {submissions.length} photographs
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-bold text-[#258A83] hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Gallery Content */}
          {isLoading && submissions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#4F627A]">
              <Loader2 className="w-6 h-6 animate-spin text-[#258A83]" aria-hidden="true" />
              <p className="text-xs sm:text-sm font-medium">
                Loading submitted photographs…
              </p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE3EC] bg-[#FAFCFE] py-10 px-4 text-center">
              <Camera
                className="w-8 h-8 text-[#8A9BAE] mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-sm font-bold text-[#142B49]">
                No photographs submitted yet
              </p>
              <p className="text-xs text-[#4F627A] mt-1 max-w-sm mx-auto">
                As soon as participants capture or upload challenge photographs in event{' '}
                <strong className="font-mono">{eventJoiningCode}</strong>, they will appear
                here automatically for review.
              </p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE3EC] bg-[#FAFCFE] py-8 px-4 text-center">
              <p className="text-sm font-bold text-[#142B49]">
                No photographs match the selected filters
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#258A83] text-white text-xs font-bold cursor-pointer"
              >
                Show All Photographs
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSubmissions.map((sub) => {
                const challenge = CHALLENGE_MAP.get(sub.challenge_id);
                const key = `${sub.participant_id}:${sub.challenge_id}`;
                const isVerifying = Boolean(verifyingKeys[key]);

                return (
                  <article
                    key={key}
                    className={`rounded-2xl border bg-white overflow-hidden flex flex-col shadow-[0_2px_10px_rgba(20,43,73,0.05)] ${
                      sub.verification_status === 'approved'
                        ? 'border-[#B8D1BE]'
                        : sub.verification_status === 'rejected'
                          ? 'border-[#F08B76]/80'
                          : 'border-[#DCE3EC]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[4/3] bg-[#EAEFF6] overflow-hidden group">
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxKey({
                            participantId: sub.participant_id,
                            challengeId: sub.challenge_id,
                          })
                        }
                        aria-label={`View full image for ${sub.participant_name}, challenge ${sub.challenge_id}`}
                        className="block w-full h-full cursor-pointer"
                      >
                        <img
                          src={sub.photo_url}
                          alt={`${sub.participant_name} - ${challenge?.headline ?? `Challenge ${sub.challenge_id}`}`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      </button>

                      <div className="absolute top-2 left-2">
                        <StatusBadge status={sub.verification_status} />
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setLightboxKey({
                            participantId: sub.participant_id,
                            challengeId: sub.challenge_id,
                          })
                        }
                        title="View Full Image"
                        aria-label="View Full Image"
                        className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-[#142B49]/75 hover:bg-[#142B49] text-white flex items-center justify-center backdrop-blur-xs cursor-pointer transition-colors"
                      >
                        <Expand className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <div className="absolute bottom-2 left-2 rounded-md bg-[#142B49]/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                        #{challenge?.numberLabel ?? sub.challenge_id} ·{' '}
                        {challenge?.headline ?? `Challenge ${sub.challenge_id}`}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-[#142B49] truncate">
                              {sub.participant_name}
                            </p>
                            <p className="text-[10.5px] font-mono text-[#7D6E5D]">
                              ID: {sub.participant_id.slice(0, 8)} ·{' '}
                              {formatDateTime(sub.submitted_at)}
                            </p>
                          </div>
                        </div>

                        {sub.verification_status === 'rejected' && sub.rejection_reason && (
                          <div className="mt-2 rounded-lg bg-[#FDF5F3] border border-[#F08B76]/50 px-2.5 py-1.5 text-[11px] text-[#A63A24]">
                            <strong>Reason:</strong> {sub.rejection_reason}
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col gap-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={
                              isVerifying || sub.verification_status === 'approved'
                            }
                            onClick={() =>
                              void onVerifySubmission(
                                sub.participant_id,
                                sub.challenge_id,
                                'approved',
                              )
                            }
                            className={`min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed ${
                              sub.verification_status === 'approved'
                                ? 'bg-[#CFE2D3]/60 text-[#1E6245] opacity-85'
                                : 'bg-[#258A83] hover:bg-[#1E726C] text-white disabled:opacity-50'
                            }`}
                          >
                            {isVerifying ? (
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>
                              {sub.verification_status === 'approved'
                                ? 'Approved'
                                : 'Approve'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() => handleOpenRejectModal(sub)}
                            className={`min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 ${
                              sub.verification_status === 'rejected'
                                ? 'border border-[#E25546] bg-[#FDF5F3] text-[#A63A24] hover:bg-[#FAE7E2]'
                                : 'border border-[#F08B76]/70 bg-white hover:bg-[#FDF5F3] text-[#A63A24]'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {sub.verification_status === 'rejected'
                                ? 'Edit Reject'
                                : 'Reject'}
                            </span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxKey({
                                participantId: sub.participant_id,
                                challengeId: sub.challenge_id,
                              })
                            }
                            className="min-h-[32px] px-2 py-1 rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[11px] font-semibold text-[#142B49] inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Expand className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                            <span>View Full Image</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenParticipantView(sub.participant_id)}
                            className="min-h-[32px] px-2 py-1 rounded-lg border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[11px] font-semibold text-[#142B49] inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <User className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                            <span>View Participant</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Participant-wise 9-challenge view */
        <div>
          {participantOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE3EC] bg-[#FAFCFE] py-10 px-4 text-center">
              <Users className="w-8 h-8 text-[#8A9BAE] mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-bold text-[#142B49]">
                No participants registered in this event yet
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-[#FBF6EE] border border-[#EAE0CF] p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <label
                    htmlFor="participant-wise-select"
                    className="text-xs font-bold text-[#142B49] shrink-0"
                  >
                    Participant:
                  </label>
                  <select
                    id="participant-wise-select"
                    value={activeParticipantId}
                    onChange={(e) => setSelectedParticipantId(e.target.value)}
                    className="flex-1 min-w-0 min-h-[38px] rounded-xl border border-[#DCE3EC] bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#142B49] focus:outline-none focus:border-[#258A83]"
                  >
                    {participantOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (ID: {p.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>

                {activeParticipantRecord && (
                  <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                    <span className="rounded-lg bg-white border border-[#EAE0CF] px-2.5 py-1 font-bold text-[#258A83]">
                      {activeParticipantRecord.completed_count}/9 Approved
                    </span>
                    <span className="rounded-lg bg-white border border-[#EAE0CF] px-2.5 py-1 font-semibold text-[#4F627A]">
                      {activeParticipantSubmissions.size}/9 Submitted
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CHALLENGES.map((challenge) => {
                  const sub = activeParticipantSubmissions.get(challenge.id);
                  const key = `${activeParticipantId}:${challenge.id}`;
                  const isVerifying = Boolean(verifyingKeys[key]);

                  if (!sub) {
                    return (
                      <div
                        key={challenge.id}
                        className="rounded-2xl border border-dashed border-[#DCE3EC] bg-[#FAFCFE] p-3.5 flex flex-col justify-between min-h-[190px]"
                      >
                        <div>
                          <span className="text-[11px] font-bold text-[#7D6E5D] tabular-nums">
                            {challenge.numberLabel} · {challenge.headline}
                          </span>
                          <p className="text-xs text-[#4F627A] mt-1">{challenge.prompt}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A9BAE]">
                          <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Not submitted yet</span>
                        </span>
                      </div>
                    );
                  }

                  return (
                    <article
                      key={challenge.id}
                      className={`rounded-2xl border bg-white overflow-hidden flex flex-col shadow-[0_2px_8px_rgba(20,43,73,0.05)] ${
                        sub.verification_status === 'approved'
                          ? 'border-[#B8D1BE]'
                          : sub.verification_status === 'rejected'
                            ? 'border-[#F08B76]/80'
                            : 'border-[#DCE3EC]'
                      }`}
                    >
                      <div className="relative aspect-[4/3] bg-[#EAEFF6] overflow-hidden group">
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxKey({
                              participantId: sub.participant_id,
                              challengeId: sub.challenge_id,
                            })
                          }
                          className="block w-full h-full cursor-pointer"
                        >
                          <img
                            src={sub.photo_url}
                            alt={`${sub.participant_name} - ${challenge.headline}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <div className="absolute top-2 left-2">
                          <StatusBadge status={sub.verification_status} />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxKey({
                              participantId: sub.participant_id,
                              challengeId: sub.challenge_id,
                            })
                          }
                          aria-label="View Full Image"
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[#142B49]/75 hover:bg-[#142B49] text-white flex items-center justify-center cursor-pointer"
                        >
                          <Expand className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#142B49]">
                            {challenge.numberLabel} · {challenge.headline}
                          </p>
                          <p className="text-[10.5px] text-[#4F627A] mt-0.5">
                            {formatDateTime(sub.submitted_at)}
                          </p>
                          {sub.verification_status === 'rejected' &&
                            sub.rejection_reason && (
                              <p className="mt-1.5 rounded-lg bg-[#FDF5F3] border border-[#F08B76]/50 px-2 py-1 text-[11px] text-[#A63A24]">
                                {sub.rejection_reason}
                              </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={
                              isVerifying || sub.verification_status === 'approved'
                            }
                            onClick={() =>
                              void onVerifySubmission(
                                sub.participant_id,
                                sub.challenge_id,
                                'approved',
                              )
                            }
                            className={`min-h-[34px] px-2 py-1 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed ${
                              sub.verification_status === 'approved'
                                ? 'bg-[#CFE2D3]/60 text-[#1E6245]'
                                : 'bg-[#258A83] hover:bg-[#1E726C] text-white disabled:opacity-50'
                            }`}
                          >
                            {isVerifying ? (
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>
                              {sub.verification_status === 'approved'
                                ? 'Approved'
                                : 'Approve'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() => handleOpenRejectModal(sub)}
                            className="min-h-[34px] px-2 py-1 rounded-xl border border-[#F08B76]/70 bg-white hover:bg-[#FDF5F3] text-[#A63A24] text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Full Image Lightbox Modal */}
      {lightboxSubmission && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="organiser-lightbox-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#142B49]/80 backdrop-blur-xs"
          onClick={() => setLightboxKey(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white border border-[#DCE3EC] shadow-2xl overflow-hidden text-[#142B49]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#DCE3EC] bg-[#FBF6EE]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={lightboxSubmission.verification_status} />
                  <span className="text-xs font-mono text-[#7D6E5D]">
                    ID: {lightboxSubmission.participant_id.slice(0, 8)}
                  </span>
                </div>
                <h3
                  id="organiser-lightbox-title"
                  className="text-sm sm:text-base font-extrabold text-[#142B49] mt-1"
                >
                  {lightboxSubmission.participant_name} · #
                  {CHALLENGE_MAP.get(lightboxSubmission.challenge_id)?.numberLabel ??
                    lightboxSubmission.challenge_id}{' '}
                  {CHALLENGE_MAP.get(lightboxSubmission.challenge_id)?.headline}
                </h3>
                <p className="text-xs text-[#4F627A] mt-0.5">
                  {CHALLENGE_MAP.get(lightboxSubmission.challenge_id)?.prompt} · Submitted{' '}
                  {formatDateTime(lightboxSubmission.submitted_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxKey(null)}
                aria-label="Close full image preview"
                className="min-w-[38px] min-h-[38px] -mr-1 rounded-xl text-[#5D7088] hover:text-[#142B49] hover:bg-white/80 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 bg-[#142B49] flex items-center justify-center">
              <img
                src={lightboxSubmission.photo_url}
                alt={`${lightboxSubmission.participant_name} submission`}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto rounded-xl object-contain"
              />
            </div>

            {lightboxSubmission.verification_status === 'rejected' &&
              lightboxSubmission.rejection_reason && (
                <div className="px-4 py-2.5 bg-[#FDF5F3] border-t border-[#F08B76]/50 text-xs text-[#A63A24]">
                  <strong>Rejection Reason:</strong>{' '}
                  {lightboxSubmission.rejection_reason}
                </div>
              )}

            <div className="p-4 bg-white border-t border-[#DCE3EC] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const pid = lightboxSubmission.participant_id;
                  setLightboxKey(null);
                  handleOpenParticipantView(pid);
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-xs font-bold text-[#142B49] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#258A83]" aria-hidden="true" />
                <span>View Participant (9 Cards)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={Boolean(
                    verifyingKeys[
                      `${lightboxSubmission.participant_id}:${lightboxSubmission.challenge_id}`
                    ],
                  )}
                  onClick={() => {
                    const target = lightboxSubmission;
                    setLightboxKey(null);
                    handleOpenRejectModal(target);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#F08B76]/70 bg-[#FDF5F3] hover:bg-[#FAE7E2] text-xs font-bold text-[#A63A24] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  disabled={
                    Boolean(
                      verifyingKeys[
                        `${lightboxSubmission.participant_id}:${lightboxSubmission.challenge_id}`
                      ],
                    ) || lightboxSubmission.verification_status === 'approved'
                  }
                  onClick={() =>
                    void onVerifySubmission(
                      lightboxSubmission.participant_id,
                      lightboxSubmission.challenge_id,
                      'approved',
                    )
                  }
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {lightboxSubmission.verification_status === 'approved'
                      ? 'Approved'
                      : 'Approve Photo'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject With Reason Modal */}
      {rejectTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-reason-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142B49]/65 backdrop-blur-xs"
          onClick={() => setRejectTarget(null)}
        >
          <form
            onSubmit={handleConfirmReject}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white border border-[#DCE3EC] shadow-xl overflow-hidden text-[#142B49]"
          >
            <div className="px-4 py-3.5 border-b border-[#DCE3EC] bg-[#FDF5F3] flex items-start justify-between gap-2">
              <div>
                <h3
                  id="reject-reason-title"
                  className="text-sm sm:text-base font-bold text-[#A63A24]"
                >
                  Reject Photograph
                </h3>
                <p className="text-xs text-[#7D2C1A] mt-0.5">
                  {rejectTarget.participant_name} · #
                  {CHALLENGE_MAP.get(rejectTarget.challenge_id)?.numberLabel ??
                    rejectTarget.challenge_id}{' '}
                  {CHALLENGE_MAP.get(rejectTarget.challenge_id)?.headline}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                aria-label="Cancel rejection"
                className="p-1.5 rounded-lg text-[#7D2C1A] hover:bg-white/70 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <label
                  htmlFor="rejection-reason-input"
                  className="block text-xs font-bold text-[#142B49] mb-1.5"
                >
                  Short Rejection Reason (visible to participant)
                </label>
                <textarea
                  id="rejection-reason-input"
                  rows={3}
                  maxLength={240}
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="e.g., Photo does not clearly show the connection or challenge."
                  className="w-full rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] px-3 py-2 text-xs sm:text-sm text-[#142B49] placeholder:text-[#8A9BAE] focus:bg-white focus:outline-none focus:border-[#E25546]"
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-[#4F627A] mb-1.5">
                  Quick reasons:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REJECTION_REASONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReasonInput(preset)}
                      className="rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] px-2.5 py-1 text-[11px] font-medium text-[#142B49] cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[#DCE3EC] bg-[#FAFCFE] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#DCE3EC] bg-white text-xs font-semibold text-[#4F627A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(
                  verifyingKeys[
                    `${rejectTarget.participant_id}:${rejectTarget.challenge_id}`
                  ],
                )}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#E25546] hover:bg-[#C94335] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {verifyingKeys[
                  `${rejectTarget.participant_id}:${rejectTarget.challenge_id}`
                ] ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
