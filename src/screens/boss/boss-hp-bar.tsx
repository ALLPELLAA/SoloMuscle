import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { colors, glow, radii, spacing } from '@/theme';

import { BOSS_COPY } from './boss-copy';
import { HP_FRAMES, HP_TRAIL_FRAMES } from './boss-timeline';
import type { BossPhase } from './use-boss-timeline';

export interface BossHpBarProps {
  clock: SharedValue<number>;
  phase: BossPhase;
  /** The boss's HP is the record it guarded. */
  maxHp: number | null;
}

const SEGMENTS = 10;

/** Fighting-game style HP bar: red fill drains in hits, a pale damage trail follows. */
export function BossHpBar({ clock, phase, maxHp }: BossHpBarProps) {
  const fight = phase === 'fight';

  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(clock.get(), HP_FRAMES.input, HP_FRAMES.output, Extrapolation.CLAMP) * 100}%`,
  }));
  const trailStyle = useAnimatedStyle(() => ({
    width: `${interpolate(clock.get(), HP_TRAIL_FRAMES.input, HP_TRAIL_FRAMES.output, Extrapolation.CLAMP) * 100}%`,
  }));

  const hpText = maxHp === null ? '—' : `${fight ? maxHp : 0} / ${maxHp}`;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Boss HP ${hpText}`}
      accessibilityValue={{ min: 0, max: 100, now: fight ? 100 : 0 }}
    >
      <View style={styles.row}>
        <SystemText variant="label" tone={fight ? 'danger' : 'muted'} glow={fight}>
          {BOSS_COPY.hpLabel}
        </SystemText>
        <SystemText variant="mono" tone={fight ? 'danger' : 'muted'}>
          {hpText}
        </SystemText>
      </View>
      <View style={[styles.track, !fight && styles.trackDefeated]}>
        <Animated.View style={[styles.bar, styles.trail, trailStyle]} />
        <Animated.View style={[styles.bar, styles.fill, fillStyle]} />
        {Array.from({ length: SEGMENTS - 1 }, (_, i) => (
          <View key={i} style={[styles.tick, { left: `${((i + 1) * 100) / SEGMENTS}%` }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: {
    height: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerDim,
    backgroundColor: colors.dangerFaint,
    overflow: 'hidden',
  },
  trackDefeated: { borderColor: colors.neonFaint, backgroundColor: colors.backgroundAlt },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  trail: { backgroundColor: colors.text, opacity: 0.6 },
  fill: { backgroundColor: colors.danger, boxShadow: glow.danger },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.background,
    opacity: 0.55,
  },
});
