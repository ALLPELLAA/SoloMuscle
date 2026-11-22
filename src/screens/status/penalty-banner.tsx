import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { colors, radii, spacing, toneColors } from '@/theme';

import { usePulse } from './use-pulse';

export interface PenaltyBannerProps {
  onPress: () => void;
}

const danger = toneColors.danger;

/** Pulsing red strip shown while a penalty quest locks XP. */
export function PenaltyBanner({ onPress }: PenaltyBannerProps) {
  const pulse = usePulse(900);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * pulse.get() }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ceza görevi aktif, XP kilitli"
      accessibilityHint="Görevler sekmesini açar"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Ionicons name="warning" size={26} color={colors.danger} />
      <View style={styles.texts}>
        <SystemText variant="heading" tone="danger" glow>
          CEZA GÖREVİ AKTİF
        </SystemText>
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={12} color={colors.danger} />
          <SystemText variant="label" tone="danger">
            XP KİLİTLİ
          </SystemText>
        </View>
        <SystemText variant="caption" tone="secondary">
          Kilidi kaldırmak için ceza görevini tamamla.
        </SystemText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.danger} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: danger.main,
    backgroundColor: danger.faint,
  },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.sm,
    boxShadow: danger.glow,
  },
  pressed: { backgroundColor: danger.dim },
  texts: { flex: 1, gap: spacing.xxs },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
