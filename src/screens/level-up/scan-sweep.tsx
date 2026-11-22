import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, glow } from '@/theme';

const BAND = 36;

/** A neon scan line that sweeps top → bottom over its parent, on a loop. Decorative only. */
export function ScanSweep() {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        250,
        withRepeat(withDelay(900, withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) })), -1, false),
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const onLayout = (event: LayoutChangeEvent) => height.set(event.nativeEvent.layout.height);

  const sweepStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.08, 0.9, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: p * (height.get() + BAND) - BAND }],
    };
  });

  return (
    <View pointerEvents="none" style={styles.clip} onLayout={onLayout}>
      <Animated.View style={[styles.sweep, sweepStyle]}>
        <View style={styles.band} />
        <View style={styles.line} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, margin: 1, overflow: 'hidden' },
  sweep: { position: 'absolute', left: 0, right: 0, top: 0, height: BAND },
  band: { flex: 1, backgroundColor: colors.neonFaint },
  line: { height: 2, backgroundColor: colors.neonBright, boxShadow: glow.neonStrong },
});
