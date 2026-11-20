import React from 'react';
import { ArrowLeft, Award, CheckCircle2, Clock, Medal, Trophy, Users } from 'lucide-react';
import { formatDuration, formatRankOrdinal, rankCompletedParticipants } from '../services/bingoApi';
import type { ParticipantRecord } from '../types/multiplayer';

interface LeaderboardViewProps {
  participants: ParticipantRecord[];
  currentParticipantId: string | null;
  eventTitle?: string;
  joiningCode?: string;
  onBack: () => void;
  backLabel: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  participants,
  currentParticipantId,
  eventTitle,
  joiningCode,
  onBack,
  backLabel,
}) => {
  const ranked = rankCompletedParticipants(participants);
  const topThree = ranked.slice(0, 3);
  const inProgress = participants
    .filter((p) => !p.is_completed)
    .sort((a, b) => {
      if (b.completed_count !== a.completed_count) {
        return b.completed_count - a.completed_count;
      }
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    });

  const sortedAllParticipants = [...ranked, ...inProgress];

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] px-3 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-xs sm:text-sm font-semibold text-[#142B49] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shadow-[0_1px_4px_rgba(20,43,73,0.04)]"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>

          <div className="text-right min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#258A83] truncate">
              {joiningCode ? `EVENT ${joiningCode}` : 'LIVE EVENT STANDINGS'}
            </p>
            <h1 className="font-display text-lg sm:text-2xl font-extrabold text-[#142B49] leading-tight truncate">
              {eventTitle ? `${eventTitle} · Leaderboard` : 'Leaderboard'}
            </h1>
          </div>
        </header>

        {/* Top 3 Podium */}
        <section className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-3.5 sm:p-5 shadow-[0_8px_24px_rgba(20,43,73,0.06)]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#E25546]" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-bold text-[#142B49]">
                Top Finishers
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#7D6E5D] tabular-nums">
              {ranked.length} completed
            </span>
          </div>

          {topThree.length === 0 ? (
            <div className="rounded-xl bg-white/80 border border-[#EAE0CF] p-4 text-center">
              <p className="text-xs sm:text-sm font-medium text-[#4F627A]">
                No participant has finished all 9 challenges yet. Complete yours first to claim 1st Place!
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
                      className="rounded-xl bg-white/55 border border-dashed border-[#DCD0BE] p-3 flex flex-col justify-between min-h-[82px]"
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
                    className={`rounded-xl bg-white border p-3 flex flex-col justify-between gap-1.5 shadow-[0_2px_8px_rgba(20,43,73,0.05)] ${
                      isCurrent ? 'border-[#258A83] ring-2 ring-[#258A83]/20' : 'border-[#EAE0CF]'
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
                        <span className="text-[10px] font-bold text-[#258A83]">You</span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-[#142B49] truncate">
                      {entry.full_name}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#4F627A] tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                        {formatDuration(entry.duration_seconds)}
                      </span>
                      <span>
                        {entry.completed_at
                          ? new Date(entry.completed_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ranked.length > 3 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {ranked.slice(3).map((entry) => {
                const isCurrent = entry.id === currentParticipantId;
                return (
                  <div
                    key={entry.id}
                    className={`rounded-xl bg-white border px-3 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm ${
                      isCurrent ? 'border-[#258A83] ring-1 ring-[#258A83]/25' : 'border-[#EAE0CF]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-bold tabular-nums text-[#4F627A] w-6 shrink-0">
                        #{entry.rank}
                      </span>
                      <span className="font-semibold text-[#142B49] truncate">
                        {entry.full_name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-[#258A83] shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-[#258A83] shrink-0">
                      {formatDuration(entry.duration_seconds)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Live Participant Progress Section */}
        <section className="rounded-2xl bg-white border border-[#DCE3EC] p-3.5 sm:p-5 shadow-[0_2px_10px_rgba(20,43,73,0.04)]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#258A83]" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-bold text-[#142B49]">
                Live Participant Progress
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#4F627A] tabular-nums">
              {participants.length} registered
            </span>
          </div>

          {sortedAllParticipants.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#4F627A] py-4 text-center">
              No participants registered yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[#EEF2F6]">
              {sortedAllParticipants.map((participant) => {
                const percent = Math.round((participant.completed_count / 9) * 100);
                const isCurrent = participant.id === currentParticipantId;
                const rankedMatch = ranked.find((r) => r.id === participant.id);

                return (
                  <div key={participant.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-[#142B49] truncate">
                          {participant.full_name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-[#258A83] shrink-0">
                            (You)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[11px] sm:text-xs tabular-nums">
                        <span className="font-semibold text-[#142B49]">
                          {participant.completed_count}/9
                        </span>
                        <span className="text-[#4F627A]">({percent}%)</span>
                        {participant.is_completed ? (
                          <span className="inline-flex items-center gap-1 font-bold text-[#258A83]">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {rankedMatch ? `#${rankedMatch.rank}` : 'Completed'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-[#7D6E5D]">
                            <Award className="w-3 h-3 opacity-0 shrink-0" aria-hidden="true" />
                            <span>Playing</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-1.5 w-full h-1.5 rounded-full bg-[#EAEFF5] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          participant.is_completed ? 'bg-[#258A83]' : 'bg-[#142B49]/75'
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
    </div>
  );
};
