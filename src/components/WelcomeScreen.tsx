import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Cake,
  Camera,
  Globe2,
  Heart,
  KeyRound,
  Languages,
  Loader2,
  MapPin,
  Palette,
  Plus,
  Type,
  Users,
  X,
} from 'lucide-react';

interface WelcomeScreenProps {
  isCreatingGame: boolean;
  errorMessage: string | null;
  onCreateGame: () => Promise<void>;
  onJoinGame: () => void;
}

interface PreviewChallenge {
  number: string;
  title: string;
  description: string;
  surfaceClass: string;
  expandedBorderClass: string;
  accentDotClass: string;
  iconColorClass: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const PREVIEW_CHALLENGES: PreviewChallenge[] = [
  {
    number: '01',
    title: 'Birthday Twin',
    description: 'Find someone born in the same month as you.',
    surfaceClass: 'bg-[#FDE9DC] border-[#F4CEB7]',
    expandedBorderClass: 'border-[#E6AD8B]',
    accentDotClass: 'bg-[#F6C8AC]/55',
    iconColorClass: 'text-[#B2542D]',
    Icon: Cake,
  },
  {
    number: '02',
    title: 'Colour Connection',
    description: 'Find someone wearing the same dominant colour as you.',
    surfaceClass: 'bg-[#E3F0E6] border-[#C5DEC9]',
    expandedBorderClass: 'border-[#96C29E]',
    accentDotClass: 'bg-[#BBD7C1]/60',
    iconColorClass: 'text-[#2B6E47]',
    Icon: Palette,
  },
  {
    number: '03',
    title: 'Fellow Facilitator',
    description: 'Find someone who shares the same professional profile as you.',
    surfaceClass: 'bg-[#FCF1CE] border-[#EFE0AC]',
    expandedBorderClass: 'border-[#DFC26D]',
    accentDotClass: 'bg-[#EED58C]/60',
    iconColorClass: 'text-[#8E6514]',
    Icon: Award,
  },
  {
    number: '04',
    title: 'Same, Same, But Different',
    description: 'Find someone whose first name starts with the same letter as yours.',
    surfaceClass: 'bg-[#E1ECF7] border-[#C6DAF0]',
    expandedBorderClass: 'border-[#96B9DF]',
    accentDotClass: 'bg-[#BAD1EB]/60',
    iconColorClass: 'text-[#2B5D93]',
    Icon: Type,
  },
  {
    number: '05',
    title: 'The Learning Bug',
    description: 'Find someone who recently learned a completely new skill.',
    surfaceClass: 'bg-[#F5DFD6] border-[#E8C5B8]',
    expandedBorderClass: 'border-[#D49B86]',
    accentDotClass: 'bg-[#E2B9AA]/55',
    iconColorClass: 'text-[#9F4732]',
    Icon: BookOpen,
  },
  {
    number: '06',
    title: 'Passport Pals',
    description: 'Find someone who loves travelling as much as you do.',
    surfaceClass: 'bg-[#ECE6F7] border-[#D6CBEB]',
    expandedBorderClass: 'border-[#B4A0DB]',
    accentDotClass: 'bg-[#C9BCE4]/60',
    iconColorClass: 'text-[#5A458F]',
    Icon: Globe2,
  },
  {
    number: '07',
    title: 'Passion Match',
    description: 'Find someone who shares your favourite hobby.',
    surfaceClass: 'bg-[#F5EDE1] border-[#E5D7C2]',
    expandedBorderClass: 'border-[#CBB493]',
    accentDotClass: 'bg-[#DAC7AC]/55',
    iconColorClass: 'text-[#7C5A34]',
    Icon: Heart,
  },
  {
    number: '08',
    title: 'Polyglot Pro',
    description: 'Find someone who can speak three or more languages.',
    surfaceClass: 'bg-[#DEF1EE] border-[#BEE2DC]',
    expandedBorderClass: 'border-[#86C7BD]',
    accentDotClass: 'bg-[#AED9D1]/60',
    iconColorClass: 'text-[#1B6E68]',
    Icon: Languages,
  },
  {
    number: '09',
    title: 'Roots & Routes',
    description: 'Find someone from your hometown or who has lived there.',
    surfaceClass: 'bg-[#FAE4DF] border-[#EFC8BF]',
    expandedBorderClass: 'border-[#DF9E90]',
    accentDotClass: 'bg-[#E9B8AE]/55',
    iconColorClass: 'text-[#A23E32]',
    Icon: MapPin,
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: 'STEP 1 – CREATE OR JOIN',
    description: 'Create a game or join one using a four-digit code.',
    Icon: KeyRound,
    iconBgClass: 'bg-[#DEF1EE] text-[#218F87]',
  },
  {
    step: 'STEP 2 – MEET PEOPLE',
    description: 'Find people who match the descriptions on your Bingo board.',
    Icon: Users,
    iconBgClass: 'bg-[#FCF1CE] text-[#8E6514]',
  },
  {
    step: 'STEP 3 – CAPTURE THE MOMENT',
    description: 'Upload photos, complete challenges and watch your progress grow.',
    Icon: Camera,
    iconBgClass: 'bg-[#E1ECF7] text-[#2B5D93]',
  },
];

const LOGO_TILES = [
  { color: 'bg-[#F2B591]', delay: '0ms' },
  { color: 'bg-[#97C9A4]', delay: '450ms' },
  { color: 'bg-[#EBC766]', delay: '900ms' },
  { color: 'bg-[#95BAE0]', delay: '600ms' },
  { color: 'bg-[#DC9D88]', delay: '1050ms' },
  { color: 'bg-[#B7A4DA]', delay: '300ms' },
  { color: 'bg-[#D7C6AC]', delay: '750ms' },
  { color: 'bg-[#218F87]', delay: '150ms' },
  { color: 'bg-[#E59D90]', delay: '1200ms' },
];

const BingoLogoMark: React.FC = () => (
  <span className="inline-grid grid-cols-3 gap-0.5 shrink-0" aria-hidden="true">
    {LOGO_TILES.map((tile, index) => (
      <span
        key={index}
        style={{ animationDelay: tile.delay }}
        className={`w-2 h-2 rounded-[2px] bingo-logo-tile ${tile.color}`}
      />
    ))}
  </span>
);

const HeroNetworkingIllustration: React.FC = () => (
  <div className="w-full max-w-[340px] lg:max-w-none mx-auto select-none" aria-hidden="true">
    <svg
      viewBox="0 0 360 156"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto block"
      role="presentation"
    >
      {/* Soft pastel scene backdrop */}
      <rect x="8" y="8" width="344" height="140" rx="22" fill="#FFFDF9" stroke="#EAE0CF" />
      <circle cx="72" cy="54" r="34" fill="#DEF1EE" fillOpacity="0.65" />
      <circle cx="184" cy="46" r="28" fill="#FCF1CE" fillOpacity="0.7" />
      <circle cx="288" cy="64" r="36" fill="#E1ECF7" fillOpacity="0.7" />

      {/* Dotted connection arcs between participants */}
      <path
        d="M96 58 C126 30, 152 30, 176 52"
        stroke="#218F87"
        strokeWidth="1.75"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <path
        d="M206 52 C230 30, 254 32, 276 58"
        stroke="#172E4D"
        strokeOpacity="0.45"
        strokeWidth="1.75"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />

      {/* Left speech bubble with heart */}
      <g>
        <rect x="108" y="18" width="38" height="22" rx="11" fill="#FFFFFF" stroke="#DFC26D" />
        <path
          d="M127 32.5 C127 32.5 122 29.3 122 26.3 C122 24.8 123.2 23.7 124.6 23.7 C125.6 23.7 126.5 24.3 127 25.1 C127.5 24.3 128.4 23.7 129.4 23.7 C130.8 23.7 132 24.8 132 26.3 C132 29.3 127 32.5 127 32.5 Z"
          fill="#E27A62"
        />
      </g>

      {/* Right speech bubble with mini 3x3 bingo check */}
      <g>
        <rect x="218" y="18" width="44" height="22" rx="11" fill="#FFFFFF" stroke="#BEE2DC" />
        <rect x="228" y="24" width="5" height="5" rx="1" fill="#F2B591" />
        <rect x="235" y="24" width="5" height="5" rx="1" fill="#218F87" />
        <rect x="242" y="24" width="5" height="5" rx="1" fill="#EBC766" />
        <rect x="249" y="26" width="5" height="1.8" rx="0.9" fill="#172E4D" fillOpacity="0.55" />
        <rect x="249" y="30" width="4" height="1.8" rx="0.9" fill="#172E4D" fillOpacity="0.35" />
      </g>

      {/* Person 1 (Left) — holding mini Bingo card */}
      <g>
        <path
          d="M44 147 C44 116, 61 102, 78 102 C95 102, 110 116, 110 147"
          fill="#218F87"
        />
        <circle cx="77" cy="79" r="15" fill="#F4C7A9" stroke="#172E4D" strokeWidth="1.6" />
        <path
          d="M62 77 C63 65, 73 61, 83 63 C90 64, 93 70, 92 77 C86 72, 71 71, 62 77 Z"
          fill="#172E4D"
        />
        <circle cx="73" cy="80" r="1.3" fill="#172E4D" />
        <circle cx="82" cy="80" r="1.3" fill="#172E4D" />
        <path
          d="M74.5 85 C76 87, 79 87, 80.5 85"
          stroke="#172E4D"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Mini Bingo card in hand */}
        <rect
          x="90"
          y="108"
          width="28"
          height="32"
          rx="6"
          fill="#FFFFFF"
          stroke="#172E4D"
          strokeWidth="1.5"
        />
        <rect x="95" y="114" width="5" height="5" rx="1" fill="#FDE9DC" />
        <rect x="102" y="114" width="5" height="5" rx="1" fill="#218F87" />
        <rect x="109" y="114" width="5" height="5" rx="1" fill="#FCF1CE" />
        <rect x="95" y="121" width="5" height="5" rx="1" fill="#E1ECF7" />
        <rect x="102" y="121" width="5" height="5" rx="1" fill="#F5DFD6" />
        <rect x="109" y="121" width="5" height="5" rx="1" fill="#ECE6F7" />
        <rect x="95" y="128" width="5" height="5" rx="1" fill="#F5EDE1" />
        <rect x="102" y="128" width="5" height="5" rx="1" fill="#DEF1EE" />
        <rect x="109" y="128" width="5" height="5" rx="1" fill="#FAE4DF" />
      </g>

      {/* Person 2 (Center) — smiling & introducing */}
      <g>
        <path
          d="M148 147 C148 112, 165 98, 184 98 C203 98, 218 112, 218 147"
          fill="#F08B76"
        />
        <path
          d="M170 98 L184 114 L198 98"
          fill="#FFFFFF"
          fillOpacity="0.9"
        />
        <circle cx="183" cy="74" r="16" fill="#C98D6B" stroke="#172E4D" strokeWidth="1.6" />
        <path
          d="M167 73 C167 60, 177 55, 188 57 C196 58, 200 65, 199 74 C193 67, 175 66, 167 73 Z"
          fill="#172E4D"
        />
        <circle cx="178" cy="75" r="1.4" fill="#172E4D" />
        <circle cx="188" cy="75" r="1.4" fill="#172E4D" />
        <path
          d="M179.5 80.5 C181.5 83, 184.5 83, 186.5 80.5"
          stroke="#172E4D"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Friendly waving hand */}
        <path
          d="M149 124 C142 118, 140 109, 145 104 C148 101, 152 104, 151 109"
          stroke="#C98D6B"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>

      {/* Person 3 (Right) — snapping a photo memory */}
      <g>
        <path
          d="M250 147 C250 116, 267 102, 286 102 C305 102, 320 116, 320 147"
          fill="#172E4D"
        />
        <circle cx="285" cy="79" r="15" fill="#F7D5BA" stroke="#172E4D" strokeWidth="1.6" />
        <path
          d="M270 79 C270 64, 281 59, 293 62 C299 64, 301 71, 300 79 C294 72, 277 71, 270 79 Z"
          fill="#354A67"
        />
        <circle cx="280" cy="80" r="1.3" fill="#172E4D" />
        <circle cx="290" cy="80" r="1.3" fill="#172E4D" />
        <path
          d="M282 85.5 C283.5 87.5, 286.5 87.5, 288 85.5"
          stroke="#172E4D"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Camera / phone capture device */}
        <rect
          x="244"
          y="107"
          width="24"
          height="20"
          rx="5"
          fill="#FFFFFF"
          stroke="#172E4D"
          strokeWidth="1.5"
        />
        <circle cx="256" cy="117" r="4.5" fill="#218F87" />
        <circle cx="256" cy="117" r="1.8" fill="#FFFFFF" />
      </g>

      {/* Ground baseline */}
      <line x1="28" y1="147" x2="332" y2="147" stroke="#EAE0CF" strokeWidth="1.5" />
    </svg>
  </div>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  isCreatingGame,
  errorMessage,
  onCreateGame,
  onJoinGame,
}) => {
  const [expandedChallengeNumber, setExpandedChallengeNumber] = useState<string | null>(null);

  const selectedChallenge =
    PREVIEW_CHALLENGES.find((item) => item.number === expandedChallengeNumber) ?? null;

  const handleTogglePreviewCard = (number: string) => {
    setExpandedChallengeNumber((prev) => (prev === number ? null : number));
  };

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col">
      {/* Compact Mobile-First Sticky Top Bar */}
      <header className="sticky top-0 z-30 w-full bg-[#F4F6F8]/90 backdrop-blur-md border-b border-[#E2E8F0]/80">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 min-h-[44px] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] rounded-lg"
          >
            <BingoLogoMark />
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[#172E4D]">
              HUMAN BINGO
            </span>
          </a>

          <nav aria-label="Homepage navigation" className="flex items-center shrink-0">
            <a
              href="#how-to-play"
              className="min-h-[44px] px-2.5 inline-flex items-center text-xs sm:text-sm font-semibold text-[#4F6075] hover:text-[#172E4D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] rounded-lg"
            >
              How to Play
            </a>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1 w-full">
        {/* Hero Section */}
        <section className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 pt-3.5 pb-7 sm:pt-9 sm:pb-12">
          <div className="rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-4 sm:p-8 lg:p-10 shadow-[0_10px_30px_rgba(23,46,77,0.06)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-center">
              {/* Compact Networking Illustration (Top on mobile, Right on desktop) */}
              <div className="lg:col-span-5 lg:order-2">
                <HeroNetworkingIllustration />
              </div>

              {/* Hero Copy + Prominent Action Buttons */}
              <div className="lg:col-span-7 lg:order-1">
                <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] text-[#218F87]">
                  NETWORKING MADE FUN
                </p>

                <h1 className="font-display text-[1.75rem] leading-[1.12] sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight text-[#172E4D] mt-2 [text-wrap:balance]">
                  Meet People.
                  <br />
                  Discover Connections.
                </h1>

                <p className="mt-2.5 sm:mt-3.5 text-[14px] sm:text-base text-[#4F6075] leading-relaxed">
                  Turn ordinary introductions into extraordinary connections. Meet new people,
                  discover common interests and create memories through fun networking challenges.
                </p>

                {errorMessage && (
                  <p
                    role="alert"
                    className="mt-3.5 rounded-xl border border-[#F08B76]/60 bg-[#FDF5F3] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#A63A24]"
                  >
                    {errorMessage}
                  </p>
                )}

                <div className="mt-5 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={onCreateGame}
                    disabled={isCreatingGame}
                    className="w-full sm:w-auto sm:min-w-[216px] min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#218F87] hover:bg-[#19756E] hover:-translate-y-0.5 text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 ease-out shadow-[0_6px_18px_rgba(33,143,135,0.28)] hover:shadow-[0_8px_22px_rgba(33,143,135,0.34)] active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6EE]"
                  >
                    {isCreatingGame ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                        <span>Creating Game…</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>CREATE GAME</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onJoinGame}
                    disabled={isCreatingGame}
                    className="w-full sm:w-auto sm:min-w-[216px] min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#172E4D] hover:bg-[#1F3D66] hover:-translate-y-0.5 text-white text-sm font-bold tracking-wide inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 ease-out shadow-[0_6px_18px_rgba(23,46,77,0.16)] hover:shadow-[0_8px_22px_rgba(23,46,77,0.22)] active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6EE]"
                  >
                    <span>JOIN GAME</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>

                <p className="mt-3.5 text-xs sm:text-[13px] font-medium text-[#5A6B80] leading-relaxed">
                  Perfect for college events, workshops, team activities and social gatherings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Bingo Preview (Non-game 3x3 showcase grid with lightweight tap-to-expand) */}
        <section
          aria-labelledby="preview-heading"
          className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10"
        >
          <div className="mb-4 sm:mb-6">
            <h2
              id="preview-heading"
              className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#172E4D] [text-wrap:balance]"
            >
              Nine Challenges. Countless Connections.
            </h2>
            <p className="mt-1 text-sm sm:text-base text-[#4F6075]">
              Every square is an opportunity to meet someone new. Tap any card to read more.
            </p>
          </div>

          <div className="grid grid-cols-3 auto-rows-fr gap-1.5 min-[375px]:gap-2 sm:gap-3.5">
            {PREVIEW_CHALLENGES.map((item) => {
              const Icon = item.Icon;
              const isExpanded = expandedChallengeNumber === item.number;
              return (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => handleTogglePreviewCard(item.number)}
                  aria-expanded={isExpanded}
                  aria-controls="challenge-preview-detail"
                  className={`relative overflow-hidden rounded-xl sm:rounded-2xl border p-2.5 min-[375px]:p-3 sm:p-4 flex flex-col justify-between text-left min-w-0 h-full transition-all duration-150 ease-out cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(23,46,77,0.08)] active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] focus-visible:ring-offset-1 ${
                    item.surfaceClass
                  } ${
                    isExpanded
                      ? 'ring-2 ring-[#218F87] shadow-[0_6px_18px_rgba(33,143,135,0.14)]'
                      : 'shadow-[0_2px_8px_rgba(23,46,77,0.04)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute -bottom-3 -right-3 w-10 h-10 sm:w-14 sm:h-14 rounded-full ${item.accentDotClass}`}
                  />

                  {/* Top Row: Number & Icon cleanly aligned */}
                  <div className="relative z-10 w-full flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-xs font-bold tabular-nums leading-none text-[#172E4D]/70">
                      {item.number}
                    </span>
                    <Icon
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${item.iconColorClass}`}
                      aria-hidden={true}
                    />
                  </div>

                  {/* Consistent Title & Description Positioning */}
                  <div className="relative z-10 mt-2.5 sm:mt-3.5 flex flex-col flex-1 min-w-0">
                    <h3 className="font-display text-[10.5px] leading-[1.18] min-[375px]:text-[11.5px] sm:text-sm sm:leading-snug font-extrabold text-[#172E4D] line-clamp-2 min-h-[2.36em] break-words">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[9px] leading-[1.3] min-[375px]:text-[10px] sm:text-xs sm:leading-relaxed font-medium text-[#172E4D]/85 line-clamp-2 sm:line-clamp-3 break-words">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lightweight Expandable Full Description Panel */}
          <div id="challenge-preview-detail" aria-live="polite">
            {selectedChallenge && (
              <div
                className={`mt-3 sm:mt-4 rounded-2xl border p-4 sm:p-5 shadow-[0_6px_20px_rgba(23,46,77,0.07)] transition-all duration-150 ${selectedChallenge.surfaceClass} ${selectedChallenge.expandedBorderClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/80 border border-white flex items-center justify-center shrink-0">
                      <selectedChallenge.Icon
                        className={`w-4 h-4 ${selectedChallenge.iconColorClass}`}
                        aria-hidden={true}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold tracking-wider text-[#172E4D]/70 tabular-nums">
                        CHALLENGE {selectedChallenge.number} · PREVIEW
                      </p>
                      <h3 className="font-display text-sm sm:text-base font-extrabold text-[#172E4D] mt-0.5">
                        {selectedChallenge.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm font-medium text-[#172E4D]/90 leading-relaxed">
                        {selectedChallenge.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedChallengeNumber(null)}
                    aria-label="Close challenge preview"
                    className="w-10 h-10 rounded-xl bg-white/75 hover:bg-white text-[#172E4D] flex items-center justify-center shrink-0 transition-colors active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87]"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* How to Play Section */}
        <section
          id="how-to-play"
          aria-labelledby="how-to-play-heading"
          className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10 scroll-mt-16"
        >
          <div className="mb-4 sm:mb-6">
            <h2
              id="how-to-play-heading"
              className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#172E4D] [text-wrap:balance]"
            >
              How Does Human Bingo Work?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {HOW_IT_WORKS_STEPS.map((item) => {
              const StepIcon = item.Icon;
              return (
                <div
                  key={item.step}
                  className="rounded-2xl bg-white border border-[#DCE3EC] p-4 sm:p-5 shadow-[0_4px_14px_rgba(23,46,77,0.04)] flex items-start md:flex-col gap-3.5 transition-transform duration-150 ease-out hover:-translate-y-0.5"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBgClass}`}
                  >
                    <StepIcon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-extrabold tracking-wider text-[#218F87]">
                      {item.step}
                    </h3>
                    <p className="mt-1 text-sm text-[#4F6075] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom spacing before footer */}
        <div className="h-4 sm:h-6" aria-hidden="true" />
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-[#E2E8F0] bg-white">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-2">
              <BingoLogoMark />
              <span className="font-display text-sm font-extrabold tracking-tight text-[#172E4D]">
                HUMAN BINGO
              </span>
            </div>
            <p className="text-xs text-[#5A6B80]">
              Bringing people together, one challenge at a time.
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs font-semibold text-[#4F6075]">
            <a
              href="#how-to-play"
              className="min-h-[40px] inline-flex items-center hover:text-[#172E4D] hover:underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218F87] rounded-md"
            >
              How to Play
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
