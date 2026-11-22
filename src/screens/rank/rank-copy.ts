/** Presentation-only copy and formatting helpers for the rank tab and the rank exam. */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import {
  dayKeyToDate,
  diffDays,
  type BaselineTest,
  type DayKey,
  type ExamBlockReason,
  type ExerciseId,
  type PersonalRecords,
  type Rank,
} from '@/game';
import type { Tone } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type ExamMetricKey = keyof BaselineTest;

/** Flavor description of each rank (shown under the big badge). */
export const RANK_DESCRIPTIONS: Record<Rank, string> = {
  E: 'Sistem seni yeni fark etti. Bedenin henüz ham ama uyanış başladı; her tekrar bir temel taşı.',
  D: 'Disiplin şekilleniyor. Günlük görevler artık bir yük değil, bir rutin.',
  C: 'Ortalamanın üstündesin. Güç ve dayanıklılık dengede; zindanlar seni korkutmuyor.',
  B: 'Az sayıda avcının ulaştığı eşik. Vücudun bir silaha dönüşmeye başladı.',
  A: 'Sınırlarını defalarca aştın. Sistem seni artık bir tehdit olarak kaydediyor.',
  S: 'Zirvedesin. Önünde yeni rank yok; tek rakibin dünkü kendin.',
};

/** Exercise whose personal record an exam metric updates (docs §10). */
export const EXAM_EXERCISE: Record<ExamMetricKey, ExerciseId> = {
  pushups: 'pushup',
  situps: 'situp',
  squats: 'squat',
  plankSeconds: 'plank',
};

export const METRIC_ICONS: Record<ExamMetricKey, IconName> = {
  pushups: 'barbell-outline',
  situps: 'body-outline',
  squats: 'walk-outline',
  plankSeconds: 'timer-outline',
};

/** Short form instructions for each exam movement. */
export const METRIC_HINTS: Record<ExamMetricKey, string> = {
  pushups: 'Tek set, form bozulana kadar. Göğsün yere yaklaşmadığı tekrar sayılmaz.',
  situps: 'Ayaklar yerde, dizler bükülü. Durmadan yapabildiğin kadar doğrul.',
  squats: 'Kalça diz hizasına insin, topuklar yerden kalkmasın. Duraksadığın an bitir.',
  plankSeconds: 'Dirsekler omuz altında, vücut dümdüz. Kalça düştüğü an süre biter.',
};

/** Value with its unit, e.g. `20` or `60 sn`. */
export function formatMetric(key: ExamMetricKey, value: number): string {
  return key === 'plankSeconds' ? `${value} sn` : String(value);
}

/** Current records as an exam input (missing record = 0), for readiness previews. */
export function recordsAsBaseline(records: PersonalRecords): BaselineTest {
  return {
    pushups: records.pushup?.amount ?? 0,
    situps: records.situp?.amount ?? 0,
    squats: records.squat?.amount ?? 0,
    plankSeconds: records.plank?.amount ?? 0,
  };
}

export function formatDay(dayKey: DayKey): string {
  try {
    return dayKeyToDate(dayKey).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dayKey;
  }
}

export function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** `bugün`, `yarın`, `dün` or the full date. */
export function relativeDayLabel(dayKey: DayKey, today: DayKey): string {
  const diff = diffDays(today, dayKey);
  if (diff === 0) return 'bugün';
  if (diff === 1) return `yarın · ${formatDay(dayKey)}`;
  if (diff === -1) return 'dün';
  return formatDay(dayKey);
}

/** Window tone for a closed exam gate: red for penalty, gold for max rank. */
export function blockTone(reason: ExamBlockReason | null): Tone {
  if (reason === 'penalty') return 'danger';
  if (reason === 'max_rank') return 'gold';
  return 'neon';
}
