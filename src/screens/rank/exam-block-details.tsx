import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { EXAM_BLOCK_MESSAGES, type DayKey, type ExamBlockReason, type ExamEligibility } from '@/game';
import { colors, radii, spacing, toneColors } from '@/theme';

import { blockTone, relativeDayLabel, type IconName } from './rank-copy';

export interface ExamBlockDetailsProps {
  eligibility: ExamEligibility;
  level: number;
  today: DayKey;
  onOpenQuests?: () => void;
}

const REASON_ICONS: Record<ExamBlockReason, IconName> = {
  max_rank: 'trophy-outline',
  penalty: 'warning-outline',
  level: 'lock-closed-outline',
  cooldown: 'hourglass-outline',
};

/** Why the rank exam is closed, with the numbers behind it. */
export function ExamBlockDetails({ eligibility, level, today, onOpenQuests }: ExamBlockDetailsProps) {
  const { reason, requiredLevel, cooldownUntil, target } = eligibility;
  if (!reason) return null;
  const tone = blockTone(reason);

  return (
    <View style={styles.root}>
      <View style={styles.messageRow}>
        <Ionicons name={REASON_ICONS[reason]} size={20} color={toneColors[tone].main} style={styles.icon} />
        <SystemText variant="bodyStrong" tone={tone === 'neon' ? 'default' : tone} style={styles.flex}>
          {EXAM_BLOCK_MESSAGES[reason]}
        </SystemText>
      </View>

      {reason === 'level' && requiredLevel ? (
        <View style={styles.box}>
          <DetailRow label="Hedef" value={target ? `${target} RANK` : '—'} />
          <DetailRow label="Gerekli level" value={`LV ${requiredLevel}`} tone="neon" />
          <DetailRow label="Mevcut level" value={`LV ${level}`} tone="danger" />
          <ProgressBar progress={level / requiredLevel} height={6} accessibilityLabel="Gerekli levele ilerleme" />
          <SystemText variant="caption" tone="muted">
            {`${Math.max(0, requiredLevel - level)} level daha kazandığında sınav kapısı açılır.`}
          </SystemText>
        </View>
      ) : null}

      {reason === 'cooldown' && cooldownUntil ? (
        <View style={styles.box}>
          <DetailRow label="Hedef" value={target ? `${target} RANK` : '—'} />
          <DetailRow label="Yeni deneme" value={relativeDayLabel(cooldownUntil, today)} tone="neon" />
          <SystemText variant="caption" tone="muted">
            Gün dönümünde (00:00) kapı yeniden açılır. Bu arada eksik kaldığın hareketi çalış.
          </SystemText>
        </View>
      ) : null}

      {reason === 'penalty' ? (
        <View style={[styles.box, styles.dangerBox]}>
          <SystemText variant="caption" tone="secondary">
            Ceza Görevi tamamlanınca hem XP kilidi hem sınav kilidi kalkar.
          </SystemText>
          {onOpenQuests ? (
            <SystemButton
              size="sm"
              tone="danger"
              label="Ceza görevine git"
              icon={<Ionicons name="flame-outline" size={16} color={colors.danger} />}
              onPress={onOpenQuests}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'neon' | 'danger' }) {
  return (
    <View style={styles.detailRow}>
      <SystemText variant="label" tone="secondary">
        {label.toLocaleUpperCase('tr-TR')}
      </SystemText>
      <SystemText variant="mono" tone={tone}>
        {value}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icon: { marginTop: 1 },
  flex: { flex: 1 },
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundAlt,
  },
  dangerBox: { borderColor: colors.dangerDim, backgroundColor: colors.dangerFaint },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
});
