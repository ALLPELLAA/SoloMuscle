import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, glow, radii } from '@/theme';

export interface NeonToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

const TRACK_W = 54;
const TRACK_H = 30;
const THUMB = 22;
const TRAVEL = TRACK_W - THUMB - 8;

/** Themed on/off switch (neon track, glowing thumb). Same look on Android and web. */
export function NeonToggle({ value, onValueChange, accessibilityLabel, disabled = false }: NeonToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: 180 }));
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.panelSolid, colors.neonDim]),
    borderColor: interpolateColor(progress.get(), [0, 1], [colors.textMuted, colors.neon]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * TRAVEL }],
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.textSecondary, colors.neonBright]),
  }));

  const toggle = () => {
    if (disabled) return;
    void Haptics.selectionAsync().catch(() => undefined);
    onValueChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      onPress={toggle}
      disabled={disabled}
      hitSlop={8}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, value && styles.trackOn, trackStyle]}>
        <Animated.View style={[styles.thumb, value && styles.thumbOn, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOn: { boxShadow: glow.neonSoft },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.pill,
  },
  thumbOn: { boxShadow: glow.neon },
  disabled: { opacity: 0.4 },
});
