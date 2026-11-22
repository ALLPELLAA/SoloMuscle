import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Endless 0 ↔ 1 shared value for glowing halos and "breathing" buttons. */
export function useBreathe(durationMs = 1500, active = true): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      value.set(0);
      return;
    }
    value.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(value);
  }, [active, durationMs, value]);
  return value;
}
