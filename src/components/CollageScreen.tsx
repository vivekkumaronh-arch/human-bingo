import React from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Images,
  Trophy,
} from 'lucide-react';
import type { ChallengeItem, ChallengePhotoMap } from '../data/challenges';
import { formatDuration, formatRankOrdinal } from '../services/bingoApi';

interface CollageScreenProps {
  participantName: string;
  challenges: ChallengeItem[];
  photos: ChallengePhotoMap;
  rank: number | null;
  durationSeconds: number | null;
  completedCount: number;
  onBackToBoard: () => void;
  onViewLeaderboard: () => void;
  onViewPhotoWall: () => void;
}

export const CollageScreen: React.FC<CollageScreenProps> = ({
  participantName,
  challenges,
  photos,
  rank,
  durationSeconds,
  completedCount,
  onBackToBoard,
  onViewLeaderboard,
  onViewPhotoWall,
}) => {
  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col items-center justify-center px-3 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl flex flex-col items-center">
        {/* Compact Completion Header */}
        <header className="text-center mb-3 w-full">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#DEF1EE] px-3 py-1 text-[10.5px] sm:text-xs font-bold tracking-[0.16em] text-[#1B6E68]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>9/9 CHALLENGES COMPLETED!</span>
          </div>

          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#172E4D] leading-tight mt-1.5">
            Congratulations, {participantName}.
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#4F6075] mt-0.5">
            You completed every networking challenge and captured the full board.
          </p>

          <div className="mt-2.5 inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl bg-white border border-[#DCE3EC] px-3.5 py-1.5 text-xs shadow-[0_2px_8px_rgba(23,46,77,0.04)]">
            {rank && (
              <>
                <span className="inline-flex items-center gap-1 font-bold text-[#172E4D] tabular-nums">
                  <Award className="w-3.5 h-3.5 text-[#E25546] shrink-0" aria-hidden="true" />
                  <span>{formatRankOrdinal(rank)}</span>
                </span>
                <span className="text-[#DCE3EC]" aria-hidden="true">
                  ·
                </span>
              </>
            )}
            <span className="inline-flex items-center gap-1 font-semibold text-[#172E4D] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#218F87] shrink-0" aria-hidden="true" />
              <span>{formatDuration(durationSeconds)}</span>
            </span>
            <span className="text-[#DCE3EC]" aria-hidden="true">
              ·
            </span>
            <span className="font-bold text-[#218F87] tabular-nums">
              {completedCount}/{challenges.length} Completed
            </span>
          </div>
        </header>

        {/* 3x3 Photographic Collage */}
        <main className="w-full rounded-2xl bg-[#FBF6EE] border border-[#EAE0CF] p-2 sm:p-3 shadow-[0_8px_28px_rgba(23,46,77,0.08)]">
          <div className="flex items-center justify-between px-0.5 mb-1.5">
            <span className="text-[10px] font-bold tracking-[0.16em] text-[#7D6E5D]">
              HUMAN BINGO · 9 CONNECTIONS
            </span>
            <span className="inline-flex items-center rounded-full bg-[#218F87] px-2 py-0.5 text-[9.5px] font-bold tracking-wider text-white tabular-nums">
              9/9 DONE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {challenges.map((challenge) => {
              const photo = photos[challenge.id];
              return (
                <figure
                  key={challenge.id}
                  className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#E9EEF5]"
                >
                  {photo && (
                    <img
                      src={photo.dataUrl}
                      alt={`${challenge.headline}: ${challenge.prompt}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}

                  <figcaption className="absolute inset-x-0 bottom-0 bg-[#172E4D]/78 backdrop-blur-[2px] px-1 py-1 sm:px-2 sm:py-1.5 flex items-center justify-center text-center">
                    <span className="text-[9px] leading-[1.15] sm:text-[11px] sm:leading-tight font-semibold text-white truncate">
                      {challenge.shortPrompt}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </main>

        {/* Final Actions */}
        <footer className="w-full mt-3.5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onViewPhotoWall}
              className="min-h-[46px] px-3 py-2 rounded-xl bg-[#218F87] hover:bg-[#19756E] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shadow-[0_4px_12px_rgba(33,143,135,0.24)]"
            >
              <Images className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Photo Wall</span>
            </button>

            <button
              type="button"
              onClick={onViewLeaderboard}
              className="min-h-[46px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#172E4D] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-[#218F87] shrink-0" aria-hidden="true" />
              <span>Leaderboard</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onBackToBoard}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#172E4D] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Back to Bingo Board</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
