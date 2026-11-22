import { StyleSheet, View } from 'react-native';

import { RankBadge } from '@/components/rank-badge';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { evaluateRankExam, RANKS, rankIndex } from '@/game';
import type { useRankExams } from '@/state/use-history';
import { colors, radii, spacing, toneColors } from '@/theme';

import { formatDay, formatTime, type ExamMetricKey } from './rank-copy';
import { ThresholdChips } from './threshold-chips';

type ExamRecord = ReturnType<typeof useRankExams>[number];

export interface ExamHistoryWindowProps {
  exams: ExamRecord[];
}

/** Past rank exams: date, target, GEÇTİ/KALDI and the entered results. */
export function ExamHistoryWindow({ exams }: ExamHistoryWindowProps) {
  const passedCount = exams.filter((e) => e.passed).length;
  return (
    <SystemWindow
      title="Sınav Geçmişi"
      headerRight={
        exams.length > 0 ? (
          <SystemText variant="label" tone="secondary">
            {`${passedCount}/${exams.length} GEÇTİ`}
          </SystemText>
        ) : undefined
      }
    >
      {exams.length === 0 ? (
        <View style={styles.empty}>
          <SystemText variant="label" tone="muted" align="center">
            KAYIT YOK
          </SystemText>
          <SystemText variant="caption" tone="secondary" align="center">
            Henüz rank sınavına girmedin. İlk sınav LV 5&apos;te açılır.
          </SystemText>
        </View>
      ) : (
        exams.map((exam, i) => <ExamRow key={exam.id} exam={exam} divider={i > 0} />)
      )}
    </SystemWindow>
  );
}

function ExamRow({ exam, divider }: { exam: ExamRecord; divider: boolean }) {
  const target = exam.targetRank;
  const evaluation = target === 'E' ? null : evaluateRankExam(target, exam.results);
  const passed: Partial<Record<ExamMetricKey, boolean>> = {};
  if (evaluation) for (const check of evaluation.checks) passed[check.key] = check.passed;
  const from = RANKS[Math.max(0, rankIndex(target) - 1)];
  const tone = exam.passed ? toneColors.success : toneColors.danger;
  const time = formatTime(exam.takenAt);

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.head}>
        <RankBadge rank={target} size="sm" />
        <View style={styles.flex}>
          <SystemText variant="heading">{`${from} → ${target} SINAVI`}</SystemText>
          <SystemText variant="caption" tone="muted">
            {time ? `${formatDay(exam.dayKey)} · ${time}` : formatDay(exam.dayKey)}
          </SystemText>
        </View>
        <View style={[styles.verdict, { borderColor: tone.main, backgroundColor: tone.faint }]}>
          <SystemText variant="label" tone={exam.passed ? 'success' : 'danger'}>
            {exam.passed ? 'GEÇTİ' : 'KALDI'}
          </SystemText>
        </View>
      </View>
      <ThresholdChips values={exam.results} passed={evaluation ? passed : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { gap: spacing.xs, paddingVertical: spacing.md },
  row: { gap: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.neonFaint, paddingTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  verdict: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});
