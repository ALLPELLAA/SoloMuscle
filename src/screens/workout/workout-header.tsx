import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { formatClock } from '@/game';
import { useNow } from '@/hooks/use-now';
import { colors, glow, radii, spacing } from '@/theme';

import { useNeonPulse } from './use-neon-pulse';

export interface WorkoutHeaderProps {
  /** Epoch ms of the first set (null = no active session). */
  startedAt: number | null;
  setCount: number;
  xpLocked: boolean;
}

/** "ANTRENMAN" title strip with the live session clock. */
export function WorkoutHeader({ startedAt, setCount, xpLocked }: WorkoutHeaderProps) {
  const active = startedAt !== null;
  const focused = useIsFocused();
  const now = useNow(1000, active && focused);
  const pulse = useNeonPulse(active, 1100);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.get() }));
  const elapsed = active ? Math.max(0, now - startedAt) : 0;

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <SystemText variant="title" tone="neon" glow>
          ANTRENMAN
        </SystemText>
        <View style={styles.statusRow}>
          <Animated.View style={[styles.dot, active ? styles.dotActive : styles.dotIdle, active && dotStyle]} />
          <SystemText variant="label" tone={active ? 'success' : 'muted'}>
            {active ? `OTURUM AKTİF · ${formatClock(elapsed)} · ${setCount} SET` : 'HAZIR · İLK SET OTURUMU BAŞLATIR'}
          </SystemText>
        </View>
      </View>
      {xpLocked ? (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={12} color={colors.danger} />
          <SystemText variant="label" tone="danger">
            XP KİLİTLİ
          </SystemText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  left: { flex: 1, gap: spacing.xxs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  dotActive: { backgroundColor: colors.success, boxShadow: glow.success },
  dotIdle: { backgroundColor: colors.textMuted },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerFaint,
    boxShadow: glow.danger,
  },
});
