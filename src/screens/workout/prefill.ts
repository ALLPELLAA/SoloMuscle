/** Auto-fill for the next set (docs §9): previous set in this session → last DB set → quest → default. */
import { AMOUNT_LIMITS, EXERCISES, type ExerciseId, type ExerciseUnit, type GameState, type Quest } from '@/game';
import type { LastSet } from '@/db/mappers';

import type { SessionSet } from './use-workout-session';

export type PrefillSource = 'session' | 'history' | 'penalty' | 'quest' | 'default';

export interface Prefill {
  amount: number;
  rpe: number | null;
  source: PrefillSource;
}

const DEFAULT_AMOUNTS: Record<ExerciseUnit, number> = { reps: 10, seconds: 30, minutes: 5 };

function clampToUnit(unit: ExerciseUnit, amount: number): number {
  const { min, max } = AMOUNT_LIMITS[unit];
  return Math.min(max, Math.max(min, Math.round(amount)));
}

/** Remaining amount of an unfinished objective for this exercise in an active quest. */
function questAmount(quest: Quest | null, exerciseId: ExerciseId): number | null {
  if (!quest || quest.status !== 'active') return null;
  const objective = quest.objectives.find((o) => o.exerciseId === exerciseId);
  if (!objective) return null;
  const remaining = objective.target - objective.progress;
  return remaining > 0 ? remaining : null;
}

export function computePrefill(
  exerciseId: ExerciseId,
  sessionSets: readonly SessionSet[],
  lastSets: Partial<Record<ExerciseId, LastSet>>,
  state: Pick<GameState, 'dailyQuest' | 'penaltyQuest'>,
): Prefill {
  const { unit } = EXERCISES[exerciseId];

  for (let i = sessionSets.length - 1; i >= 0; i--) {
    const set = sessionSets[i];
    if (set.exerciseId === exerciseId) {
      return { amount: clampToUnit(unit, set.amount), rpe: set.rpe, source: 'session' };
    }
  }

  const last = lastSets[exerciseId];
  if (last) return { amount: clampToUnit(unit, last.amount), rpe: last.rpe, source: 'history' };

  const penalty = questAmount(state.penaltyQuest, exerciseId);
  if (penalty !== null) return { amount: clampToUnit(unit, penalty), rpe: null, source: 'penalty' };

  const daily = questAmount(state.dailyQuest, exerciseId);
  if (daily !== null) return { amount: clampToUnit(unit, daily), rpe: null, source: 'quest' };

  return { amount: DEFAULT_AMOUNTS[unit], rpe: null, source: 'default' };
}

/** Exercises with an unfinished objective in an active quest (for picker markers / default pick). */
export function questExerciseIds(quest: Quest | null): ExerciseId[] {
  if (!quest || quest.status !== 'active') return [];
  return quest.objectives.filter((o) => o.progress < o.target).map((o) => o.exerciseId);
}
