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
  reduceMotion: boolean;
  /** Jumps straight to the final frame. */
  skip(): void;
}

/** Drives the boss sequence: one linear clock plus the fight → defeated phase switch. */
export function useBossTimeline(): BossTimeline {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);
  const [phase, setPhase] = useState<BossPhase>('fight');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    clock.set(withTiming(TOTAL_MS, { duration: TOTAL_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      timer.current = null;
      setPhase('defeated');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    }, DEFEAT_AT);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(clock);
    };
  }, [clock]);

  const skip = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    cancelAnimation(clock);
    clock.set(TOTAL_MS);
    setPhase('defeated');
  }, [clock]);

  return { clock, phase, reduceMotion, skip };
}
