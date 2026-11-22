import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Looping 0 → 1 → 0 value while `active` (0 otherwise), for neon glow effects; paused while the tab is hidden. */
export function useNeonPulse(active: boolean, durationMs = 900): SharedValue<number> {
  const focused = useIsFocused();
  const running = active && focused;
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!running) {
      cancelAnimation(pulse);
      pulse.set(withTiming(0, { duration: 200 }));
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [running, durationMs, pulse]);
  return pulse;
}
