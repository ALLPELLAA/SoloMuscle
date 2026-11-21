import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radii } from '@/theme';

export interface ProgressBarProps {
  /** 0..1 (clamped). */
  progress: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Thin neon bar that animates to its value. */
export function ProgressBar({ progress, color = colors.neon, height = 6, style, accessibilityLabel }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(clamped);

  useEffect(() => {
    value.value = withTiming(clamped, { duration: 450 });
  }, [clamped, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height }, style]}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: color, boxShadow: `0 0 8px ${color}` }, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.neonFaint,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
