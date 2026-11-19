import React from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { ChallengeItem, ChallengePhotoMap } from '../data/challenges';

interface CollageScreenProps {
  challenges: ChallengeItem[];
  photos: ChallengePhotoMap;
  onBackToEdit: () => void;
  onStartOver: () => void;
}

export const CollageScreen: React.FC<CollageScreenProps> = ({
  challenges,
  photos,
  onBackToEdit,
  onStartOver,
}) => {
  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-2.5 py-3 sm:px-6 sm:py-6">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl flex flex-col items-center">
        {/* Compact & Elegant Final Screen Header */}
        <header className="text-center mb-2.5 sm:mb-4">
          <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-[#142B49] leading-none">
            HUMAN BINGO
          </h1>
          <p className="text-[10.5px] sm:text-xs font-bold tracking-[0.18em] text-[#258A83] mt-1">
            9 CONNECTIONS. 9 MEMORIES.
          </p>
        </header>

        {/* Screenshot-Ready 3x3 Photographic Collage */}
        <main className="w-full rounded-2xl bg-white border border-[#DCE3EC] p-1.5 sm:p-2.5 shadow-[0_6px_24px_rgba(20,43,73,0.08)]">
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            {challenges.map((challenge) => {
              const photo = photos[challenge.id];
              return (
                <figure
                  key={challenge.id}
                  className="relative aspect-[1/1.1] sm:aspect-square w-full overflow-hidden rounded-md sm:rounded-lg bg-[#E9EEF5]"
                >
                  {photo && (
                    <img
                      src={photo.dataUrl}
                      alt={`${challenge.shortPrompt} (${challenge.prompt})`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Consistent bottom translucent caption strip */}
                  <figcaption className="absolute inset-x-0 bottom-0 bg-[#142B49]/75 backdrop-blur-[2px] px-1 py-1 sm:px-2 sm:py-1.5 min-h-[28px] sm:min-h-[36px] flex items-center justify-center text-center">
                    <span className="text-[9.5px] leading-[1.15] sm:text-xs sm:leading-tight font-semibold text-white">
                      {challenge.shortPrompt}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </main>

        {/* Final Actions */}
        <footer className="w-full mt-3 sm:mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onBackToEdit}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#142B49] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] cursor-pointer shadow-[0_1px_4px_rgba(20,43,73,0.04)]"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
            <span>Back to Edit</span>
          </button>

          <button
            type="button"
            onClick={onStartOver}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#142B49] hover:bg-[#1D3B63] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] cursor-pointer shadow-[0_2px_8px_rgba(20,43,73,0.16)]"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
            <span>Start Over</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
