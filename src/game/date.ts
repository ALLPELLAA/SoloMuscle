import type { DayKey } from './types';

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Local-time calendar day of `date` (a Date or epoch milliseconds). */
export function toDayKey(date: Date | number): DayKey {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isDayKey(value: string): boolean {
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return toDayKey(date) === value;
}

function parts(dayKey: DayKey): [number, number, number] {
  const match = DAY_KEY_PATTERN.exec(dayKey);
  if (!match) throw new Error(`Invalid day key: ${dayKey}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Local Date at 00:00 of the given day. */
export function dayKeyToDate(dayKey: DayKey): Date {
  const [y, m, d] = parts(dayKey);
  return new Date(y, m - 1, d);
}

export function addDays(dayKey: DayKey, days: number): DayKey {
  const [y, m, d] = parts(dayKey);
  // Noon avoids DST edge cases when the calendar day shifts.
  return toDayKey(new Date(y, m - 1, d + days, 12));
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). DST-safe. */
export function diffDays(from: DayKey, to: DayKey): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY);
}

export function compareDayKeys(a: DayKey, b: DayKey): number {
  return diffDays(b, a);
}

/** Milliseconds from `now` until the next local midnight (always > 0). */
export function msUntilNextMidnight(now: Date | number): number {
  const d = typeof now === 'number' ? new Date(now) : now;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return Math.max(1, next.getTime() - d.getTime());
}
