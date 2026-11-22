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

/** Looping 0 → 1 → 0 value for neon "breathing" effects; paused (reset to 0) while the tab is hidden. */
export function usePulse(durationMs = 1200): SharedValue<number> {
  const focused = useIsFocused();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!focused) {
      cancelAnimation(pulse);
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [durationMs, focused, pulse]);
  return pulse;
}
