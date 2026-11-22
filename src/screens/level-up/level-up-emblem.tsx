import Ionicons from '@expo/vector-icons/Ionicons';
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

import { colors, toneColors } from '@/theme';

const gold = toneColors.gold;

export interface LevelUpEmblemProps {
  /** False under reduced motion: a static emblem is drawn. */
  animate: boolean;
  /** Muted (neon) variant for the "nothing pending" state. */
  muted?: boolean;
}

/** Double chevron in a glowing core, a slowly turning diamond frame and an expanding ripple. */
export function LevelUpEmblem({ animate, muted = false }: LevelUpEmblemProps) {
  const ripple = useSharedValue(0);
  const spin = useSharedValue(0);
  const tone = muted ? toneColors.neon : gold;

  useEffect(() => {
    if (!animate) return;
    ripple.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
    spin.set(withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(ripple);
      cancelAnimation(spin);
    };
  }, [animate, ripple, spin]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: animate ? 0.8 * (1 - ripple.get()) : 0,
    transform: [{ scale: 1 + 0.65 * ripple.get() }],
  }));
  const diamondStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${45 + spin.get() * 360}deg` }],
  }));

  return (
    <View style={styles.root} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ripple, { borderColor: tone.main }, rippleStyle]} />
      <Animated.View style={[styles.diamond, { borderColor: tone.dim }, diamondStyle]} />
      <View style={[styles.core, { borderColor: tone.main, backgroundColor: tone.faint, boxShadow: tone.glow }]}>
        <Ionicons name="chevron-up" size={30} color={muted ? colors.neon : colors.gold} />
        <Ionicons name="chevron-up" size={30} color={muted ? colors.neon : colors.gold} style={styles.secondChevron} />
      </View>
    </View>
  );
}

const SIZE = 116;
const CORE = 70;

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ripple: { position: 'absolute', width: CORE, height: CORE, borderRadius: CORE / 2, borderWidth: 2 },
  diamond: { position: 'absolute', width: 82, height: 82, borderWidth: 1 },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondChevron: { marginTop: -18 },
});
