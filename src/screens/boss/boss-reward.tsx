import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { colors, radii, spacing, toneColors } from '@/theme';

import { BOSS_COPY, type BossRewardKind } from './boss-copy';

export interface BossRewardProps {
  kind: BossRewardKind;
  bonusXp: number;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

const copy = BOSS_COPY.reward;

/** Reward strip: gold "+N XP", red "XP KİLİTLİ" or a muted "already claimed" note. */
export function BossReward({ kind, bonusXp }: BossRewardProps) {
  if (kind === 'bonus') {
    return (
      <View
        style={[styles.root, styles.bonus]}
        accessible
        accessibilityLabel={`${copy.bonusLabel}: +${bonusXp} XP`}
      >
        <Ionicons name="sparkles" size={22} color={colors.gold} />
        <View style={styles.texts}>
          <SystemText variant="label" tone="gold">
            {copy.bonusLabel}
          </SystemText>
          <SystemText variant="caption" tone="secondary">
            {copy.bonusHint}
          </SystemText>
        </View>
        <SystemText variant="monoLarge" tone="gold" glow>
          {`+${bonusXp} XP`}
        </SystemText>
      </View>
    );
  }

  const locked = kind === 'locked';
  const icon: IconName = locked ? 'lock-closed' : 'checkmark-done';
  return (
    <View
      style={[styles.root, locked ? styles.locked : styles.claimed]}
      accessible
      accessibilityLabel={locked ? copy.locked : copy.claimed}
    >
      <Ionicons name={icon} size={20} color={locked ? colors.danger : colors.textMuted} />
      <View style={styles.texts}>
        <SystemText variant="bodyStrong" tone={locked ? 'danger' : 'muted'} glow={locked}>
          {locked ? copy.locked : copy.claimed}
        </SystemText>
        <SystemText variant="caption" tone={locked ? 'secondary' : 'muted'}>
          {locked ? copy.lockedHint : copy.claimedHint}
        </SystemText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  bonus: {
    borderColor: toneColors.gold.main,
    backgroundColor: toneColors.gold.faint,
    boxShadow: toneColors.gold.glow,
  },
  locked: { borderColor: toneColors.danger.main, backgroundColor: toneColors.danger.faint },
  claimed: { borderColor: colors.neonFaint, backgroundColor: colors.backgroundAlt },
  texts: { flex: 1, gap: spacing.xxs },
});
