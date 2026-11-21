import { useCallback, useState } from 'react';

import { useNow } from './use-now';

export interface Stopwatch {
  running: boolean;
  elapsedMs: number;
  /** Whole elapsed seconds (floor). */
  elapsedSeconds: number;
  start(): void;
  stop(): number;
  reset(): void;
}

/** Timestamp-based stopwatch (stays correct if the JS thread stalls). */
export function useStopwatch(): Stopwatch {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);
  const now = useNow(200, startedAt !== null);

  const elapsedMs = accumulated + (startedAt !== null ? Math.max(0, now - startedAt) : 0);

  const start = useCallback(() => {
    setStartedAt((prev) => prev ?? Date.now());
  }, []);

  const stop = useCallback(() => {
    let total = accumulated;
    if (startedAt !== null) total += Math.max(0, Date.now() - startedAt);
    setAccumulated(total);
    setStartedAt(null);
    return Math.floor(total / 1000);
  }, [accumulated, startedAt]);

  const reset = useCallback(() => {
    setAccumulated(0);
    setStartedAt(null);
  }, []);

  return {
    running: startedAt !== null,
    elapsedMs,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    start,
    stop,
    reset,
  };
}
