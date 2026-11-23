import React from 'react';
import { Grid3X3, Images, Trophy, Users } from 'lucide-react';

export type GameNavTab = 'play' | 'photo-wall' | 'leaderboard' | 'players';

interface GameBottomNavProps {
  activeTab: GameNavTab;
  photoCount: number;
  playerCount: number;
  onSelectTab: (tab: GameNavTab) => void;
}

export const GameBottomNav: React.FC<GameBottomNavProps> = ({
  activeTab,
  photoCount,
  playerCount,
  onSelectTab,
}) => {
  const items: Array<{
    id: GameNavTab;
    label: string;
    badge?: number;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }> = [
    { id: 'play', label: 'PLAY', Icon: Grid3X3 },
    { id: 'photo-wall', label: 'PHOTO WALL', badge: photoCount, Icon: Images },
    { id: 'leaderboard', label: 'LEADERBOARD', Icon: Trophy },
    { id: 'players', label: 'PLAYERS', badge: playerCount, Icon: Users },
  ];

  return (
    <nav
      aria-label="Game navigation"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-[#DCE3EC] bg-white/95 backdrop-blur-md shadow-[0_-4px_18px_rgba(23,46,77,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="w-full max-w-2xl mx-auto grid grid-cols-4">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[58px] px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#218F87] ${
                isActive
                  ? 'text-[#218F87]'
                  : 'text-[#5A6B80] hover:text-[#172E4D]'
              }`}
            >
              <span
                className={`relative inline-flex items-center justify-center w-8 h-6 rounded-full transition-colors ${
                  isActive ? 'bg-[#DEF1EE]' : ''
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden={true} />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#172E4D] text-white text-[9px] font-bold leading-none flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-[9.5px] min-[375px]:text-[10px] font-extrabold tracking-wide leading-none whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
