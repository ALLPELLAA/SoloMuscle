import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

import { msUntilNextMidnight } from '@/game';

import { formatCountdown } from './format';

const DAY_MS = 86_400_000;

export interface ResetCountdown {
  remainingMs: number;
  /** `05:12:33` */
  label: string;
  /** 0..1 share of the current day that has passed (for the header bar). */
  dayProgress: number;
}

/** Live countdown to the next local 00:00, when the daily quest is renewed. Ticks only while the tab is visible. */
export function useResetCountdown(): ResetCountdown {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!focused) return;
    const tick = () => setNow(Date.now());
    // Catch up right away when the tab regains focus instead of showing the stale value for a second.
    const catchUp = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(catchUp);
      clearInterval(id);
    };
  }, [focused]);

  const remainingMs = msUntilNextMidnight(now);
  return {
    remainingMs,
    label: formatCountdown(remainingMs),
    dayProgress: Math.min(1, Math.max(0, 1 - remainingMs / DAY_MS)),
  };
}
