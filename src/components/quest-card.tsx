import { StyleSheet, View } from 'react-native';

import { getExercise, questProgress, UNIT_LABELS, type Quest } from '@/game';
import { colors, spacing } from '@/theme';

import { ProgressBar } from './progress-bar';
import { SystemText } from './system-text';
import { SystemWindow } from './system-window';

export interface QuestCardProps {
  quest: Quest;
  /** XP is locked by a penalty quest (daily reward will be forfeited). */
  xpLocked?: boolean;
  /** Compact mode hides the description lines. */
  compact?: boolean;
}

const STATUS_TEXT: Record<Quest['status'], string> = {
  active: 'DEVAM EDİYOR',
  completed: 'TAMAMLANDI',
  failed: 'BAŞARISIZ',
};

export function QuestCard({ quest, xpLocked = false, compact = false }: QuestCardProps) {
  const penalty = quest.kind === 'penalty';
  const tone = penalty ? 'danger' : quest.status === 'completed' ? 'success' : 'neon';
  const barColor = penalty ? colors.danger : colors.neon;

  return (
    <SystemWindow
      title={penalty ? 'Ceza Görevi' : 'Günlük Görev'}
      tone={tone}
      emphasized={penalty && quest.status === 'active'}
      headerRight={
        <SystemText variant="label" tone={tone}>
          {`${Math.round(questProgress(quest) * 100)}%`}
        </SystemText>
      }
    >
      <SystemText variant="heading" tone={penalty ? 'danger' : 'default'}>
        {quest.title}
      </SystemText>
      {!compact && penalty ? (
        <SystemText variant="caption" tone="secondary">
          Dünkü görev tamamlanmadı. Bu görevi bitirene kadar XP kazanamazsın.
        </SystemText>
      ) : null}

      <View style={styles.objectives}>
        {quest.objectives.map((o) => {
          const def = getExercise(o.exerciseId);
          const done = o.progress >= o.target;
          return (
            <View key={o.exerciseId} style={styles.objective}>
              <View style={styles.objectiveRow}>
                <SystemText variant="bodyStrong" tone={done ? 'success' : 'default'} style={styles.flex}>
                  {`${done ? '✓ ' : ''}${def.name}`}
                </SystemText>
                <SystemText variant="mono" tone={done ? 'success' : 'secondary'}>
                  {`${o.progress}/${o.target} ${UNIT_LABELS[def.unit].short}`}
                </SystemText>
              </View>
              <ProgressBar progress={o.progress / o.target} color={done ? colors.success : barColor} height={4} />
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <SystemText variant="label" tone={quest.status === 'failed' ? 'danger' : tone}>
          {STATUS_TEXT[quest.status]}
        </SystemText>
        {penalty ? (
          <SystemText variant="label" tone="danger">
            ÖDÜL: XP KİLİDİ KALKAR
          </SystemText>
        ) : (
          <SystemText variant="label" tone={xpLocked && quest.status === 'active' ? 'danger' : 'gold'}>
            {quest.status === 'completed'
              ? `ÖDÜL: +${quest.awardedXp} XP`
              : xpLocked
                ? `ÖDÜL: +${quest.rewardXp} XP (KİLİTLİ)`
                : `ÖDÜL: +${quest.rewardXp} XP`}
          </SystemText>
        )}
      </View>
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  objectives: { gap: spacing.md },
  objective: { gap: spacing.xs },
  objectiveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
