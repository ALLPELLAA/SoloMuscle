import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_REST_SECONDS, adjustRestTimer, restRemainingMs, startRestTimer, type RestTimer } from '@/game';
import { useNow } from '@/hooks/use-now';

interface RunningRest {
  timer: RestTimer;
  /** Full length incl. adjustments, for the progress bar. */
  totalMs: number;
}

export interface RestTimerControls {
  presetSeconds: number;
  setPresetSeconds(seconds: number): void;
  /** True while a timer exists (running or finished, until skipped). */
  active: boolean;
  finished: boolean;
  remainingMs: number;
  /** 1 → 0 as the rest runs out. */
  progress: number;
  start(seconds?: number): void;
  adjust(deltaSeconds: number): void;
  skip(): void;
}

/** Timestamp-based rest timer (§9): remaining = max(0, startedAt + duration − now). */
export function useRestTimer(): RestTimerControls {
  const [presetSeconds, setPresetSeconds] = useState(DEFAULT_REST_SECONDS);
  const [rest, setRest] = useState<RunningRest | null>(null);
  const now = useNow(250, rest !== null);

  // `now` may lag a tick behind a freshly started timer; never count from before its start.
  const remainingMs = rest ? restRemainingMs(rest.timer, Math.max(now, rest.timer.startedAt)) : 0;
  const finished = rest !== null && remainingMs === 0;
  const progress = rest && rest.totalMs > 0 ? remainingMs / rest.totalMs : 0;

  const firedFor = useRef<RestTimer | null>(null);
  useEffect(() => {
    if (!rest || !finished || firedFor.current === rest.timer) return;
    firedFor.current = rest.timer;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [rest, finished]);

  const start = useCallback(
    (seconds?: number) => {
      const timer = startRestTimer(Date.now(), seconds ?? presetSeconds);
      setRest({ timer, totalMs: timer.durationMs });
    },
    [presetSeconds],
  );

  const adjust = useCallback((deltaSeconds: number) => {
    setRest((prev) => {
      if (!prev) return prev;
      const timer = adjustRestTimer(prev.timer, deltaSeconds, Date.now());
      const totalMs = Math.max(timer.durationMs, prev.totalMs + deltaSeconds * 1000, 1);
      return { timer, totalMs };
    });
  }, []);

  const skip = useCallback(() => setRest(null), []);

  const choosePreset = useCallback((seconds: number) => {
    setPresetSeconds(seconds);
    // Changing the preset during a rest restarts it with the new length.
    setRest((prev) => {
      if (!prev) return prev;
      const timer = startRestTimer(Date.now(), seconds);
      return { timer, totalMs: timer.durationMs };
    });
  }, []);

  return {
    presetSeconds,
    setPresetSeconds: choosePreset,
    active: rest !== null,
    finished,
    remainingMs,
    progress,
    start,
    adjust,
    skip,
  };
}
