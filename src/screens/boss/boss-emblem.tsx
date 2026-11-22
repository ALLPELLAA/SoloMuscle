import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, radii, toneColors } from '@/theme';

import { BossCrack } from './boss-crack';
import { HIT_PULSE_FRAMES, KEYS } from './boss-timeline';
import type { BossPhase } from './use-boss-timeline';

export interface BossEmblemProps {
  clock: SharedValue<number>;
  phase: BossPhase;
  reduceMotion: boolean;
}

const SIZE = 124;
const DIAMOND = 76;
const ICON = 46;
const HALF = ICON / 2;

/** Boss portrait: skull in a glowing diamond that cracks and splits on defeat. */
export function BossEmblem({ clock, phase, reduceMotion }: BossEmblemProps) {
  const tone = phase === 'fight' ? toneColors.danger : toneColors.gold;
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.set(withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(clock.get(), HIT_PULSE_FRAMES.input, HIT_PULSE_FRAMES.output, Extrapolation.CLAMP) }],
  }));

  const crackStyle = useAnimatedStyle(() => {
    const p = interpolate(clock.get(), KEYS.crack, [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.35 + 0.65 * p }] };
  });

  const leftStyle = useAnimatedStyle(() => {
    const p = interpolate(clock.get(), KEYS.split, [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - 0.6 * p,
      transform: [{ translateX: -7 * p }, { translateY: 5 * p }, { rotate: `${-14 * p}deg` }],
    };
  });

  const rightStyle = useAnimatedStyle(() => {
    const p = interpolate(clock.get(), KEYS.split, [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - 0.6 * p,
      transform: [{ translateX: 7 * p }, { translateY: -4 * p }, { rotate: `${12 * p}deg` }],
    };
  });

  return (
    <View style={styles.root} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ring, { borderColor: tone.dim }, ringStyle]} />
      <View style={[styles.innerRing, { borderColor: tone.faint }]} />
      <View style={[styles.diamond, { borderColor: tone.main, boxShadow: tone.glow }]} />
      <Animated.View style={[styles.iconBox, iconStyle]}>
        <Animated.View style={[styles.half, styles.leftHalf, leftStyle]}>
          <Ionicons name="skull" size={ICON} color={tone.main} style={styles.iconLeft} />
        </Animated.View>
        <Animated.View style={[styles.half, styles.rightHalf, rightStyle]}>
          <Ionicons name="skull" size={ICON} color={tone.main} style={styles.iconRight} />
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.crack, crackStyle]}>
        <BossCrack size={SIZE * 0.86} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    width: SIZE - 14,
    height: SIZE - 14,
    borderRadius: (SIZE - 14) / 2,
    borderWidth: 1,
  },
  diamond: {
    position: 'absolute',
    width: DIAMOND,
    height: DIAMOND,
    borderWidth: 2,
    borderRadius: radii.md,
    backgroundColor: colors.panelSolid,
    transform: [{ rotate: '45deg' }],
  },
  iconBox: { width: ICON, height: ICON },
  half: { position: 'absolute', top: 0, width: HALF, height: ICON, overflow: 'hidden' },
  leftHalf: { left: 0 },
  rightHalf: { left: HALF },
  iconLeft: { position: 'absolute', top: 0, left: 0, width: ICON, height: ICON },
  iconRight: { position: 'absolute', top: 0, left: -HALF, width: ICON, height: ICON },
  crack: {
    position: 'absolute',
    width: SIZE * 0.86,
    height: SIZE * 0.86,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
