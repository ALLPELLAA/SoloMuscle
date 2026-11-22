import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, fonts, radii, spacing, toneColors, typography } from '@/theme';

/** Above this many points the pip row would wrap too much; only the number is shown. */
const MAX_PIPS = 15;

export interface PointsWindowProps {
  /** Points the player owns (`unspentPoints`). */
  available: number;
  /** Points not assigned in the current draft. */
  remaining: number;
}

/** Big "remaining points" counter with one diamond pip per point. */
export function PointsWindow({ available, remaining }: PointsWindowProps) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const previous = useRef(remaining);

  useEffect(() => {
    if (previous.current === remaining) return;
    previous.current = remaining;
    if (reduceMotion) return;
    pop.set(withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 260 })));
  }, [pop, reduceMotion, remaining]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const hasRemaining = remaining > 0;
  const tone = hasRemaining ? 'gold' : 'neon';

  return (
    <SystemWindow
      title="Kalan Puan"
      tone={tone}
      emphasized={hasRemaining}
      headerRight={<Ionicons name="diamond" size={14} color={hasRemaining ? colors.gold : colors.neon} />}
    >
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${available} puanın ${remaining} tanesi dağıtılmadı`}
      >
        <Animated.View style={popStyle}>
          <SystemText tone={tone} glow style={styles.count}>
            {String(remaining)}
          </SystemText>
        </Animated.View>
        <View style={styles.side}>
          <SystemText variant="mono" tone="muted">{`/ ${available} PUAN`}</SystemText>
          {available <= MAX_PIPS ? (
            <View style={styles.pips}>
              {Array.from({ length: available }, (_, i) => (
                <View key={i} style={[styles.pip, i < remaining ? styles.pipFull : styles.pipUsed]} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <SystemText variant="caption" tone="secondary">
        {hasRemaining
          ? 'Dağıtmadığın puanlar saklanır; istediğin zaman geri dönüp dağıtabilirsin.'
          : 'Tüm puanlar atandı. Onayla ve güçlen.'}
      </SystemText>
    </SystemWindow>
  );
}

const gold = toneColors.gold;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  count: {
    ...typography.display,
    fontFamily: fonts.mono,
    letterSpacing: 0,
    lineHeight: 48,
    includeFontPadding: false,
    minWidth: 56,
    textAlign: 'center',
  },
  side: { flex: 1, gap: spacing.sm },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: spacing.xxs },
  pip: { width: 11, height: 11, borderWidth: 1, borderRadius: radii.sm / 2, transform: [{ rotate: '45deg' }] },
  pipFull: { borderColor: gold.main, backgroundColor: colors.gold, boxShadow: gold.glow },
  pipUsed: { borderColor: colors.neonDim, backgroundColor: colors.neonFaint },
});
