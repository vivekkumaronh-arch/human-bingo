import React from 'react';
import { ArrowLeft, Award, CheckCircle2, Clock, PlusCircle, Trophy } from 'lucide-react';
import type { ChallengeItem, ChallengePhotoMap } from '../data/challenges';
import { formatDuration, formatRankOrdinal } from '../services/bingoApi';

interface CollageScreenProps {
  participantName: string;
  challenges: ChallengeItem[];
  photos: ChallengePhotoMap;
  rank: number | null;
  durationSeconds: number | null;
  allowReplay: boolean;
  onBackToEdit: () => void;
  onViewLeaderboard: () => void;
  onStartNewChallenge: () => void;
}

export const CollageScreen: React.FC<CollageScreenProps> = ({
  participantName,
  challenges,
  photos,
  rank,
  durationSeconds,
  allowReplay,
  onBackToEdit,
  onViewLeaderboard,
  onStartNewChallenge,
}) => {
  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-2.5 py-2.5 sm:px-6 sm:py-6">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl flex flex-col items-center">
        {/* Compact Completion Header */}
        <header className="text-center mb-2 sm:mb-3 w-full">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#258A83]/12 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold tracking-[0.16em] text-[#258A83]">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
            <span>CHALLENGE COMPLETED!</span>
          </div>

          <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-[#142B49] leading-tight mt-1">
            Congratulations, {participantName}.
          </h1>
          <p className="text-[11px] sm:text-xs font-medium text-[#4F627A] mt-0.5">
            You completed all 9 networking challenges.
          </p>

          {/* Compact Result Summary Strip */}
          <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-white border border-[#DCE3EC] px-3 py-1.5 text-[11px] sm:text-xs shadow-[0_2px_8px_rgba(20,43,73,0.04)]">
            <span className="inline-flex items-center gap-1 font-bold text-[#142B49] tabular-nums">
              <Award className="w-3.5 h-3.5 text-[#E25546] shrink-0" aria-hidden="true" />
              <span>{rank ? formatRankOrdinal(rank) : 'Ranked'}</span>
            </span>
            <span className="text-[#DCE3EC]" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#142B49] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#258A83] shrink-0" aria-hidden="true" />
              <span>{formatDuration(durationSeconds)}</span>
            </span>
            <span className="text-[#DCE3EC]" aria-hidden="true">
              ·
            </span>
            <span className="font-bold text-[#258A83] tabular-nums">
              9/9 Completed
            </span>
          </div>
        </header>

        {/* Screenshot-Ready 3x3 Photographic Collage */}
        <main className="w-full rounded-2xl bg-[#FBF6EE] border border-[#EAE0CF] p-1.5 sm:p-2.5 shadow-[0_8px_28px_rgba(20,43,73,0.08)]">
          <div className="flex items-center justify-between px-0.5 mb-1 sm:mb-1.5">
            <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.16em] text-[#7D6E5D]">
              HUMAN BINGO · 9 CONNECTIONS
            </span>
            <span className="inline-flex items-center rounded-full bg-[#E25546] px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-bold tracking-wider text-white tabular-nums">
              9/9 FILLED
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            {challenges.map((challenge) => {
              const photo = photos[challenge.id];
              return (
                <figure
                  key={challenge.id}
                  className="relative aspect-[1/1.08] sm:aspect-square w-full overflow-hidden rounded-md sm:rounded-lg bg-[#E9EEF5]"
                >
                  {photo && (
                    <img
                      src={photo.dataUrl}
                      alt={`${challenge.headline}: ${challenge.prompt}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}

                  <figcaption className="absolute inset-x-0 bottom-0 bg-[#142B49]/78 backdrop-blur-[2px] px-1 py-1 sm:px-2 sm:py-1.5 min-h-[26px] sm:min-h-[34px] flex items-center justify-center text-center">
                    <span className="text-[9px] leading-[1.15] sm:text-[11px] sm:leading-tight font-semibold text-white">
                      {challenge.shortPrompt}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </main>

        {/* Final Actions */}
        <footer className="w-full mt-2.5 sm:mt-3.5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onViewLeaderboard}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] cursor-pointer shadow-[0_3px_10px_rgba(37,138,131,0.24)]"
            >
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span>View Leaderboard</span>
            </button>

            <button
              type="button"
              onClick={onBackToEdit}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#142B49] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] cursor-pointer shadow-[0_1px_4px_rgba(20,43,73,0.04)]"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span>Back to Edit</span>
            </button>
          </div>

          {allowReplay && (
            <button
              type="button"
              onClick={onStartNewChallenge}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white/80 hover:bg-white text-[#142B49] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#258A83] shrink-0" aria-hidden="true" />
              <span>Start New Challenge</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
