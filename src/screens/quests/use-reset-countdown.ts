import { msUntilNextMidnight } from '@/game';
import { useNow } from '@/hooks/use-now';

import { formatCountdown } from './format';

const DAY_MS = 86_400_000;

export interface ResetCountdown {
  remainingMs: number;
  /** `05:12:33` */
  label: string;
  /** 0..1 share of the current day that has passed (for the header bar). */
  dayProgress: number;
}

/** Live countdown to the next local 00:00, when the daily quest is renewed. */
export function useResetCountdown(): ResetCountdown {
  const now = useNow(1000);
  const remainingMs = msUntilNextMidnight(now);
  return {
    remainingMs,
    label: formatCountdown(remainingMs),
    dayProgress: Math.min(1, Math.max(0, 1 - remainingMs / DAY_MS)),
  };
}
