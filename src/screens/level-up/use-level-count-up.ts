import { useEffect, useState } from 'react';

/** Total time the count-up may take, regardless of how many levels were gained. */
const TOTAL_MS = 720;
const MIN_STEP_MS = 90;
const MAX_STEP_MS = 320;

/**
 * Counts an integer up from `from` to `to`, one step at a time, after `delayMs`.
 * When `animate` is false (reduced motion) the final value is returned immediately.
 */
export function useLevelCountUp(from: number, to: number, animate: boolean, delayMs = 520): number {
  const [value, setValue] = useState(animate ? from : to);

  useEffect(() => {
    if (!animate || to <= from) return;
    const steps = to - from;
    const stepMs = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, TOTAL_MS / steps));
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps; i += 1) {
      timers.push(setTimeout(() => setValue(from + i), delayMs + (i - 1) * stepMs));
    }
    return () => timers.forEach(clearTimeout);
  }, [animate, delayMs, from, to]);

  return animate ? value : to;
}
