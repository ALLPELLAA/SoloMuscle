import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DEFEAT_AT, TOTAL_MS } from './boss-timeline';

export type BossPhase = 'fight' | 'defeated';

export interface BossTimeline {
  /** Sequence clock in ms (0 → TOTAL_MS). */
  clock: SharedValue<number>;
  phase: BossPhase;
  /** True once the whole sequence has played (or was skipped). */
  done: boolean;
  reduceMotion: boolean;
  /** Jumps straight to the final frame. */
  skip(): void;
}

type Timer = ReturnType<typeof setTimeout>;

/** Drives the boss sequence: one linear clock plus the fight → defeated → done switches. */
export function useBossTimeline(): BossTimeline {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);
  const [phase, setPhase] = useState<BossPhase>('fight');
  const [done, setDone] = useState(false);
  const timers = useRef<Timer[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    clock.set(withTiming(TOTAL_MS, { duration: TOTAL_MS, easing: Easing.linear }));
    timers.current = [
      setTimeout(() => {
        setPhase('defeated');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      }, DEFEAT_AT),
      setTimeout(() => setDone(true), TOTAL_MS),
    ];
    return () => {
      clearTimers();
      cancelAnimation(clock);
    };
  }, [clock, clearTimers]);

  const skip = useCallback(() => {
    clearTimers();
    cancelAnimation(clock);
    clock.set(TOTAL_MS);
    setPhase('defeated');
    setDone(true);
  }, [clock, clearTimers]);

  return { clock, phase, done, reduceMotion, skip };
}
