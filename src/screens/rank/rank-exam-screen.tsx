import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import {
  evaluateRankExam,
  getExamEligibility,
  validateBaseline,
  type BaselineTest,
  type ExamRank,
  type PersonalRecords,
  type RankExamResult,
} from '@/game';
import { useGame } from '@/state/game-provider';
import { colors, radii, spacing } from '@/theme';

import { ExamBlockDetails } from './exam-block-details';
import { ExamInstructionsWindow } from './exam-instructions-window';
import { ExamMetricWindow } from './exam-metric-window';
import { ExamResultView } from './exam-result-view';
import { blockTone, type ExamMetricKey } from './rank-copy';
import { RankHeader } from './rank-header';

const EMPTY_RESULTS: BaselineTest = { pushups: 0, situps: 0, squats: 0, plankSeconds: 0 };

interface Outcome {
  result: RankExamResult;
  previousRecords: PersonalRecords;
}

const openQuests = () => router.push('/(tabs)/quests');

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/rank');
}

/** Rank exam: briefing → four results (+ plank stopwatch) → confirmation → result. */
export function RankExamScreen() {
  const { state, today, takeRankExam } = useGame();
  const [results, setResults] = useState<BaselineTest>(EMPTY_RESULTS);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Target captured at submit time so a state update mid-submit cannot swap it.
  const [lockedTarget, setLockedTarget] = useState<ExamRank | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) {
    return (
      <Screen contentStyle={styles.loading}>
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      </Screen>
    );
  }

  if (outcome) {
    return (
      <Screen
        edges={['top', 'bottom']}
        footer={
          <SystemButton
            variant="solid"
            tone={outcome.result.evaluation.passed ? 'gold' : 'neon'}
            label="Rank ekranına dön"
            icon={<Ionicons name="shield-half" size={18} color={colors.background} />}
            onPress={goBack}
          />
        }
      >
        <RankHeader title="Sınav Sonucu" caption={`Hedef: ${outcome.result.evaluation.target} rank`} icon="ribbon-outline" />
        <ExamResultView result={outcome.result} previousRecords={outcome.previousRecords} today={today} />
      </Screen>
    );
  }

  const eligibility = getExamEligibility(state, today);
  const target = lockedTarget ?? eligibility.target;

  if (!submitting && (!eligibility.allowed || !target)) {
    const tone = blockTone(eligibility.reason);
    return (
      <Screen
        edges={['top', 'bottom']}
        footer={<SystemButton label="Rank ekranına dön" onPress={goBack} />}
      >
        <RankHeader title="Rank Sınavı" caption="Sınav kapısı kapalı" icon="lock-closed-outline" onBack={goBack} />
        <SystemWindow title="Erişim Reddedildi" tone={tone} emphasized>
          <SystemText variant="heading" tone={tone} glow>
            [SİSTEM] Bu sınava şu an giremezsin.
          </SystemText>
          <ExamBlockDetails
            eligibility={eligibility}
            level={state.player.level}
            today={today}
            onOpenQuests={openQuests}
          />
        </SystemWindow>
      </Screen>
    );
  }
  if (!target) return null;

  const preview = evaluateRankExam(target, results);
  const errors = validateBaseline(results);
  const valid = Object.keys(errors).length === 0;
  const met = preview.checks.filter((c) => c.passed).length;
  const total = preview.checks.length;

  const setMetric = (key: ExamMetricKey, value: number) => {
    setResults((prev) => ({ ...prev, [key]: value }));
    setConfirming(false);
    setError(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setLockedTarget(target);
    setError(null);
    const previousRecords = state.player.records;
    try {
      const result = await takeRankExam(results);
      void Haptics.notificationAsync(
        result.evaluation.passed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => undefined);
      setOutcome({ result, previousRecords });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLockedTarget(null);
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  const footer = confirming ? (
    <View style={styles.confirm}>
      <SystemText variant="label" tone={met === total ? 'success' : 'danger'}>
        {met === total ? `✓ ${total}/${total} EŞİK KARŞILANIYOR` : `✗ ${total - met} EŞİK EKSİK`}
      </SystemText>
      <SystemText variant="caption" tone="secondary">
        {met === total
          ? 'Sonuçlar gönderilsin mi? Girdiğin değerlerin gerçek olduğundan emin ol.'
          : 'Bu sonuçlarla sınav başarısız sayılır ve yarına kadar kilitlenir. Yine de gönderilsin mi?'}
      </SystemText>
      <View style={styles.confirmRow}>
        <SystemButton label="Vazgeç" variant="outline" style={styles.flex} onPress={() => setConfirming(false)} disabled={submitting} />
        <SystemButton
          label="Onayla"
          variant="solid"
          tone={met === total ? 'neon' : 'danger'}
          style={styles.flex}
          loading={submitting}
          onPress={() => void submit()}
        />
      </View>
    </View>
  ) : (
    <>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="assertive">
          <Ionicons name="warning-outline" size={18} color={colors.danger} />
          <SystemText variant="caption" tone="danger" style={styles.flex}>
            {error}
          </SystemText>
        </View>
      ) : null}
      <View style={styles.summary}>
        <SystemText variant="label" tone="secondary">
          CANLI DEĞERLENDİRME
        </SystemText>
        <SystemText variant="mono" tone={met === total ? 'success' : 'default'}>
          {`${met}/${total} EŞİK`}
        </SystemText>
      </View>
      <SystemButton
        variant="solid"
        label="Sonuçları gönder"
        icon={<Ionicons name="send" size={16} color={colors.background} />}
        disabled={!valid}
        onPress={() => setConfirming(true)}
      />
    </>
  );

  return (
    <Screen edges={['top', 'bottom']} footer={footer}>
      <RankHeader title="Rank Sınavı" caption={`${state.player.rank} → ${target} değerlendirmesi`} icon="shield-half-outline" onBack={goBack} />
      <ExamInstructionsWindow target={target} />
      {preview.checks.map((check, index) => (
        <ExamMetricWindow
          key={check.key}
          index={index}
          total={total}
          check={check}
          error={errors[check.key]}
          onChange={(value) => setMetric(check.key, value)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, justifyContent: 'center' },
  flex: { flex: 1 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirm: { gap: spacing.sm },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dangerDim,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerFaint,
  },
});
