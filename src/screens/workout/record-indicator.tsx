import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { BOSS_NAMES, formatAmount, type ExerciseId, type PersonalRecord, type RecordEvent } from '@/game';
import { colors, glow, radii, spacing } from '@/theme';

import { useNeonPulse } from './use-neon-pulse';

export interface RecordIndicatorProps {
  exerciseId: ExerciseId;
  /** Record the next set competes with (stored record updated by earlier sets of this session). */
  record: PersonalRecord | undefined;
  /** True when `record` comes from a set of the current (unsaved) session. */
  fromSession: boolean;
  /** What the engine says the entered set would do to the record (null = nothing). */
  event: RecordEvent | null;
}

/** Personal record line; turns into a pulsing "BOSS SAVAŞI" when the entered amount beats it (§10). */
export function RecordIndicator({ exerciseId, record, fromSession, event }: RecordIndicatorProps) {
  const bossName = BOSS_NAMES[exerciseId];
  const fighting = event?.boss === true;
  const pulse = useNeonPulse(fighting);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * pulse.get() }));

  if (fighting && event) {
    const bonusText =
      event.bonusXp > 0
        ? `Boss bonusu +${event.bonusXp} XP`
        : event.locked
          ? 'XP kilitli: bonus yok, rekor yine kaydedilir'
          : 'Bugünkü bonus alındı: rekor yine kaydedilir';
    return (
      <Animated.View entering={FadeIn.duration(180)} style={[styles.box, styles.bossBox]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bossGlow, glowStyle]} />
        <View style={styles.row}>
          <Ionicons name="flash" size={18} color={colors.gold} />
          <SystemText variant="heading" tone="gold" glow style={styles.flex}>
            BOSS SAVAŞI! Rekoru geçiyorsun
          </SystemText>
        </View>
        <SystemText variant="bodyStrong" tone="danger">
          {`${bossName} · ${formatAmount(exerciseId, event.previous ?? 0)} → ${formatAmount(exerciseId, event.amount)}`}
        </SystemText>
        <SystemText variant="caption" tone={event.bonusXp > 0 ? 'gold' : 'secondary'}>
          {bonusText}
        </SystemText>
      </Animated.View>
    );
  }

  if (!record) {
    return (
      <View style={styles.box}>
        <View style={styles.row}>
          <Ionicons name="trophy-outline" size={16} color={colors.neon} />
          <SystemText variant="label" tone="neon" glow style={styles.flex}>
            İLK SET REKOR OLACAK
          </SystemText>
        </View>
        <SystemText variant="caption" tone="secondary">
          {`Boss: ${bossName} — rekoru kırdığında savaş başlar.`}
        </SystemText>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Ionicons name="trophy" size={16} color={colors.gold} />
        <SystemText variant="label" tone="gold" style={styles.flex}>
          {`REKOR: ${formatAmount(exerciseId, record.amount)} · ${bossName}`}
        </SystemText>
      </View>
      <SystemText variant="caption" tone="secondary">
        {fromSession
          ? `Bu antrenmandaki setin. Boss savaşı için ${formatAmount(exerciseId, record.amount + 1)}+`
          : `Boss savaşı için ${formatAmount(exerciseId, record.amount + 1)}+`}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.panelSolid,
  },
  bossBox: { borderColor: colors.gold, backgroundColor: colors.dangerFaint },
  bossGlow: { borderRadius: radii.sm, borderWidth: 1, borderColor: colors.gold, boxShadow: glow.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
