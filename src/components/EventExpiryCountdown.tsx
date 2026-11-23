import React, { useEffect, useRef, useState } from 'react';
import { Clock, Lock } from 'lucide-react';
import type { EventStatus } from '../types/multiplayer';

interface EventExpiryCountdownProps {
  expiresAt: string;
  status: EventStatus;
  variant?: 'cream' | 'compact';
  onExpired?: () => void;
}

function computeRemainingMs(expiresAt: string): number {
  const targetMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(targetMs)) return 0;
  return Math.max(0, targetMs - Date.now());
}

export function formatRemainingCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export const EventExpiryCountdown: React.FC<EventExpiryCountdownProps> = ({
  expiresAt,
  status,
  variant = 'cream',
  onExpired,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    status === 'active' ? computeRemainingMs(expiresAt) : 0,
  );
  const notifiedExpiredRef = useRef(false);

  useEffect(() => {
    notifiedExpiredRef.current = false;

    if (status !== 'active') {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const next = computeRemainingMs(expiresAt);
      setRemainingMs(next);
      if (next <= 0 && !notifiedExpiredRef.current) {
        notifiedExpiredRef.current = true;
        onExpired?.();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [expiresAt, onExpired, status]);

  const isManuallyClosed = status === 'closed';
  const isExpired = status === 'expired' || (status === 'active' && remainingMs <= 0);

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
          isExpired || isManuallyClosed
            ? 'border-[#F08B76]/50 bg-[#FDF5F3] text-[#A63A24]'
            : 'border-[#EAE0CF] bg-white text-[#172E4D]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isExpired || isManuallyClosed ? (
            <Lock className="w-3.5 h-3.5 text-[#D96D57] shrink-0" aria-hidden="true" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-[#218F87] shrink-0" aria-hidden="true" />
          )}
          <span className="text-[10.5px] font-bold tracking-wider uppercase truncate">
            {isManuallyClosed
              ? 'Event Status'
              : isExpired
                ? 'Event Expired'
                : 'Event Expires In'}
          </span>
        </div>

        <span className="font-mono text-xs sm:text-sm font-extrabold tabular-nums shrink-0">
          {isManuallyClosed
            ? 'CLOSED'
            : isExpired
              ? 'CLOSED (EXPIRED)'
              : formatRemainingCountdown(remainingMs)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${
        isExpired || isManuallyClosed
          ? 'border-[#F08B76]/55 bg-[#FDF5F3] text-[#A63A24]'
          : 'border-[#EAE0CF] bg-white text-[#172E4D]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isExpired || isManuallyClosed
              ? 'bg-[#FCE8E3] text-[#A63A24]'
              : 'bg-[#DEF1EE] text-[#218F87]'
          }`}
        >
          {isExpired || isManuallyClosed ? (
            <Lock className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Clock className="w-4 h-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[#5A6B80]">
            {isManuallyClosed
              ? 'EVENT STATUS'
              : isExpired
                ? 'EVENT EXPIRED'
                : 'EVENT EXPIRES IN'}
          </p>
          <p className="font-mono text-lg sm:text-xl font-extrabold tabular-nums tracking-tight mt-0.5">
            {isManuallyClosed
              ? 'CLOSED'
              : isExpired
                ? 'CLOSED'
                : formatRemainingCountdown(remainingMs)}
          </p>
        </div>
      </div>

      <p className="text-[11px] font-medium text-[#5A6B80] text-right shrink-0">
        {isExpired || isManuallyClosed
          ? 'No longer accepting joins'
          : new Date(expiresAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
      </p>
    </div>
  );
};
