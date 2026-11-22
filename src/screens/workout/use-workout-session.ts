import { useCallback, useMemo } from 'react';

import type { ExerciseEntry, ExerciseId } from '@/game';
import { draftEntry, useGame } from '@/state/game-provider';

/** One set of the current workout; `rpe` is null when skipped. */
export interface SessionSet {
  key: number;
  exerciseId: ExerciseId;
  amount: number;
  rpe: number | null;
}

export interface WorkoutSession {
  sets: SessionSet[];
  startedAt: number | null;
  /** Sets in game-logic shape (rpe omitted when skipped). */
  entries: ExerciseEntry[];
  /** `now` is kept for call-site compatibility; the game clock stamps the set. */
  addSet(set: Omit<SessionSet, 'key'>, now?: number): void;
  removeSet(key: number): void;
  clear(): void;
}

export function toEntry(set: Pick<SessionSet, 'exerciseId' | 'amount' | 'rpe'>): ExerciseEntry {
  return draftEntry(set);
}

function report(error: unknown) {
  console.warn('[workout] draft update failed', error);
}

/**
 * The current workout. Backed by the persisted draft in GameProvider (docs §9), so sets
 * survive app restarts and sets added before midnight are saved to their own day.
 */
export function useWorkoutSession(): WorkoutSession {
  const { workoutDraft, addDraftSet, removeDraftSet, clearDraft } = useGame();

  const addSet = useCallback(
    (set: Omit<SessionSet, 'key'>) => {
      addDraftSet(set).catch(report);
    },
    [addDraftSet],
  );
  const removeSet = useCallback(
    (key: number) => {
      removeDraftSet(key).catch(report);
    },
    [removeDraftSet],
  );
  const clear = useCallback(() => {
    clearDraft().catch(report);
  }, [clearDraft]);

  const sets = useMemo<SessionSet[]>(
    () => workoutDraft.sets.map(({ key, exerciseId, amount, rpe }) => ({ key, exerciseId, amount, rpe })),
    [workoutDraft.sets],
  );
  const entries = useMemo(() => sets.map(toEntry), [sets]);

  return { sets, startedAt: workoutDraft.startedAt, entries, addSet, removeSet, clear };
}
