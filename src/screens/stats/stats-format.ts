/**
 * Presentation helpers for the statistics tab: Turkish date labels and color alpha.
 * No game rules here — values come from '@/game' and the history hooks.
 */
import { dayKeyToDate, type DayKey, type RecordSource } from '@/game';

export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;

const MONTHS_LONG = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

/** Monday-first weekday initials (heatmap rows). */
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

const WEEKDAYS_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

/** Badge text per record source. */
export const RECORD_SOURCE_LABELS: Record<RecordSource, string> = {
  baseline: 'Test',
  set: 'Set',
  exam: 'Sınav',
};

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** `21 Kas` */
export function formatShortDay(dayKey: DayKey): string {
  const date = dayKeyToDate(dayKey);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** `21 Kasım 2026, Cumartesi` */
export function formatLongDay(dayKey: DayKey): string {
  const date = dayKeyToDate(dayKey);
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}, ${WEEKDAYS_LONG[mondayIndex(date)]}`;
}

/** 0-based month of a day. */
export function monthOf(dayKey: DayKey): number {
  return dayKeyToDate(dayKey).getMonth();
}

/** `1.240` (Turkish thousands separator, no Intl dependency). */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `#RRGGBB` theme color → `rgba(r, g, b, a)`. Other formats are returned unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
