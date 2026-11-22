import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { rankIndex, RANKS, type DayKey, type PersonalRecords, type RankExamResult } from '@/game';
import { colors, radii, spacing } from '@/theme';

import { ExamCheckTable } from './exam-check-table';
import { EXAM_EXERCISE, relativeDayLabel, type ExamMetricKey } from './rank-copy';
import { RankUpCelebration } from './rank-up-celebration';

export interface ExamResultViewProps {
  result: RankExamResult;
  /** Records before the exam, to highlight the ones the exam raised. */
  previousRecords: PersonalRecords;
  today: DayKey;
}

/** Pass: rank-up celebration; fail: red notice with the retry day. Both show the check table. */
export function ExamResultView({ result, previousRecords, today }: ExamResultViewProps) {
  const { evaluation } = result;
  const { target, passed, checks } = evaluation;
  const from = RANKS[Math.max(0, rankIndex(target) - 1)];
  const records = result.state.player.records;

  const newRecords = new Set<ExamMetricKey>();
  for (const check of checks) {
    const id = EXAM_EXERCISE[check.key];
    if ((records[id]?.amount ?? 0) > (previousRecords[id]?.amount ?? 0)) newRecords.add(check.key);
  }
  const recordLabels = checks.filter((c) => newRecords.has(c.key)).map((c) => c.label);
  const missed = checks.filter((c) => !c.passed).map((c) => c.label);
  const met = checks.length - missed.length;
  const cooldown = result.state.player.rankExamCooldownUntil;

  return (
    <>
      {passed ? (
        <RankUpCelebration from={from} to={target} rewardXp={result.rewardXp} />
      ) : (
        <SystemWindow title="Sınav Başarısız" tone="danger" emphasized>
          <View style={styles.failHead}>
            <Ionicons name="close-circle" size={40} color={colors.danger} />
            <View style={styles.flex}>
              <SystemText variant="title" tone="danger" glow>
                {`${target} RANK REDDEDİLDİ`}
              </SystemText>
              <SystemText variant="caption" tone="secondary">
                {`${met}/${checks.length} eşik karşılandı · eksik: ${missed.join(', ')}`}
              </SystemText>
            </View>
          </View>
          <SystemText tone="secondary">
            Rank sınavı yalnızca dört eşiğin hepsi geçildiğinde onaylanır. Eksik kalan hareketlere yoğunlaş.
          </SystemText>
          <View style={styles.cooldown}>
            <Ionicons name="hourglass-outline" size={16} color={colors.danger} />
            <SystemText variant="label" tone="danger" style={styles.flex}>
              {cooldown ? `YENİ DENEME: ${relativeDayLabel(cooldown, today).toLocaleUpperCase('tr-TR')}` : 'YENİ DENEME: YARIN'}
            </SystemText>
          </View>
        </SystemWindow>
      )}

      <SystemWindow
        title="Sınav Sonuçları"
        tone={passed ? 'success' : 'danger'}
        headerRight={
          <SystemText variant="label" tone={passed ? 'success' : 'danger'}>
            {passed ? 'GEÇTİ' : 'KALDI'}
          </SystemText>
        }
      >
        <ExamCheckTable checks={checks} newRecords={newRecords} />
        {passed && result.levelsGained > 0 ? (
          <SystemText variant="label" tone="gold">
            {`LEVEL ${result.fromLevel} → ${result.toLevel}`}
          </SystemText>
        ) : null}
        <SystemText variant="caption" tone="muted">
          {recordLabels.length > 0
            ? `Kişisel rekorların güncellendi: ${recordLabels.join(', ')}. Sınav rekorları boss savaşı sayılmaz.`
            : 'Sonuçların kaydedildi. Rekorunu aşan hareket olmadı.'}
        </SystemText>
      </SystemWindow>
    </>
  );
}

const styles = StyleSheet.create({
  failHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  cooldown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerDim,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerFaint,
  },
});
