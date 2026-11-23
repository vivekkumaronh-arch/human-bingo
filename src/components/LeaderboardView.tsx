import React from 'react';
import { CheckCircle2, Clock, Medal, Trophy } from 'lucide-react';
import {
  formatDuration,
  formatRankOrdinal,
  rankCompletedParticipants,
} from '../services/bingoApi';
import type { ParticipantRecord } from '../types/multiplayer';

interface LeaderboardViewProps {
  participants: ParticipantRecord[];
  totalSubmittedPhotos: number;
  currentParticipantId: string | null;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  participants,
  totalSubmittedPhotos,
  currentParticipantId,
}) => {
  const rankedFinishers = rankCompletedParticipants(participants);

  const inProgress = participants
    .filter((p) => !p.is_completed)
    .sort((a, b) => {
      if (b.completed_count !== a.completed_count) {
        return b.completed_count - a.completed_count;
      }
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    });

  const sortedAllParticipants = [...rankedFinishers, ...inProgress];
  const topThree = rankedFinishers.slice(0, 3);

  const totalCompletedChallenges = participants.reduce(
    (sum, p) => sum + Math.max(0, Math.min(9, p.completed_count || 0)),
    0,
  );
  const effectivePhotosSubmitted = Math.max(
    totalSubmittedPhotos,
    totalCompletedChallenges,
  );
  const maxPossibleChallenges = participants.length * 9;
  const overallProgressPercent =
    maxPossibleChallenges > 0
      ? Math.round((totalCompletedChallenges / maxPossibleChallenges) * 100)
      : 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Overall Game Activity Summary */}
      <section className="rounded-2xl sm:rounded-3xl bg-white border border-[#DCE3EC] p-4 sm:p-5 shadow-[0_4px_16px_rgba(23,46,77,0.05)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-sm sm:text-base font-extrabold text-[#172E4D]">
            Overall Game Activity
          </h2>
          <span className="text-xs font-extrabold text-[#218F87] tabular-nums">
            {overallProgressPercent}% overall
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#F4F6F8] border border-[#E2E8F0] p-2.5 text-center">
            <p className="text-[9.5px] sm:text-[10.5px] font-bold tracking-wider text-[#5A6B80] uppercase">
              PARTICIPANTS
            </p>
            <p className="font-display text-lg sm:text-xl font-extrabold text-[#172E4D] tabular-nums mt-0.5">
              {participants.length}
            </p>
          </div>

          <div className="rounded-xl bg-[#FBF6EE] border border-[#EAE0CF] p-2.5 text-center">
            <p className="text-[9.5px] sm:text-[10.5px] font-bold tracking-wider text-[#7D6E5D] uppercase">
              PHOTOS SUBMITTED
            </p>
            <p className="font-display text-lg sm:text-xl font-extrabold text-[#172E4D] tabular-nums mt-0.5">
              {effectivePhotosSubmitted}
            </p>
          </div>

          <div className="rounded-xl bg-[#E6F4F2] border border-[#BEE2DC] p-2.5 text-center">
            <p className="text-[9.5px] sm:text-[10.5px] font-bold tracking-wider text-[#1B6E68] uppercase">
              COMPLETED
            </p>
            <p className="font-display text-lg sm:text-xl font-extrabold text-[#1B6E68] tabular-nums mt-0.5">
              {totalCompletedChallenges}
            </p>
          </div>
        </div>

        <div className="mt-3 w-full h-2 rounded-full bg-[#EAEFF5] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#218F87] transition-all duration-300"
            style={{ width: `${overallProgressPercent}%` }}
          />
        </div>
      </section>

      {/* Top 3 Finishers Podium */}
      <section className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-4 sm:p-5 shadow-[0_8px_24px_rgba(23,46,77,0.06)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#E25546]" aria-hidden="true" />
            <h2 className="font-display text-sm sm:text-base font-extrabold text-[#172E4D]">
              Top Finishers (9/9)
            </h2>
          </div>
          <span className="text-xs font-semibold text-[#7D6E5D] tabular-nums">
            {rankedFinishers.length} finished
          </span>
        </div>

        {topThree.length === 0 ? (
          <div className="rounded-xl bg-white/85 border border-[#EAE0CF] p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-[#4F6075]">
              No one has completed all 9 challenges yet. Finish yours first to claim 1st Place!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[0, 1, 2].map((slotIndex) => {
              const entry = topThree[slotIndex];
              const placeLabel = formatRankOrdinal(slotIndex + 1);
              const badgeStyle =
                slotIndex === 0
                  ? 'bg-[#F7E3AC] text-[#6B4E08] border-[#E4C267]'
                  : slotIndex === 1
                    ? 'bg-[#E6ECF3] text-[#354B66] border-[#CBD5E1]'
                    : 'bg-[#F4D6CB] text-[#7D3622] border-[#E1AC9B]';

              if (!entry) {
                return (
                  <div
                    key={placeLabel}
                    className="rounded-xl bg-white/55 border border-dashed border-[#DCD0BE] p-3 flex flex-col justify-between min-h-[78px]"
                  >
                    <span className="text-[11px] font-bold text-[#7D6E5D]">
                      {placeLabel}
                    </span>
                    <span className="text-xs text-[#8A7D6D]">Open spot</span>
                  </div>
                );
              }

              const isCurrent = entry.id === currentParticipantId;

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl bg-white border p-3 flex flex-col justify-between gap-1.5 shadow-[0_2px_8px_rgba(23,46,77,0.05)] ${
                    isCurrent
                      ? 'border-[#218F87] ring-2 ring-[#218F87]/20'
                      : 'border-[#EAE0CF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${badgeStyle}`}
                    >
                      <Medal className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>{placeLabel}</span>
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-extrabold text-[#218F87]">
                        You
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold text-[#172E4D] truncate">
                    {entry.full_name}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[#4F6075] tabular-nums">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3 text-[#218F87]" aria-hidden="true" />
                      {formatDuration(entry.duration_seconds)}
                    </span>
                    <span>
                      {entry.completed_at
                        ? new Date(entry.completed_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Full Leaderboard */}
      <section className="rounded-2xl bg-white border border-[#DCE3EC] p-4 sm:p-5 shadow-[0_2px_10px_rgba(23,46,77,0.04)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-sm sm:text-base font-extrabold text-[#172E4D]">
            Live Leaderboard
          </h2>
          <span className="text-xs font-semibold text-[#4F6075] tabular-nums">
            {participants.length} player{participants.length === 1 ? '' : 's'}
          </span>
        </div>

        {sortedAllParticipants.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#4F6075] py-4 text-center">
            No players have joined yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[#EEF2F6]">
            {sortedAllParticipants.map((participant, idx) => {
              const completed = Math.max(0, Math.min(9, participant.completed_count || 0));
              const percent = Math.round((completed / 9) * 100);
              const isCurrent = participant.id === currentParticipantId;

              return (
                <div key={participant.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 text-xs font-extrabold text-[#5A6B80] tabular-nums shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#172E4D] truncate">
                        {participant.full_name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-extrabold text-[#218F87] shrink-0">
                          (You)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums">
                      <span className="font-bold text-[#172E4D]">
                        {completed}/9
                      </span>
                      {participant.is_completed ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#218F87]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{formatDuration(participant.duration_seconds)}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#5A6B80]">
                          {percent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 w-full h-1.5 rounded-full bg-[#EAEFF5] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        participant.is_completed ? 'bg-[#218F87]' : 'bg-[#172E4D]'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
