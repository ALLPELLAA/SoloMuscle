import {
  GameRuleError,
  STAT_KEYS,
  type BaselineTest,
  type DayKey,
  type Player,
  type StatKey,
  type Stats,
} from './types';

export const STAT_MAX = 999;
export const INITIAL_STAT_MIN = 1;
export const INITIAL_STAT_MAX = 50;
export const DEFAULT_PLAYER_NAME = 'Oyuncu';
export const PLAYER_NAME_MAX = 20;

export const BASELINE_LIMITS: Record<keyof BaselineTest, { min: number; max: number; label: string }> = {
  pushups: { min: 0, max: 1000, label: 'Şınav' },
  situps: { min: 0, max: 1000, label: 'Mekik' },
  squats: { min: 0, max: 1000, label: 'Squat' },
  plankSeconds: { min: 0, max: 3600, label: 'Plank (sn)' },
};

const BASELINE_KEYS = Object.keys(BASELINE_LIMITS) as (keyof BaselineTest)[];

export function emptyStats(value = 0): Stats {
  return { strength: value, endurance: value, agility: value, vitality: value, flexibility: value };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Per-field Turkish error messages; empty object when valid. */
export function validateBaseline(test: BaselineTest): Partial<Record<keyof BaselineTest, string>> {
  const errors: Partial<Record<keyof BaselineTest, string>> = {};
  for (const key of BASELINE_KEYS) {
    const value = test[key];
    const { min, max, label } = BASELINE_LIMITS[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors[key] = `${label}: tam sayı gir.`;
    } else if (value < min || value > max) {
      errors[key] = `${label}: ${min}–${max} arasında olmalı.`;
    }
  }
  return errors;
}

export function assertValidBaseline(test: BaselineTest): void {
  const errors = validateBaseline(test);
  const first = Object.values(errors)[0];
  if (first) throw new GameRuleError('invalid_baseline', first);
}

/** Starting stats from the onboarding test (docs/GAME_DESIGN.md §2). */
export function initialStatsFromBaseline(test: BaselineTest): Stats {
  assertValidBaseline(test);
  const { pushups, situps, squats, plankSeconds } = test;
  const raw: Stats = {
    strength: 5 + 0.3 * pushups + 0.1 * squats,
    endurance: 5 + plankSeconds / 10 + 0.15 * situps,
    agility: 5 + 0.15 * squats + 0.1 * situps,
    vitality: 5 + 0.05 * (pushups + situps + squats) + plankSeconds / 30,
    flexibility: 5 + plankSeconds / 30,
  };
  const stats = emptyStats();
  for (const key of STAT_KEYS) {
    stats[key] = clamp(Math.round(raw[key]), INITIAL_STAT_MIN, INITIAL_STAT_MAX);
  }
  return stats;
}

export function normalizePlayerName(name: string): string {
  const trimmed = (name ?? '').trim().slice(0, PLAYER_NAME_MAX).trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PLAYER_NAME;
}

export function createPlayer(name: string, baseline: BaselineTest, today: DayKey): Player {
  return {
    name: normalizePlayerName(name),
    level: 1,
    xp: 0,
    totalXp: 0,
    rank: 'E',
    stats: initialStatsFromBaseline(baseline),
    statXp: emptyStats(),
    unspentPoints: 0,
    baseline: { ...baseline },
    createdDay: today,
    rankExamCooldownUntil: null,
  };
}

/** Stat XP needed for the next point of a stat currently at `value`: 20 + 5·value. */
export function statXpToNextPoint(value: number): number {
  return 20 + 5 * value;
}

export interface StatXpResult {
  stats: Stats;
  statXp: Stats;
  increases: Partial<Stats>;
}

/** Adds training XP to stats, converting it into stat points (docs §4). */
export function applyStatXp(stats: Stats, statXp: Stats, gains: Partial<Stats>): StatXpResult {
  const nextStats = { ...stats };
  const nextXp = { ...statXp };
  const increases: Partial<Stats> = {};
  for (const key of STAT_KEYS) {
    const gain = gains[key] ?? 0;
    if (gain <= 0) continue;
    nextXp[key] += gain;
    let need = statXpToNextPoint(nextStats[key]);
    while (nextStats[key] < STAT_MAX && nextXp[key] >= need) {
      nextXp[key] -= need;
      nextStats[key] += 1;
      increases[key] = (increases[key] ?? 0) + 1;
      need = statXpToNextPoint(nextStats[key]);
    }
  }
  return { stats: nextStats, statXp: nextXp, increases };
}

/** Returns a Turkish error message, or `null` if the allocation is valid. */
export function validateAllocation(player: Player, allocation: Partial<Stats>): string | null {
  let total = 0;
  for (const [key, value] of Object.entries(allocation)) {
    if (!STAT_KEYS.includes(key as StatKey)) return 'Bilinmeyen stat.';
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return 'Puanlar negatif olmayan tam sayı olmalı.';
    }
    if (player.stats[key as StatKey] + value > STAT_MAX) return `Stat en fazla ${STAT_MAX} olabilir.`;
    total += value;
  }
  if (total < 1) return 'En az 1 puan dağıt.';
  if (total > player.unspentPoints) return 'Yeterli stat puanın yok.';
  return null;
}

export function allocateStatPoints(player: Player, allocation: Partial<Stats>): Player {
  const error = validateAllocation(player, allocation);
  if (error) throw new GameRuleError('invalid_allocation', error);
  const stats = { ...player.stats };
  let spent = 0;
  for (const key of STAT_KEYS) {
    const value = allocation[key] ?? 0;
    stats[key] += value;
    spent += value;
  }
  return { ...player, stats, unspentPoints: player.unspentPoints - spent };
}

/** Lowest stat; ties broken by STAT_KEYS order. */
export function weakestStat(stats: Stats): StatKey {
  let weakest: StatKey = STAT_KEYS[0];
  for (const key of STAT_KEYS) {
    if (stats[key] < stats[weakest]) weakest = key;
  }
  return weakest;
}

export function sumStats(stats: Stats): number {
  return STAT_KEYS.reduce((acc, key) => acc + stats[key], 0);
}
