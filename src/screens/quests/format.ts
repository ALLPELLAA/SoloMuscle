/** Display formatting for the quests screen (no game rules here). */
import { dayKeyToDate, diffDays, type DayKey } from '@/game';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `05:12:33` — hours:minutes:seconds, rounded up to whole seconds. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/** `Bugün · 22 Kas Paz`, `Dün · 21 Kas Cmt`, otherwise `18 Kas Sal`. */
export function formatHistoryDay(dayKey: DayKey, today: DayKey): string {
  let localized: string;
  try {
    localized = dayKeyToDate(dayKey).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  } catch {
    localized = dayKey;
  }
  let distance: number | null = null;
  try {
    distance = diffDays(dayKey, today);
  } catch {
    distance = null;
  }
  if (distance === 0) return `Bugün · ${localized}`;
  if (distance === 1) return `Dün · ${localized}`;
  return localized;
}
