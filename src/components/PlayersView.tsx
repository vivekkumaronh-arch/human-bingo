import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Lock,
  LogOut,
  Search,
  Share2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { buildEventInvitationText } from '../services/bingoApi';
import type { EventConfig, ParticipantRecord } from '../types/multiplayer';
import { EventExpiryCountdown } from './EventExpiryCountdown';

interface PlayersViewProps {
  event: EventConfig;
  participants: ParticipantRecord[];
  currentParticipantId: string;
  isCreator: boolean;
  isEndingGame: boolean;
  endGameError: string | null;
  onEndGame: () => Promise<void>;
  onLeaveGame: () => void;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  event,
  participants,
  currentParticipantId,
  isCreator,
  isEndingGame,
  endGameError,
  onEndGame,
  onLeaveGame,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const totalCompletedChallenges = useMemo(
    () =>
      participants.reduce(
        (sum, p) => sum + Math.max(0, Math.min(9, p.completed_count || 0)),
        0,
      ),
    [participants],
  );

  const finishedPlayersCount = useMemo(
    () => participants.filter((p) => p.is_completed).length,
    [participants],
  );

  const maxPossibleChallenges = participants.length * 9;
  const overallProgressPercent =
    maxPossibleChallenges > 0
      ? Math.round((totalCompletedChallenges / maxPossibleChallenges) * 100)
      : 0;

  const sortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? participants.filter((p) => p.full_name.toLowerCase().includes(q))
      : participants;

    return [...filtered].sort((a, b) => {
      if (a.id === currentParticipantId) return -1;
      if (b.id === currentParticipantId) return 1;
      if (b.completed_count !== a.completed_count) {
        return b.completed_count - a.completed_count;
      }
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });
  }, [currentParticipantId, participants, searchQuery]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(event.joining_code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore clipboard failures
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
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback('Invitation copied to clipboard!');
      window.setTimeout(() => setShareFeedback(null), 2500);
    } catch {
      setShareFeedback(`Share code ${event.joining_code} with your players.`);
      window.setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const handleConfirmEndGame = async () => {
    await onEndGame();
    setConfirmEndOpen(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Game Code & Share Card */}
      <section className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-4 sm:p-5 shadow-[0_8px_24px_rgba(23,46,77,0.06)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold tracking-[0.16em] text-[#218F87] uppercase">
              INVITE PLAYERS
            </p>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#172E4D] truncate">
              {event.title}
            </h2>
          </div>

          <div className="rounded-xl bg-white border border-[#DCE3EC] px-3 py-1.5 text-center shrink-0">
            <p className="text-[9px] font-bold tracking-wider uppercase text-[#5A6B80]">
              CODE
            </p>
            <p className="font-mono text-lg font-extrabold tracking-[0.16em] text-[#172E4D] tabular-nums leading-tight">
              {event.joining_code}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#172E4D] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 text-[#218F87]" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#218F87]" aria-hidden="true" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShareInvitation}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-[#218F87]/35 bg-[#E6F4F2] hover:bg-[#D5ECE9] text-[#145B56] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Share2 className="w-4 h-4 text-[#218F87]" aria-hidden="true" />
            <span>Share Code</span>
          </button>
        </div>

        {shareFeedback && (
          <p
            role="status"
            className="text-center text-xs font-semibold text-[#1B6E68] bg-[#DEF1EE] rounded-xl px-3 py-1.5"
          >
            {shareFeedback}
          </p>
        )}

        <EventExpiryCountdown
          expiresAt={event.expires_at}
          status={event.status}
          variant="compact"
        />
      </section>

      {/* Overall Game Progress Summary */}
      <section className="rounded-2xl bg-white border border-[#DCE3EC] p-4 shadow-[0_2px_10px_rgba(23,46,77,0.04)]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-[#172E4D]">
            Overall Game Progress
          </span>
          <span className="text-xs font-extrabold text-[#218F87] tabular-nums">
            {overallProgressPercent}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#E6ECF3] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#218F87] transition-all duration-300"
            style={{ width: `${overallProgressPercent}%` }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#4F6075] tabular-nums">
          <span>{participants.length} players joined</span>
          <span>{totalCompletedChallenges} challenges completed</span>
          <span>{finishedPlayersCount} finished 9/9</span>
        </div>
      </section>

      {/* Players List */}
      <section className="rounded-2xl bg-white border border-[#DCE3EC] p-4 shadow-[0_2px_10px_rgba(23,46,77,0.04)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#218F87]" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-[#172E4D]">
              Players in This Game
            </h3>
          </div>
          <span className="text-xs font-bold text-[#4F6075] tabular-nums">
            {participants.length}
          </span>
        </div>

        {participants.length > 6 && (
          <div className="relative mb-3">
            <Search
              className="w-4 h-4 text-[#7A8BA0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a player…"
              aria-label="Search players"
              className="w-full min-h-[40px] rounded-xl border border-[#DCE3EC] bg-[#F4F6F8] pl-9 pr-3 text-xs sm:text-sm text-[#172E4D] placeholder:text-[#7A8BA0] focus:outline-none focus:bg-white focus:border-[#218F87]"
            />
          </div>
        )}

        {sortedPlayers.length === 0 ? (
          <p className="py-5 text-center text-xs sm:text-sm text-[#4F6075]">
            {searchQuery.trim()
              ? 'No players match that name.'
              : 'No players have joined yet.'}
          </p>
        ) : (
          <div className="divide-y divide-[#EEF2F6]">
            {sortedPlayers.map((player) => {
              const isYou = player.id === currentParticipantId;
              const completed = Math.max(0, Math.min(9, player.completed_count || 0));
              const percent = Math.round((completed / 9) * 100);
              return (
                <div key={player.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-[#172E4D] truncate">
                        {player.full_name}
                      </span>
                      {isYou && (
                        <span className="text-[10px] font-extrabold text-[#218F87] shrink-0">
                          (You)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold tabular-nums">
                      <span className="text-[#172E4D]">{completed}/9</span>
                      {player.is_completed && (
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-[#218F87]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 w-full h-1.5 rounded-full bg-[#EAEFF5] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        player.is_completed ? 'bg-[#218F87]' : 'bg-[#172E4D]'
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

      {/* Creator-Only End Game Control + Leave Game */}
      <section className="flex flex-col gap-2.5">
        {endGameError && (
          <div
            role="alert"
            className="rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 text-xs font-medium text-[#A63A24]"
          >
            {endGameError}
          </div>
        )}

        {isCreator && event.status === 'active' && (
          <div className="rounded-2xl border border-[#F08B76]/45 bg-white p-4 shadow-[0_2px_10px_rgba(23,46,77,0.04)] flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#D96D57] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#172E4D]">
                  Game Creator Controls
                </p>
                <p className="text-[11px] text-[#4F6075] mt-0.5">
                  Ending the game stops new joins and photo uploads while keeping all submitted photos and leaderboard results visible.
                </p>
              </div>
            </div>

            {confirmEndOpen ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmEndGame}
                  disabled={isEndingGame}
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#D9534F] hover:bg-[#C2403C] text-white text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-55"
                >
                  {isEndingGame ? 'Ending Game…' : 'Confirm End Game'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEndOpen(false)}
                  disabled={isEndingGame}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCE3EC] bg-[#F4F6F8] text-[#4F6075] text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEndOpen(true)}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] hover:bg-[#FCE8E3] text-[#A63A24] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>End Game</span>
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onLeaveGame}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#4F6075] hover:text-[#172E4D] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Leave / Switch Game</span>
        </button>
      </section>
    </div>
  );
};
