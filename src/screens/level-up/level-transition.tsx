import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { colors, fonts, radii, spacing, toneColors, typography } from '@/theme';

import { useLevelCountUp } from './use-level-count-up';

export interface LevelTransitionProps {
  from: number;
  to: number;
  animate: boolean;
}

/** `LEVEL 4 → 5` with the new level counting up and popping on each step. */
export function LevelTransition({ from, to, animate }: LevelTransitionProps) {
  const value = useLevelCountUp(from, to, animate);
  const reached = value >= to;
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!animate || value === from) return;
    pop.set(withSequence(withTiming(1.4, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 240 })));
    void Haptics.selectionAsync().catch(() => undefined);
  }, [animate, from, pop, value]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Level ${from} seviyesinden ${to} seviyesine yükseldi`}
    >
      <SystemText variant="label" tone="secondary" align="center">
        LEVEL
      </SystemText>
      <View style={styles.row}>
        <View style={[styles.box, styles.fromBox]}>
          <SystemText variant="monoLarge" tone="muted">
            {String(from)}
          </SystemText>
        </View>
        <Ionicons name="arrow-forward" size={22} color={colors.neon} />
        <View style={[styles.box, reached ? styles.toBoxReached : styles.toBox]}>
          <Animated.View style={popStyle}>
            <SystemText tone="gold" glow style={styles.toValue}>
              {String(value)}
            </SystemText>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const gold = toneColors.gold;

const styles = StyleSheet.create({
  root: { gap: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  box: {
    minWidth: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fromBox: { borderColor: colors.neonFaint, backgroundColor: colors.backgroundAlt },
  toBox: { borderColor: colors.neonDim, backgroundColor: colors.neonFaint },
  toBoxReached: { borderColor: gold.main, backgroundColor: gold.faint, boxShadow: gold.glow },
  toValue: { ...typography.display, fontFamily: fonts.mono, letterSpacing: 0 },
});
