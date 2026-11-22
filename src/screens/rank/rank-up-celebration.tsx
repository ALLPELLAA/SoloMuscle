import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { RankBadge } from '@/components/rank-badge';
import { SystemText } from '@/components/system-text';
import type { Rank } from '@/game';
import { RANK_TITLES } from '@/screens/status/rank-titles';
import { colors, glow, radii, rankColors, spacing, toneColors } from '@/theme';

import { useBreathe } from './use-breathe';

export interface RankUpCelebrationProps {
  from: Rank;
  to: Rank;
  rewardXp: number;
}

const RAYS = 8;

/** "RANK YÜKSELDİ" burst: badge pops in, rings breathe, texts slide up. */
export function RankUpCelebration({ from, to, rewardXp }: RankUpCelebrationProps) {
  const color = rankColors[to];
  const pop = useSharedValue(0);
  const reveal = useSharedValue(0);
  const spin = useSharedValue(0);
  const pulse = useBreathe(1300);

  useEffect(() => {
    pop.set(
      withSequence(
        withTiming(1.25, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 8, stiffness: 140 }),
      ),
    );
    reveal.set(withDelay(380, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) })));
    spin.set(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }));
  }, [pop, reveal, spin]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 1.5),
    transform: [{ scale: pop.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.65 * pulse.get(),
    transform: [{ scale: 1 + 0.16 * pulse.get() }],
  }));
  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.get()) * 0.6 * Math.min(1, pop.get()),
    transform: [{ scale: 1.05 + 0.35 * pulse.get() }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * Math.min(1, pop.get()),
    transform: [{ rotate: `${spin.get() * 90}deg` }, { scale: 0.6 + 0.4 * Math.min(1, pop.get()) }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateY: (1 - reveal.get()) * 18 }],
  }));

  return (
    <View
      style={[styles.root, { borderColor: color, boxShadow: `0 0 26px ${color}` }]}
      accessible
      accessibilityLabel={`Rank yükseldi: ${to}. Ödül ${rewardXp} XP.`}
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.stage}>
        <Animated.View pointerEvents="none" style={[styles.rays, raysStyle]}>
          {Array.from({ length: RAYS }, (_, i) => (
            <View
              key={i}
              style={[styles.ray, { backgroundColor: color, transform: [{ rotate: `${(180 / RAYS) * i}deg` }] }]}
            />
          ))}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.ring, styles.outerRing, { borderColor: color }, outerRingStyle]} />
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: color, boxShadow: `0 0 30px ${color}` }, ringStyle]}
        />
        <Animated.View style={badgeStyle}>
          <RankBadge rank={to} size="lg" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.texts, textStyle]}>
        <SystemText variant="label" tone="gold" glow>
          [SİSTEM] TEBRİKLER, AVCI
        </SystemText>
        <SystemText variant="title" align="center" style={[styles.headline, { color, textShadowColor: color }]}>
          {`RANK YÜKSELDİ: ${to}`}
        </SystemText>
        <View style={styles.transition}>
          <RankBadge rank={from} size="sm" />
          <SystemText variant="heading" tone="secondary">
            →
          </SystemText>
          <RankBadge rank={to} size="sm" />
        </View>
        <SystemText variant="bodyStrong" align="center">
          {`Yeni unvan: ${RANK_TITLES[to]}`}
        </SystemText>
        <View style={styles.reward}>
          <SystemText variant="heading" tone="gold" glow>
            {`+${rewardXp} XP`}
          </SystemText>
        </View>
      </Animated.View>
    </View>
  );
}

const RING = 132;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  stage: { width: 200, height: 170, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 2, height: 200, borderRadius: 1, opacity: 0.35 },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  outerRing: { borderWidth: 1 },
  texts: { alignItems: 'center', gap: spacing.sm },
  headline: { fontSize: 28, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
  transition: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reward: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: toneColors.gold.main,
    borderRadius: radii.sm,
    backgroundColor: toneColors.gold.faint,
    boxShadow: glow.gold,
  },
});
