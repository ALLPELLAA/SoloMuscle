import type { DayKey } from '@/game';
import type { Tone } from '@/theme';

/** `Bugün · 18:42` / `21 Kas · 07:10` */
export function formatSessionTime(startedAt: number, dayKey: DayKey, today: DayKey): string {
  const date = new Date(startedAt);
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (dayKey === today) return `Bugün · ${time}`;
  const day = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${day} · ${time}`;
}

/** `45 sn`, `12 dk`, `1 sa 05 dk` */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} sn`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${String(minutes % 60).padStart(2, '0')} dk`;
}

/** `+12` / `0` */
export function signedXp(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Rest preset label: `30 sn`, `90 sn`, `2 dk`. */
export function restLabel(seconds: number): string {
  return seconds >= 120 && seconds % 60 === 0 ? `${seconds / 60} dk` : `${seconds} sn`;
}

/** Colour band of an RPE value: easy → green, target zone → blue, hard → gold/red. */
export function rpeTone(value: number): Tone {
  if (value <= 4) return 'success';
  if (value <= 7) return 'neon';
  if (value <= 8) return 'gold';
  return 'danger';
}
