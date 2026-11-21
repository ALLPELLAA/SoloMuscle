/** Rest / sick days and the daily-quest streak (docs/GAME_DESIGN.md §13). */
import { addDays, compareDayKeys } from './date';
import { GameRuleError, type DayKey, type GameState, type RestDay, type RestDayKind, type Streak } from './types';

export const REST_DAY_LIMIT = 3;
export const REST_WINDOW_DAYS = 7;

export const REST_KIND_LABELS: Record<RestDayKind, string> = {
  rest: 'Dinlenme günü',
  sick: 'Hasta günü',
};

export type RestDayBlockReason = 'already_marked' | 'quest_completed' | 'limit';

export const REST_DAY_BLOCK_MESSAGES: Record<RestDayBlockReason, string> = {
  already_marked: 'Bugün zaten işaretli.',
  quest_completed: 'Bugünün görevi tamamlandı; dinlenme günü gerekmiyor.',
  limit: `Son ${REST_WINDOW_DAYS} günde en fazla ${REST_DAY_LIMIT} dinlenme/hasta günü işaretlenebilir.`,
};

export function emptyStreak(): Streak {
  return { current: 0, best: 0, lastCompletedDay: null };
}

export function findRestDay(restDays: readonly RestDay[], dayKey: DayKey): RestDay | undefined {
  return restDays.find((d) => d.dayKey === dayKey);
}

export function isRestDay(restDays: readonly RestDay[], dayKey: DayKey): boolean {
  return findRestDay(restDays, dayKey) !== undefined;
}

/** Marked days in the window [today − 6, today]. */
export function restDaysInWindow(restDays: readonly RestDay[], today: DayKey): number {
  const from = addDays(today, -(REST_WINDOW_DAYS - 1));
  return restDays.filter((d) => compareDayKeys(d.dayKey, from) >= 0 && compareDayKeys(d.dayKey, today) <= 0).length;
}

export interface RestDayEligibility {
  allowed: boolean;
  reason: RestDayBlockReason | null;
  usedInWindow: number;
}

export function getRestDayEligibility(state: GameState, today: DayKey): RestDayEligibility {
  const usedInWindow = restDaysInWindow(state.restDays, today);
  if (isRestDay(state.restDays, today)) return { allowed: false, reason: 'already_marked', usedInWindow };
  const daily = state.dailyQuest;
  if (daily && daily.dayKey === today && daily.status === 'completed') {
    return { allowed: false, reason: 'quest_completed', usedInWindow };
  }
  if (usedInWindow >= REST_DAY_LIMIT) return { allowed: false, reason: 'limit', usedInWindow };
  return { allowed: true, reason: null, usedInWindow };
}

export function markRestDay(state: GameState, today: DayKey, kind: RestDayKind): GameState {
  const eligibility = getRestDayEligibility(state, today);
  if (!eligibility.allowed && eligibility.reason) {
    throw new GameRuleError('rest_day_not_allowed', REST_DAY_BLOCK_MESSAGES[eligibility.reason]);
  }
  return { ...state, restDays: [...state.restDays, { dayKey: today, kind }] };
}

/** Removes today's mark (past days cannot be changed). */
export function unmarkRestDay(state: GameState, today: DayKey): GameState {
  if (!isRestDay(state.restDays, today)) return state;
  return { ...state, restDays: state.restDays.filter((d) => d.dayKey !== today) };
}

export function extendStreak(streak: Streak, dayKey: DayKey): Streak {
  if (streak.lastCompletedDay === dayKey) return streak;
  const current = streak.current + 1;
  return { current, best: Math.max(streak.best, current), lastCompletedDay: dayKey };
}

export function breakStreak(streak: Streak): Streak {
  return streak.current === 0 ? streak : { ...streak, current: 0 };
}
