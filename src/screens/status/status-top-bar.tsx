import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { colors, glow, radii, spacing } from '@/theme';

import { usePulse } from './use-pulse';

export interface StatusTopBarProps {
  /** e.g. `21 Kasım, Cumartesi`. */
  dateLabel: string;
  /** 1-based day since the player awakened. */
  dayNumber: number;
  onOpenSettings: () => void;
}

/** "SİSTEM ÇEVRİMİÇİ" strip with the date and the settings gear. */
export function StatusTopBar({ dateLabel, dayNumber, onOpenSettings }: StatusTopBarProps) {
  const pulse = usePulse(1400);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.get() }));

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <View style={styles.statusRow}>
          <Animated.View style={[styles.dot, dotStyle]} />
          <SystemText variant="label" tone="neon" glow>
            SİSTEM ÇEVRİMİÇİ
          </SystemText>
          <SystemText variant="label" tone="muted">
            {`· GÜN ${dayNumber}`}
          </SystemText>
        </View>
        <SystemText variant="caption" tone="secondary">
          {dateLabel}
        </SystemText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ayarlar"
        onPress={onOpenSettings}
        hitSlop={8}
        style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
      >
        <Ionicons name="settings-outline" size={22} color={colors.neon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  left: { flex: 1, gap: spacing.xxs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    boxShadow: glow.success,
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: colors.neonFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearPressed: { backgroundColor: colors.neonDim, boxShadow: glow.neonSoft },
});
