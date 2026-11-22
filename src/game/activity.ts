/** Statistics helpers: activity heatmap and raw daily XP (docs/GAME_DESIGN.md §14). */
import { addDays, compareDayKeys, dayKeyToDate } from './date';
import { getExercise, isExerciseId } from './exercises';
import type { DayKey } from './types';

export const HEATMAP_WEEKS = 20;

/** One logged set (amount in the exercise's unit). */
export interface DailyVolumeRow {
  dayKey: DayKey;
  exerciseId: string;
  amount: number;
}

/** Raw XP per day, independent of the XP lock: Σ round(amount · xpPerUnit), rounded per set. */
export function rawXpByDay(rows: readonly DailyVolumeRow[]): Record<DayKey, number> {
  const totals: Record<DayKey, number> = {};
  for (const row of rows) {
    if (!isExerciseId(row.exerciseId)) continue;
    const xp = Math.round(row.amount * getExercise(row.exerciseId).xpPerUnit);
    totals[row.dayKey] = (totals[row.dayKey] ?? 0) + xp;
  }
  return totals;
}

/** Monday-first weekday index 0..6 of a day. */
export function weekdayIndex(dayKey: DayKey): number {
  return (dayKeyToDate(dayKey).getDay() + 6) % 7;
}

export interface HeatCell {
  dayKey: DayKey;
  value: number;
  /** 0 = no activity … 4 = top quartile. */
  level: 0 | 1 | 2 | 3 | 4;
  rest: boolean;
  questDone: boolean;
  /** After `endDay` (rendered empty). */
  future: boolean;
}

export interface Heatmap {
  /** Columns (weeks, oldest first), each with 7 cells Monday→Sunday. */
  weeks: HeatCell[][];
  thresholds: [number, number, number];
  activeDays: number;
  totalValue: number;
}

/** q(p) = sorted[floor(p·(n−1))] */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(p * (sorted.length - 1))];
}

export interface HeatmapInput {
  endDay: DayKey;
  weeks?: number;
  values: Record<DayKey, number>;
  restDays?: readonly DayKey[];
  questDays?: readonly DayKey[];
}

export function buildHeatmap(input: HeatmapInput): Heatmap {
  const weeks = input.weeks ?? HEATMAP_WEEKS;
  const rest = new Set(input.restDays ?? []);
  const quests = new Set(input.questDays ?? []);
  const lastMonday = addDays(input.endDay, -weekdayIndex(input.endDay));
  const firstDay = addDays(lastMonday, -7 * (weeks - 1));

  const dayKeys: DayKey[] = [];
  for (let i = 0; i < weeks * 7; i++) dayKeys.push(addDays(firstDay, i));

  const inRange = dayKeys.filter((d) => compareDayKeys(d, input.endDay) <= 0);
  const positive = inRange
    .map((d) => input.values[d] ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const thresholds: [number, number, number] = [
    quantile(positive, 0.25),
    quantile(positive, 0.5),
    quantile(positive, 0.75),
  ];

  const levelOf = (value: number): HeatCell['level'] => {
    if (value <= 0) return 0;
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    return 4;
  };

  const columns: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dayKey = dayKeys[w * 7 + d];
      const future = compareDayKeys(dayKey, input.endDay) > 0;
      const value = future ? 0 : (input.values[dayKey] ?? 0);
      column.push({
        dayKey,
        value,
        level: future ? 0 : levelOf(value),
        rest: !future && rest.has(dayKey),
        questDone: !future && quests.has(dayKey),
        future,
      });
    }
    columns.push(column);
  }

  return {
    weeks: columns,
    thresholds,
    activeDays: positive.length,
    totalValue: positive.reduce((a, b) => a + b, 0),
  };
}
