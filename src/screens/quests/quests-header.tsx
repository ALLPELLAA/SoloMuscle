import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ProgressBar } from '@/components/progress-bar';
import { SystemText } from '@/components/system-text';
import { colors, radii, spacing, toneColors } from '@/theme';

import { useGlowPulse } from './use-glow-pulse';
import { useResetCountdown } from './use-reset-countdown';

export interface QuestsHeaderProps {
  /** Number of quests that are still running (daily + penalty). */
  activeCount: number;
  penaltyActive: boolean;
}

/** Screen title + live "YENİLENMEYE KALAN hh:mm:ss" strip. */
export function QuestsHeader({ activeCount, penaltyActive }: QuestsHeaderProps) {
  const countdown = useResetCountdown();
  const pulse = useGlowPulse(1400);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.get() }));
  const badgeTone = penaltyActive ? toneColors.danger : toneColors.neon;

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <View style={styles.titleTexts}>
          <View style={styles.systemRow}>
            <Animated.View style={[styles.dot, { backgroundColor: badgeTone.main }, dotStyle]} />
            <SystemText variant="label" tone="muted">
              SİSTEM // GÖREV PANELİ
            </SystemText>
          </View>
          <SystemText variant="title" tone="neon" glow>
            GÖREVLER
          </SystemText>
        </View>
        <View style={[styles.badge, { borderColor: badgeTone.dim, backgroundColor: badgeTone.faint }]}>
          <SystemText variant="monoLarge" style={{ color: badgeTone.main }}>
            {String(activeCount)}
          </SystemText>
          <SystemText variant="label" tone="secondary">
            AKTİF
          </SystemText>
        </View>
      </View>

      <View
        style={styles.countdown}
        accessible
        accessibilityLabel={`Yenilenmeye kalan süre ${countdown.label}`}
      >
        <View style={styles.countdownRow}>
          <Ionicons name="hourglass-outline" size={18} color={colors.neon} />
          <SystemText variant="label" tone="secondary" style={styles.flex}>
            YENİLENMEYE KALAN
          </SystemText>
          <SystemText variant="monoLarge" tone="neon" glow>
            {countdown.label}
          </SystemText>
        </View>
        <ProgressBar progress={countdown.dayProgress} height={3} />
        <SystemText variant="caption" tone="muted">
          {penaltyActive
            ? "00:00'da yeni günlük görev üretilir. Ceza Görevi gün dönümünde kaybolmaz."
            : "00:00'da yeni günlük görev üretilir. Tamamlanmayan görev Ceza Görevi açar."}
        </SystemText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleTexts: { flex: 1, gap: spacing.xxs },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  badge: {
    minWidth: 64,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  countdown: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neonDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.neon,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
  },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
