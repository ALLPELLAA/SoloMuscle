import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { colors, radii, spacing, toneColors } from '@/theme';

import { useGlowPulse } from './use-glow-pulse';

export interface PenaltyLockNoticeProps {
  /** True once the penalty quest is completed (lock lifted, not yet archived). */
  lifted: boolean;
}

const LOCK_RULES = [
  'Egzersizler XP ve stat gelişimi vermez.',
  'Günlük görev tamamlanırsa ödülü yanar.',
  'Rank sınavına girilemez.',
  'Ceza Görevi gün dönümünde kaybolmaz; bitene kadar sürer.',
] as const;

/** Explains the XP lock above the penalty quest (or confirms it was lifted). */
export function PenaltyLockNotice({ lifted }: PenaltyLockNoticeProps) {
  const pulse = useGlowPulse(900);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * pulse.get() }));

  if (lifted) {
    const t = toneColors.success;
    return (
      <View style={[styles.root, { borderColor: t.main, backgroundColor: t.faint }]}>
        <Ionicons name="lock-open" size={26} color={colors.success} />
        <View style={styles.texts}>
          <SystemText variant="heading" tone="success">
            XP KİLİDİ KALKTI
          </SystemText>
          <SystemText variant="caption" tone="secondary">
            Ceza Görevi tamamlandı. Sistem erişimi geri yüklendi; XP kazanımı yeniden aktif.
          </SystemText>
        </View>
      </View>
    );
  }

  const t = toneColors.danger;
  return (
    <View
      style={[styles.root, { borderColor: t.main, backgroundColor: t.faint }]}
      accessible
      accessibilityLabel="XP kilitli. Ceza görevi tamamlanana kadar XP kazanılmaz."
    >
      <Animated.View pointerEvents="none" style={[styles.halo, { boxShadow: t.glow }, haloStyle]} />
      <Ionicons name="lock-closed" size={26} color={colors.danger} />
      <View style={styles.texts}>
        <SystemText variant="heading" tone="danger" glow>
          XP KİLİTLİ
        </SystemText>
        <SystemText variant="caption" tone="secondary">
          Ceza Görevi tamamlanana kadar:
        </SystemText>
        {LOCK_RULES.map((rule) => (
          <View key={rule} style={styles.rule}>
            <SystemText variant="caption" tone="danger">
              ›
            </SystemText>
            <SystemText variant="caption" style={styles.ruleText}>
              {rule}
            </SystemText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  halo: { ...StyleSheet.absoluteFill, borderRadius: radii.sm },
  texts: { flex: 1, gap: spacing.xxs },
  rule: { flexDirection: 'row', gap: spacing.xs },
  ruleText: { flex: 1 },
});
