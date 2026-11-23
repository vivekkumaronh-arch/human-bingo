import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Clock,
  Expand,
  Filter,
  Images,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { CHALLENGES } from '../data/challenges';
import type {
  EventPhotoWallSubmission,
  ParticipantRecord,
} from '../types/multiplayer';

interface EventPhotoWallProps {
  eventTitle: string;
  joiningCode: string;
  currentParticipantId: string | null;
  participants: ParticipantRecord[];
  photos: EventPhotoWallSubmission[];
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onBackToPlay?: () => void;
}

const CHALLENGE_MAP = new Map(CHALLENGES.map((c) => [c.id, c]));

function formatSubmissionTime(iso: string | null | undefined): string {
  if (!iso) return 'Just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })}, ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export const EventPhotoWall: React.FC<EventPhotoWallProps> = ({
  eventTitle,
  joiningCode,
  currentParticipantId,
  participants,
  photos,
  isLoading,
  errorMessage,
  onRefresh,
  onBackToPlay,
}) => {
  const [participantFilter, setParticipantFilter] = useState<string>('all');
  const [challengeFilter, setChallengeFilter] = useState<string>('all');
  const [previewItem, setPreviewItem] = useState<EventPhotoWallSubmission | null>(
    null,
  );

  useEffect(() => {
    if (!previewItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem]);

  const participantOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of participants) {
      names.set(p.id, p.full_name);
    }
    for (const photo of photos) {
      if (!names.has(photo.participant_id)) {
        names.set(photo.participant_id, photo.participant_name);
      }
    }
    return Array.from(names.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, photos]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((item) => {
      if (participantFilter !== 'all' && item.participant_id !== participantFilter) {
        return false;
      }
      if (challengeFilter !== 'all' && String(item.challenge_id) !== challengeFilter) {
        return false;
      }
      return true;
    });
  }, [challengeFilter, participantFilter, photos]);

  const hasActiveFilters =
    participantFilter !== 'all' || challengeFilter !== 'all';

  const resetFilters = () => {
    setParticipantFilter('all');
    setChallengeFilter('all');
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-3.5">
      {/* Header & Filter Card */}
      <section className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-3.5 sm:p-5 shadow-[0_8px_24px_rgba(23,46,77,0.06)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#DEF1EE] text-[#218F87] flex items-center justify-center shrink-0">
              <Images className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-extrabold text-[#172E4D] leading-tight truncate">
                Shared Photo Wall
              </h2>
              <p className="text-[11px] font-semibold text-[#5A6B80] truncate tabular-nums">
                {eventTitle} · {photos.length} photo{photos.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh Shared Photo Wall"
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs font-bold text-[#172E4D] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#218F87] ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* Simple Player & Challenge Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={participantFilter}
            onChange={(e) => setParticipantFilter(e.target.value)}
            aria-label="Filter by player"
            className="w-full min-h-[42px] rounded-xl border border-[#DCE3EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#172E4D] focus:outline-none focus:border-[#218F87]"
          >
            <option value="all">All Players ({participantOptions.length})</option>
            {participantOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === currentParticipantId ? ' (You)' : ''}
              </option>
            ))}
          </select>

          <select
            value={challengeFilter}
            onChange={(e) => setChallengeFilter(e.target.value)}
            aria-label="Filter by challenge"
            className="w-full min-h-[42px] rounded-xl border border-[#DCE3EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#172E4D] focus:outline-none focus:border-[#218F87]"
          >
            <option value="all">All 9 Challenges</option>
            {CHALLENGES.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.numberLabel} · {c.headline}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#4F6075]">
            <span className="inline-flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#218F87]" aria-hidden="true" />
              Showing {filteredPhotos.length} of {photos.length} photos
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="font-bold text-[#218F87] hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

      {/* Error Notice */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-medium text-[#A63A24]"
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

      {/* Photo Grid / Loading / Empty */}
      {isLoading && photos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#DCE3EC] py-14 flex flex-col items-center justify-center gap-2.5 text-[#4F6075]">
          <Loader2 className="w-6 h-6 animate-spin text-[#218F87]" aria-hidden="true" />
          <p className="text-xs sm:text-sm font-medium">
            Loading shared photos for game {joiningCode}…
          </p>
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCE3EC] bg-white py-12 px-4 text-center">
          <Camera className="w-9 h-9 text-[#8A9BAE] mx-auto mb-2.5" aria-hidden="true" />
          <p className="text-sm sm:text-base font-bold text-[#172E4D]">
            No photos shared yet
          </p>
          <p className="text-xs text-[#4F6075] mt-1 max-w-md mx-auto">
            Photos submitted by players in game{' '}
            <strong className="font-mono">{joiningCode}</strong> appear here automatically.
          </p>
          {onBackToPlay && (
            <button
              type="button"
              onClick={onBackToPlay}
              className="mt-4 min-h-[42px] px-4 py-2 rounded-xl bg-[#218F87] hover:bg-[#19756E] text-white text-xs font-bold cursor-pointer"
            >
              Take Your First Photo
            </button>
          )}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCE3EC] bg-white py-10 px-4 text-center">
          <p className="text-sm font-bold text-[#172E4D]">
            No photos match the selected filters
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2.5 min-h-[40px] px-4 py-1.5 rounded-xl bg-[#218F87] text-white text-xs font-bold cursor-pointer"
          >
            Show All Photos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
          {filteredPhotos.map((item) => {
            const challenge = CHALLENGE_MAP.get(item.challenge_id);
            const isOwn = item.participant_id === currentParticipantId;

            return (
              <article
                key={`${item.participant_id}:${item.challenge_id}`}
                className={`rounded-2xl border bg-white overflow-hidden flex flex-col shadow-[0_2px_10px_rgba(23,46,77,0.05)] ${
                  isOwn
                    ? 'border-[#218F87]/70 ring-1 ring-[#218F87]/15'
                    : 'border-[#DCE3EC]'
                }`}
              >
                <div className="relative aspect-[4/3] bg-[#EAEFF6] overflow-hidden group">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    aria-label={`View photo by ${item.participant_name} for ${challenge?.headline ?? `Challenge ${item.challenge_id}`}`}
                    className="block w-full h-full cursor-pointer"
                  >
                    <img
                      src={item.photo_url}
                      alt={`${item.participant_name} - ${challenge?.headline ?? `Challenge ${item.challenge_id}`}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  </button>

                  <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-md bg-[#172E4D]/80 backdrop-blur-xs px-1.5 py-0.5 text-[9.5px] font-bold text-white tabular-nums">
                    #{challenge?.numberLabel ?? item.challenge_id}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    title="View full size"
                    aria-label="View full size"
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-[#172E4D]/75 hover:bg-[#172E4D] text-white flex items-center justify-center backdrop-blur-xs cursor-pointer transition-colors"
                  >
                    <Expand className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="p-2.5 flex-1 flex flex-col justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#172E4D] truncate">
                      {item.participant_name}
                      {isOwn && (
                        <span className="ml-1 text-[10px] font-extrabold text-[#218F87]">
                          (You)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] font-semibold text-[#218F87] truncate mt-0.5">
                      {challenge?.headline ?? `Challenge ${item.challenge_id}`}
                    </p>
                  </div>

                  <div className="pt-1 border-t border-[#EEF2F6] flex items-center gap-1 text-[10px] font-medium text-[#5A6B80] tabular-nums">
                    <Clock className="w-3 h-3 shrink-0 text-[#218F87]" aria-hidden="true" />
                    <span className="truncate">{formatSubmissionTime(item.submitted_at)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Full-Size Image Preview Modal */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-wall-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#172E4D]/80 backdrop-blur-xs"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-white border border-[#DCE3EC] shadow-2xl overflow-hidden text-[#172E4D]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#DCE3EC] bg-[#FBF6EE]">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wider uppercase text-[#218F87]">
                  Challenge #
                  {CHALLENGE_MAP.get(previewItem.challenge_id)?.numberLabel ??
                    previewItem.challenge_id}{' '}
                  · {CHALLENGE_MAP.get(previewItem.challenge_id)?.headline}
                </p>
                <h3
                  id="event-wall-preview-title"
                  className="text-sm sm:text-base font-extrabold text-[#172E4D] mt-0.5 truncate"
                >
                  {previewItem.participant_name}
                  {previewItem.participant_id === currentParticipantId ? ' (You)' : ''}
                </h3>
                <p className="text-xs text-[#4F6075] mt-0.5">
                  {CHALLENGE_MAP.get(previewItem.challenge_id)?.prompt} ·{' '}
                  {formatFullDateTime(previewItem.submitted_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="Close full image preview"
                className="min-w-[40px] min-h-[40px] -mr-1 rounded-xl text-[#5D7088] hover:text-[#172E4D] hover:bg-white/80 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-3 sm:p-4 bg-[#172E4D] flex items-center justify-center">
              <img
                src={previewItem.photo_url}
                alt={`${previewItem.participant_name} - ${CHALLENGE_MAP.get(previewItem.challenge_id)?.headline ?? `Challenge ${previewItem.challenge_id}`}`}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
