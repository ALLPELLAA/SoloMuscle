import { getExercise, primaryStat } from './exercises';
import { mulberry32, hashString, pickIndex } from './random';
import { rpeFactor } from './rpe';
import { weakestStat } from './stats';
import {
  STAT_LABELS,
  type DayKey,
  type ExerciseId,
  type ExerciseUnit,
  type Player,
  type Quest,
  type QuestObjective,
  type StatKey,
} from './types';

export const DAILY_QUEST_TITLE = 'Günlük Görev: Gelişim Protokolü';
export const PENALTY_QUEST_TITLE = 'CEZA GÖREVİ: Hayatta Kalma';

export const DAILY_CORE: readonly ExerciseId[] = ['pushup', 'situp', 'squat'];

export const FOCUS_POOLS: Record<StatKey, readonly ExerciseId[]> = {
  strength: ['lunge'],
  endurance: ['plank', 'run'],
  agility: ['burpee', 'jump_rope', 'jumping_jack'],
  vitality: ['walk', 'run'],
  flexibility: ['stretch', 'yoga'],
};

interface TargetSpec {
  base: number;
  max: number;
}

export const DAILY_TARGETS: Partial<Record<ExerciseId, TargetSpec>> = {
  pushup: { base: 10, max: 150 },
  situp: { base: 10, max: 150 },
  squat: { base: 15, max: 200 },
  lunge: { base: 12, max: 150 },
  plank: { base: 30, max: 600 },
  run: { base: 10, max: 60 },
  burpee: { base: 8, max: 100 },
  jump_rope: { base: 3, max: 30 },
  jumping_jack: { base: 30, max: 300 },
  walk: { base: 15, max: 90 },
  stretch: { base: 5, max: 30 },
  yoga: { base: 10, max: 45 },
};

export const PENALTY_OBJECTIVES: readonly { exerciseId: ExerciseId; base: number; max: number }[] = [
  { exerciseId: 'burpee', base: 20, max: 150 },
  { exerciseId: 'squat', base: 50, max: 300 },
  { exerciseId: 'plank', base: 120, max: 900 },
  { exerciseId: 'run', base: 15, max: 90 },
];

export function levelFactor(level: number): number {
  return 1 + 0.08 * (level - 1);
}

export function statFactor(statValue: number): number {
  return Math.min(3, Math.max(0.8, 0.6 + statValue / 25));
}

/** Unit-aware rounding from docs/GAME_DESIGN.md §5, clamped to [1, max]. */
export function roundTarget(raw: number, unit: ExerciseUnit, max: number): number {
  let value: number;
  if (unit === 'seconds') {
    value = Math.round(raw / 5) * 5;
  } else if (unit === 'reps' && raw >= 20) {
    value = Math.round(raw / 5) * 5;
  } else {
    value = Math.round(raw);
  }
  return Math.min(max, Math.max(1, value));
}

type TargetPlayer = Pick<Player, 'level' | 'stats'> & Partial<Pick<Player, 'rpe'>>;

export interface TargetBreakdown {
  exerciseId: ExerciseId;
  base: number;
  max: number;
  level: number;
  levelFactor: number;
  stat: StatKey;
  statValue: number;
  statFactor: number;
  /** RPE moving average, undefined when no RPE data. */
  rpe: number | undefined;
  rpeFactor: number;
  raw: number;
  target: number;
  capped: boolean;
}

/** All inputs of a daily target (docs/GAME_DESIGN.md §5, §11). */
export function dailyTargetBreakdown(exerciseId: ExerciseId, player: TargetPlayer): TargetBreakdown {
  const spec = DAILY_TARGETS[exerciseId];
  if (!spec) throw new Error(`No daily target for ${exerciseId}`);
  const stat = primaryStat(exerciseId);
  const statValue = player.stats[stat];
  const rpe = player.rpe?.[exerciseId];
  const lf = levelFactor(player.level);
  const sf = statFactor(statValue);
  const rf = rpeFactor(rpe);
  const raw = spec.base * lf * sf * rf;
  const target = roundTarget(raw, getExercise(exerciseId).unit, spec.max);
  return {
    exerciseId,
    base: spec.base,
    max: spec.max,
    level: player.level,
    levelFactor: lf,
    stat,
    statValue,
    statFactor: sf,
    rpe,
    rpeFactor: rf,
    raw,
    target,
    capped: target === spec.max && raw > spec.max,
  };
}

export function dailyTarget(exerciseId: ExerciseId, player: TargetPlayer): number {
  return dailyTargetBreakdown(exerciseId, player).target;
}

/** `1,16` — Turkish decimal comma with 2 decimals. */
export function formatFactor(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function formatRpe(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',');
}

/** System note explaining a daily target (§12). */
export function describeDailyTarget(b: TargetBreakdown): string {
  const parts = [
    `Taban ${b.base}`,
    `Lv ${b.level} ×${formatFactor(b.levelFactor)}`,
    `${STAT_LABELS[b.stat]} ${b.statValue} ×${formatFactor(b.statFactor)}`,
  ];
  if (b.rpe !== undefined) parts.push(`RPE ${formatRpe(b.rpe)} ×${formatFactor(b.rpeFactor)}`);
  return `${parts.join(' · ')} → ${b.target}${b.capped ? ' (üst sınır)' : ''}`;
}

export function dailyRewardXp(level: number): number {
  return 50 + 25 * level;
}

export function dailyQuestId(dayKey: DayKey): string {
  return `daily-${dayKey}`;
}

export function penaltyQuestId(dayKey: DayKey): string {
  return `penalty-${dayKey}`;
}

/** Focus exercise for the day: drawn from the weakest stat's pool with a seeded RNG. */
export function pickFocusExercise(player: Pick<Player, 'stats' | 'createdDay'>, dayKey: DayKey): ExerciseId {
  const pool = FOCUS_POOLS[weakestStat(player.stats)];
  // NOTE: the seed format is part of the spec (§5) — changing it changes everyone's quests.
  const rng = mulberry32(hashString(`${player.createdDay}|${dayKey}|daily`));
  return pool[pickIndex(rng, pool.length)];
}

export function generateDailyQuest(player: Player, dayKey: DayKey): Quest {
  const focus = pickFocusExercise(player, dayKey);
  const weakest = weakestStat(player.stats);
  const exerciseIds: ExerciseId[] = [...DAILY_CORE, focus];
  const objectives: QuestObjective[] = exerciseIds.map((exerciseId, index) => {
    const breakdown = dailyTargetBreakdown(exerciseId, player);
    const isFocus = index === DAILY_CORE.length;
    const prefix = isFocus ? `Odak: en zayıf statın ${STAT_LABELS[weakest]} (${player.stats[weakest]}). ` : '';
    return {
      exerciseId,
      target: breakdown.target,
      progress: 0,
      note: prefix + describeDailyTarget(breakdown),
    };
  });
  return {
    id: dailyQuestId(dayKey),
    kind: 'daily',
    dayKey,
    title: DAILY_QUEST_TITLE,
    objectives,
    rewardXp: dailyRewardXp(player.level),
    awardedXp: 0,
    status: 'active',
    completedAt: null,
  };
}

export function generatePenaltyQuest(player: Pick<Player, 'level'>, dayKey: DayKey): Quest {
  const lf = levelFactor(player.level);
  return {
    id: penaltyQuestId(dayKey),
    kind: 'penalty',
    dayKey,
    title: PENALTY_QUEST_TITLE,
    objectives: PENALTY_OBJECTIVES.map(({ exerciseId, base, max }) => {
      const raw = base * lf;
      const target = roundTarget(raw, getExercise(exerciseId).unit, max);
      const capped = target === max && raw > max;
      return {
        exerciseId,
        target,
        progress: 0,
        note: `Ceza: taban ${base} · Lv ${player.level} ×${formatFactor(lf)} → ${target}${capped ? ' (üst sınır)' : ''}`,
      };
    }),
    rewardXp: 0,
    awardedXp: 0,
    status: 'active',
    completedAt: null,
  };
}

export function isQuestComplete(quest: Pick<Quest, 'objectives'>): boolean {
  return quest.objectives.every((o) => o.progress >= o.target);
}

/** 0..1 overall completion (average of per-objective progress). */
export function questProgress(quest: Pick<Quest, 'objectives'>): number {
  if (quest.objectives.length === 0) return 1;
  const sum = quest.objectives.reduce((acc, o) => acc + Math.min(1, o.progress / o.target), 0);
  return sum / quest.objectives.length;
}

/**
 * Adds `amount` to every active objective matching `exerciseId` (capped at target).
 * Returns the same quest instance when nothing changed.
 */
export function addQuestProgress(quest: Quest, exerciseId: ExerciseId, amount: number): Quest {
  if (quest.status !== 'active') return quest;
  let changed = false;
  const objectives = quest.objectives.map((o) => {
    if (o.exerciseId !== exerciseId || o.progress >= o.target) return o;
    changed = true;
    return { ...o, progress: Math.min(o.target, o.progress + amount) };
  });
  return changed ? { ...quest, objectives } : quest;
}
