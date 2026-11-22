import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii, toneColors, type Tone } from '@/theme';

export interface ScanLineProps {
  tone: Tone;
  /** No sweeping band at all when reduced motion is requested. */
  reduceMotion: boolean;
}

const BAND = 26;

/** A faint band that keeps sweeping down the window like a scanner. Fills its parent. */
export function ScanLine({ tone, reduceMotion }: ScanLineProps) {
  const sweep = useSharedValue(0);
  const t = toneColors[tone];

  useEffect(() => {
    if (reduceMotion) return;
    sweep.set(withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(sweep);
  }, [reduceMotion, sweep]);

  const bandStyle = useAnimatedStyle(() => ({
    top: `${sweep.get() * 100}%`,
    opacity: sweep.get() < 0.06 ? sweep.get() / 0.06 : 1,
  }));

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.band, { backgroundColor: t.faint }, bandStyle]}>
        <View style={[styles.line, { backgroundColor: t.dim }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, borderRadius: radii.sm, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, height: BAND, marginTop: -BAND, justifyContent: 'flex-end' },
  line: { height: 1 },
});
