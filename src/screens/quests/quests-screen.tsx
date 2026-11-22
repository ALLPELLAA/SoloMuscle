import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuestCard } from '@/components/quest-card';
import { Screen } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import {
  isValidRpe,
  validateExerciseAmount,
  type ExerciseEntry,
  type ExerciseId,
  type Quest,
  type RestDayKind,
} from '@/game';
import { useGame } from '@/state/game-provider';
import { colors, spacing } from '@/theme';

import { buildErrorToast, buildLogToast, buildRestToast, type LogToastContent } from './log-toast-content';
import { LogToast } from './log-toast';
import { PenaltyLockNotice } from './penalty-lock-notice';
import { QuestCompleteWindow } from './quest-complete-window';
import { QuestHistoryWindow } from './quest-history-window';
import { QuestsHeader } from './quests-header';
import { QuickLogPanel } from './quick-log-panel';
import { RestDayWindow } from './rest-day-window';
import { useQuestHistory } from './use-quest-history';

const HISTORY_LIMIT = 14;

function firstOpenObjective(quest: Quest | null): ExerciseId | null {
  if (!quest || quest.status !== 'active') return null;
  return quest.objectives.find((o) => o.progress < o.target)?.exerciseId ?? null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Kayıt sırasında bir hata oluştu.';
}

/** "Görevler" tab: penalty quest, daily quest with quick logging, and quest history. */
export function QuestsScreen() {
  const { state, today, xpLocked, restDayToday, restDayEligibility, logWorkout, markRestDay, unmarkRestDay, refresh } =
    useGame();
  const history = useQuestHistory(HISTORY_LIMIT);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; content: LogToastContent } | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh().catch((error: unknown) => console.warn('[quests] refresh failed', error));
    }, [refresh]),
  );

  const showToast = useCallback((content: LogToastContent) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, content }));
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const handleLog = useCallback(
    async (exerciseId: ExerciseId, amount: number, rpe: number | undefined): Promise<boolean> => {
      const invalid = validateExerciseAmount(exerciseId, amount);
      if (invalid || (rpe !== undefined && !isValidRpe(rpe))) {
        showToast(buildErrorToast(invalid ?? 'RPE 1–10 arasında olmalı.'));
        return false;
      }
      setBusy(true);
      try {
        const entry: ExerciseEntry = rpe === undefined ? { exerciseId, amount } : { exerciseId, amount, rpe };
        const result = await logWorkout([entry]);
        showToast(buildLogToast(result, entry));
        const feedback =
          result.completedQuests.length > 0
            ? Haptics.NotificationFeedbackType.Success
            : result.xpLocked
              ? Haptics.NotificationFeedbackType.Warning
              : null;
        if (feedback !== null) void Haptics.notificationAsync(feedback).catch(() => undefined);
        return true;
      } catch (error) {
        showToast(buildErrorToast(errorText(error)));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [logWorkout, showToast],
  );

  const runRestAction = useCallback(
    async (kind: RestDayKind | null): Promise<boolean> => {
      setBusy(true);
      try {
        if (kind) await markRestDay(kind);
        else await unmarkRestDay();
        showToast(buildRestToast(kind));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        return true;
      } catch (error) {
        showToast(buildErrorToast(errorText(error)));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [markRestDay, showToast, unmarkRestDay],
  );
  const handleMarkRest = useCallback((kind: RestDayKind) => runRestAction(kind), [runRestAction]);
  const handleUnmarkRest = useCallback(() => runRestAction(null), [runRestAction]);

  if (!state) {
    return (
      <Screen contentStyle={styles.loading}>
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      </Screen>
    );
  }

  const { dailyQuest, penaltyQuest, player } = state;
  const penaltyActive = penaltyQuest?.status === 'active';
  const activeCount = [dailyQuest, penaltyQuest].filter((q) => q?.status === 'active').length;
  const nextExercise = firstOpenObjective(penaltyQuest) ?? firstOpenObjective(dailyQuest);

  const startWorkout = () => {
    if (nextExercise) router.push({ pathname: '/(tabs)/workout', params: { exercise: nextExercise } });
    else router.push('/(tabs)/workout');
  };

  return (
    <View style={styles.root}>
      <Screen>
        <QuestsHeader activeCount={activeCount} penaltyActive={penaltyActive} />

        {penaltyQuest ? (
          <View style={styles.section}>
            <PenaltyLockNotice lifted={!penaltyActive} />
            <QuestCard quest={penaltyQuest} />
            {penaltyActive ? (
              <QuickLogPanel quest={penaltyQuest} tone="danger" xpLocked={xpLocked} busy={busy} onLog={handleLog} />
            ) : null}
          </View>
        ) : null}

        {dailyQuest ? (
          <View style={styles.section}>
            {dailyQuest.status === 'completed' ? (
              <>
                <QuestCompleteWindow
                  quest={dailyQuest}
                  streak={player.streak}
                  onFreeWorkout={() => router.push('/(tabs)/workout')}
                />
                <QuestCard quest={dailyQuest} compact />
              </>
            ) : (
              <>
                <QuestCard quest={dailyQuest} xpLocked={xpLocked} />
                {dailyQuest.status === 'active' ? (
                  <QuickLogPanel quest={dailyQuest} tone="neon" xpLocked={xpLocked} busy={busy} onLog={handleLog} />
                ) : null}
              </>
            )}
          </View>
        ) : (
          <SystemWindow title="Günlük Görev">
            <SystemText tone="secondary">Bugünün görevi hazırlanıyor...</SystemText>
          </SystemWindow>
        )}

        {nextExercise ? (
          <SystemButton
            label="Antrenmana Başla"
            variant="solid"
            tone={penaltyActive ? 'danger' : 'neon'}
            icon={<Ionicons name="barbell" size={20} color={colors.background} />}
            accessibilityHint="Antrenman sekmesini sıradaki hedef egzersizle açar"
            onPress={startWorkout}
          />
        ) : null}

        <RestDayWindow
          restDay={restDayToday}
          eligibility={restDayEligibility}
          penaltyActive={penaltyActive}
          busy={busy}
          onMark={handleMarkRest}
          onUnmark={handleUnmarkRest}
        />

        <QuestHistoryWindow quests={history.quests} today={today} loaded={history.loaded} />
      </Screen>

      {toast ? <LogToast key={toast.id} id={toast.id} content={toast.content} onDismiss={dismissToast} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flexGrow: 1, justifyContent: 'center' },
  section: { gap: spacing.md },
});
