/** Builds the system message shown after a quick log (reads LogResult; no game rules here). */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import {
  formatAmount,
  getExercise,
  REST_KIND_LABELS,
  RPE_LABELS,
  STAT_KEYS,
  STAT_LABELS,
  type ExerciseEntry,
  type LogResult,
  type RestDayKind,
} from '@/game';
import type { Tone } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface ToastHighlight {
  text: string;
  tone: Tone;
}

export interface LogToastContent {
  tone: Tone;
  icon: IconName;
  /** Big headline, e.g. `+11 XP` or `XP KİLİTLİ`. */
  headline: string;
  lines: string[];
  highlights: ToastHighlight[];
}

export function buildLogToast(result: LogResult, entry: ExerciseEntry): LogToastContent {
  const def = getExercise(entry.exerciseId);
  const lines = [`${def.name} · ${formatAmount(entry.exerciseId, entry.amount)} kaydedildi.`];
  const highlights: ToastHighlight[] = [];
  if (entry.rpe !== undefined) lines.push(`Zorluk: RPE ${entry.rpe} · ${RPE_LABELS[entry.rpe]}`);

  if (result.xpLocked) {
    lines.push('Ceza Görevi aktif: bu kayıt XP vermedi.');
  } else {
    if (result.recordBonusXp > 0) lines.push(`Boss bonusu: +${result.recordBonusXp} XP`);
    const increases = STAT_KEYS.filter((key) => (result.statIncreases[key] ?? 0) > 0).map(
      (key) => `${STAT_LABELS[key]} +${result.statIncreases[key] ?? 0}`,
    );
    if (increases.length > 0) lines.push(`Stat artışı: ${increases.join(', ')}`);
  }

  let tone: Tone = result.xpLocked ? 'danger' : 'neon';
  let icon: IconName = result.xpLocked ? 'lock-closed' : 'flash';

  for (const quest of result.completedQuests) {
    if (quest.kind === 'penalty') {
      highlights.push({ text: 'CEZA GÖREVİ TAMAMLANDI! XP KİLİDİ KALKTI', tone: 'success' });
      tone = 'success';
      icon = 'lock-open';
    } else if (quest.awardedXp > 0) {
      highlights.push({ text: `GÖREV TAMAMLANDI! +${quest.awardedXp} XP`, tone: 'gold' });
      tone = 'gold';
      icon = 'trophy';
    } else {
      highlights.push({ text: 'GÖREV TAMAMLANDI · ÖDÜL YANDI (XP KİLİTLİ)', tone: 'danger' });
    }
  }

  if (result.streakExtended) {
    highlights.push({ text: `SERİ: ${result.state.player.streak.current} GÜN`, tone: 'gold' });
  }

  return {
    tone,
    icon,
    headline: result.xpLocked ? 'XP KİLİTLİ' : `+${result.totalXp} XP`,
    lines,
    highlights,
  };
}

export function buildErrorToast(message: string): LogToastContent {
  return { tone: 'danger', icon: 'alert-circle', headline: 'KAYIT BAŞARISIZ', lines: [message], highlights: [] };
}

/** Confirmation after marking / unmarking today as a rest or sick day. */
export function buildRestToast(kind: RestDayKind | null): LogToastContent {
  if (kind === null) {
    return {
      tone: 'neon',
      icon: 'refresh',
      headline: 'İŞARET KALDIRILDI',
      lines: ['Bugün normal gün. Görev tamamlanmazsa gün dönümünde Ceza Görevi açılır.'],
      highlights: [],
    };
  }
  return {
    tone: 'neon',
    icon: kind === 'sick' ? 'medkit' : 'bed',
    headline: REST_KIND_LABELS[kind].toLocaleUpperCase('tr-TR'),
    lines: ['Sistem bugünü işaretledi. Görev tamamlanmazsa ceza açılmaz, serin korunur.'],
    highlights: [],
  };
}
