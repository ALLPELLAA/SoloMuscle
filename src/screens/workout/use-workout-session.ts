import { useCallback, useMemo, useState } from 'react';

import type { ExerciseEntry, ExerciseId } from '@/game';

/** One set in the in-memory session; `rpe` is null when skipped. */
export interface SessionSet {
  key: number;
  exerciseId: ExerciseId;
  amount: number;
  rpe: number | null;
}

interface SessionState {
  sets: SessionSet[];
  /** Epoch ms of the first added set (null while empty). */
  startedAt: number | null;
  nextKey: number;
}

const EMPTY: SessionState = { sets: [], startedAt: null, nextKey: 1 };

export interface WorkoutSession {
  sets: SessionSet[];
  startedAt: number | null;
  /** Sets in game-logic shape (rpe omitted when skipped). */
  entries: ExerciseEntry[];
  addSet(set: Omit<SessionSet, 'key'>, now: number): void;
  removeSet(key: number): void;
  clear(): void;
}

export function toEntry({ exerciseId, amount, rpe }: Pick<SessionSet, 'exerciseId' | 'amount' | 'rpe'>): ExerciseEntry {
  return rpe === null ? { exerciseId, amount } : { exerciseId, amount, rpe };
}

/** In-memory workout session; nothing is persisted until the workout is finished. */
export function useWorkoutSession(): WorkoutSession {
  const [session, setSession] = useState<SessionState>(EMPTY);

  const addSet = useCallback((set: Omit<SessionSet, 'key'>, now: number) => {
    setSession((prev) => ({
      sets: [...prev.sets, { ...set, key: prev.nextKey }],
      startedAt: prev.startedAt ?? now,
      nextKey: prev.nextKey + 1,
    }));
  }, []);

  const removeSet = useCallback((key: number) => {
    setSession((prev) => {
      const sets = prev.sets.filter((s) => s.key !== key);
      return { ...prev, sets, startedAt: sets.length > 0 ? prev.startedAt : null };
    });
  }, []);

  const clear = useCallback(() => setSession((prev) => ({ ...EMPTY, nextKey: prev.nextKey })), []);

  const entries = useMemo(() => session.sets.map(toEntry), [session.sets]);

  return { sets: session.sets, startedAt: session.startedAt, entries, addSet, removeSet, clear };
}
