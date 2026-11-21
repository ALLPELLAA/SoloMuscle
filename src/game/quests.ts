import { getExercise, primaryStat } from './exercises';
import { mulberry32, hashString, pickIndex } from './random';
import { weakestStat } from './stats';
import type { DayKey, ExerciseId, ExerciseUnit, Player, Quest, QuestObjective, StatKey } from './types';

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

export function dailyTarget(exerciseId: ExerciseId, player: Pick<Player, 'level' | 'stats'>): number {
  const spec = DAILY_TARGETS[exerciseId];
  if (!spec) throw new Error(`No daily target for ${exerciseId}`);
  const s = player.stats[primaryStat(exerciseId)];
  const raw = spec.base * levelFactor(player.level) * statFactor(s);
  return roundTarget(raw, getExercise(exerciseId).unit, spec.max);
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
  const rng = mulberry32(hashString(`${player.createdDay}|${dayKey}|daily`));
  return pool[pickIndex(rng, pool.length)];
}

export function generateDailyQuest(player: Player, dayKey: DayKey): Quest {
  const exerciseIds: ExerciseId[] = [...DAILY_CORE, pickFocusExercise(player, dayKey)];
  const objectives: QuestObjective[] = exerciseIds.map((exerciseId) => ({
    exerciseId,
    target: dailyTarget(exerciseId, player),
    progress: 0,
  }));
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
    objectives: PENALTY_OBJECTIVES.map(({ exerciseId, base, max }) => ({
      exerciseId,
      target: roundTarget(base * lf, getExercise(exerciseId).unit, max),
      progress: 0,
    })),
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
