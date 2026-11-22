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

/**
 * Endless 0 ↔ 1 shared value for glowing halos and "breathing" buttons.
 * Paused (reset to 0) while the screen is not focused, e.g. on a hidden tab.
 */
export function useBreathe(durationMs = 1500, active = true): SharedValue<number> {
  const value = useSharedValue(0);
  const focused = useIsFocused();
  const running = active && focused;
  useEffect(() => {
    if (!running) {
      cancelAnimation(value);
      value.set(0);
      return;
    }
    value.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(value);
  }, [running, durationMs, value]);
  return value;
}
