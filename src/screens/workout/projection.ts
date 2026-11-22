/** Dry-runs the real game engine on the unsaved session (preview only, nothing is written). */
import { applyExerciseLogs, type ExerciseEntry, type GameState, type LogResult } from '@/game';

export function projectSession(state: GameState, entries: ExerciseEntry[], now: number): LogResult | null {
  if (entries.length === 0) return null;
  try {
    return applyExerciseLogs(state, entries, now);
  } catch {
    return null;
  }
}
