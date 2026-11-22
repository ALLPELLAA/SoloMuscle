/** Pure helpers for workout sessions and the rest timer (docs/GAME_DESIGN.md §9). */
import { compareDayKeys, toDayKey } from './date';
import { exerciseXp } from './engine';
import type { DayKey, ExerciseEntry, ExerciseId } from './types';

export const REST_PRESETS_SECONDS: readonly number[] = [30, 60, 90, 120, 180];
export const DEFAULT_REST_SECONDS = 60;

export interface RestTimer {
  startedAt: number;
  durationMs: number;
}

export function startRestTimer(now: number, seconds: number): RestTimer {
  return { startedAt: now, durationMs: Math.max(0, Math.round(seconds * 1000)) };
}

export function restRemainingMs(timer: RestTimer, now: number): number {
  return Math.max(0, timer.startedAt + timer.durationMs - now);
}

export function isRestFinished(timer: RestTimer, now: number): boolean {
  return restRemainingMs(timer, now) === 0;
}

/** Adds (or subtracts) seconds to a running timer without going below zero remaining. */
export function adjustRestTimer(timer: RestTimer, deltaSeconds: number, now: number): RestTimer {
  const remaining = restRemainingMs(timer, now) + deltaSeconds * 1000;
  return { startedAt: now, durationMs: Math.max(0, Math.round(remaining)) };
}

/** `mm:ss` for a duration in milliseconds (rounded up to whole seconds). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export interface ExerciseTotal {
  exerciseId: ExerciseId;
  sets: number;
  amount: number;
}

/** Per-exercise totals in first-appearance order. */
export function summarizeSets(entries: ExerciseEntry[]): ExerciseTotal[] {
  const totals = new Map<ExerciseId, ExerciseTotal>();
  for (const entry of entries) {
    const total = totals.get(entry.exerciseId) ?? { exerciseId: entry.exerciseId, sets: 0, amount: 0 };
    total.sets += 1;
    total.amount += entry.amount;
    totals.set(entry.exerciseId, total);
  }
  return [...totals.values()];
}

/** Estimated level XP for a list of sets when XP is not locked (quest rewards excluded). */
export function previewSessionXp(entries: ExerciseEntry[]): number {
  return entries.reduce((acc, entry) => acc + exerciseXp(entry), 0);
}

export interface DaySplit<T> {
  /** Sets added on or before the closing day (they count for that day). */
  closing: T[];
  /** Sets added after it (they stay in the open workout). */
  remaining: T[];
}

/**
 * Splits an open workout at a day change (docs §9): each set counts for the local day of
 * its `at` timestamp. Order is preserved in both parts.
 */
export function splitSetsAtDayChange<T extends { at: number }>(sets: readonly T[], closingDay: DayKey): DaySplit<T> {
  const closing: T[] = [];
  const remaining: T[] = [];
  for (const set of sets) {
    (compareDayKeys(toDayKey(set.at), closingDay) <= 0 ? closing : remaining).push(set);
  }
  return { closing, remaining };
}
