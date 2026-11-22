import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import {
  GameRuleError,
  isExerciseId,
  isValidRpe,
  previewSessionXp,
  summarizeSets,
  validateExerciseAmount,
  type ExerciseId,
  type GameState,
  type LogResult,
} from '@/game';
import { useGame } from '@/state/game-provider';
import { useLastSets, useRecentSessions } from '@/state/use-history';

import { ExercisePicker } from './exercise-picker';
import { computePrefill, questExerciseIds } from './prefill';
import { projectSession } from './projection';
import { RecentSessionsWindow } from './recent-sessions-window';
import { RestTimerPanel } from './rest-timer-panel';
import { SessionWindow } from './session-window';
import { SetEntryWindow } from './set-entry-window';
import { useRestTimer } from './use-rest-timer';
import { toEntry, useWorkoutSession } from './use-workout-session';
import { WorkoutHeader } from './workout-header';
import { WorkoutResultWindow } from './workout-result-window';

/** Values the user changed for the next set; null/undefined = use the auto-fill. */
interface Draft {
  exerciseId: ExerciseId;
  amount: number | null;
  /** undefined = auto-fill, null = explicitly skipped. */
  rpe: number | null | undefined;
}

interface FinishedWorkout {
  result: LogResult;
  setCount: number;
}

function parseExerciseParam(value: string | string[] | undefined): ExerciseId | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && isExerciseId(raw) ? raw : null;
}

/** "Antrenman" tab: set logger with auto-fill, RPE, records, rest timer (docs §9–§11). */
export function WorkoutScreen() {
  const { state } = useGame();
  if (!state) {
    return (
      <Screen contentStyle={styles.loading}>
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      </Screen>
    );
  }
  return <WorkoutLogger state={state} />;
}

function WorkoutLogger({ state }: { state: GameState }) {
  const { today, xpLocked, logWorkout } = useGame();
  const params = useLocalSearchParams<{ exercise?: string }>();
  const paramId = parseExerciseParam(params.exercise);
  const session = useWorkoutSession();
  const rest = useRestTimer();
  const lastSets = useLastSets();
  const recentSessions = useRecentSessions(10);

  const questIds = questExerciseIds(state.dailyQuest);
  const penaltyIds = questExerciseIds(state.penaltyQuest);

  const [draft, setDraft] = useState<Draft>(() => ({
    exerciseId: paramId ?? penaltyIds[0] ?? questIds[0] ?? 'pushup',
    amount: null,
    rpe: undefined,
  }));
  const [seenParam, setSeenParam] = useState(paramId);
  if (paramId !== seenParam) {
    // A deep link (e.g. from a quest) picked an exercise: switch to it.
    setSeenParam(paramId);
    if (paramId) setDraft({ exerciseId: paramId, amount: null, rpe: undefined });
  }

  const [busy, setBusy] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finished, setFinished] = useState<FinishedWorkout | null>(null);

  const { exerciseId } = draft;
  const prefill = computePrefill(exerciseId, session.sets, lastSets, state);
  const amount = draft.amount ?? prefill.amount;
  const rpe = draft.rpe === undefined ? prefill.rpe : draft.rpe;
  const amountError =
    validateExerciseAmount(exerciseId, amount) ??
    (rpe !== null && !isValidRpe(rpe) ? 'RPE 1–10 arasında bir tam sayı olmalı.' : null);

  const { entries } = session;
  const sessionProjection = useMemo(() => projectSession(state, entries, 0), [state, entries]);
  const candidateProjection = useMemo(
    () => (amountError ? null : projectSession(state, [...entries, toEntry({ exerciseId, amount, rpe })], 0)),
    [state, entries, exerciseId, amount, rpe, amountError],
  );
  const candidateEvent =
    candidateProjection && candidateProjection.entryRecord.at(-1) === true
      ? (candidateProjection.recordEvents.at(-1) ?? null)
      : null;
  const storedRecord = state.player.records[exerciseId];
  const effectiveRecord = (sessionProjection?.state ?? state).player.records[exerciseId];
  const totals = useMemo(() => summarizeSets(entries), [entries]);
  const setXp = useMemo(() => previewSessionXp(entries), [entries]);

  const selectExercise = (id: ExerciseId) => {
    setDraft({ exerciseId: id, amount: null, rpe: undefined });
    if (params.exercise) router.setParams({ exercise: undefined });
  };

  const addSet = () => {
    if (amountError) return;
    session.addSet({ exerciseId, amount, rpe }, Date.now());
    setDraft({ exerciseId, amount: null, rpe: undefined });
    setFinishError(null);
    rest.start();
  };

  const resetDraft = () => setDraft((d) => ({ exerciseId: d.exerciseId, amount: null, rpe: undefined }));

  const finish = async () => {
    if (entries.length === 0 || busy) return;
    setBusy(true);
    setFinishError(null);
    const setCount = entries.length;
    try {
      const result = await logWorkout(entries, session.startedAt ?? Date.now());
      setFinished({ result, setCount });
      session.clear();
      rest.skip();
      resetDraft();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      setFinishError(
        error instanceof GameRuleError ? error.message : 'Antrenman kaydedilemedi. Lütfen tekrar dene.',
      );
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    session.clear();
    rest.skip();
    resetDraft();
    setFinishError(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  };

  const header = <WorkoutHeader startedAt={session.startedAt} setCount={session.sets.length} xpLocked={xpLocked} />;

  if (finished) {
    return (
      <Screen>
        {header}
        <WorkoutResultWindow result={finished.result} setCount={finished.setCount} onClose={() => setFinished(null)} />
        <RecentSessionsWindow sessions={recentSessions} today={today} />
      </Screen>
    );
  }

  return (
    <Screen footer={rest.active ? <RestTimerPanel rest={rest} /> : undefined}>
      {header}
      {xpLocked ? (
        <SystemWindow title="Ceza Görevi Aktif" tone="danger" emphasized>
          <SystemText variant="caption" tone="secondary">
            XP kilitli. Setler önce ceza görevine sayılır; ceza tamamlandıktan sonraki setler yeniden XP kazandırır.
          </SystemText>
          <SystemButton
            label="Ceza Görevini Gör"
            size="sm"
            tone="danger"
            variant="outline"
            onPress={() => router.push('/(tabs)/quests')}
          />
        </SystemWindow>
      ) : null}
      <ExercisePicker selected={exerciseId} onSelect={selectExercise} questIds={questIds} penaltyIds={penaltyIds} />
      <SetEntryWindow
        exerciseId={exerciseId}
        amount={amount}
        onAmountChange={(value) => setDraft((d) => ({ ...d, amount: value }))}
        rpe={rpe}
        onRpeChange={(value) => setDraft((d) => ({ ...d, rpe: value }))}
        prefill={prefill}
        record={effectiveRecord}
        recordFromSession={effectiveRecord !== storedRecord}
        recordEvent={candidateEvent}
        restSeconds={rest.presetSeconds}
        onRestSecondsChange={rest.setPresetSeconds}
        error={amountError}
        onAddSet={addSet}
        disabled={busy}
      />
      <SessionWindow
        sets={session.sets}
        totals={totals}
        setXp={setXp}
        projection={sessionProjection}
        xpLocked={xpLocked}
        busy={busy}
        error={finishError}
        onRemove={session.removeSet}
        onFinish={() => void finish()}
        onCancel={cancel}
      />
      <RecentSessionsWindow sessions={recentSessions} today={today} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, justifyContent: 'center' },
});
