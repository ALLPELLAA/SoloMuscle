import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Looping 0 → 1 → 0 value while `active` (0 otherwise), for neon glow effects. */
export function useNeonPulse(active: boolean, durationMs = 900): SharedValue<number> {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(pulse);
      pulse.set(withTiming(0, { duration: 200 }));
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [active, durationMs, pulse]);
  return pulse;
}
