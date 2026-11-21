/**
 * Row ⇄ domain conversions. Pure (no expo-sqlite import) so they can be unit tested.
 */
import {
  RANKS,
  STAT_KEYS,
  isExerciseId,
  type BaselineTest,
  type DayKey,
  type ExerciseId,
  type Player,
  type Quest,
  type QuestKind,
  type QuestObjective,
  type QuestStatus,
  type Rank,
  type Stats,
} from '@/game';

export interface PlayerRow {
  id: number;
  name: string;
  level: number;
  xp: number;
  total_xp: number;
  rank: string;
  stats: string;
  stat_xp: string;
  unspent_points: number;
  baseline: string;
  created_day: string;
  rank_exam_cooldown_until: string | null;
  last_rollover_day: string;
  daily_quest_id: string | null;
  penalty_quest_id: string | null;
  updated_at: number;
}

export interface QuestRow {
  id: string;
  kind: string;
  day_key: string;
  title: string;
  objectives: string;
  reward_xp: number;
  awarded_xp: number;
  status: string;
  completed_at: number | null;
}

export interface ExerciseLogRow {
  id: number;
  session_id: number | null;
  exercise_id: string;
  amount: number;
  set_index: number;
  day_key: string;
  created_at: number;
  xp_awarded: number;
}

export interface ExerciseLog {
  id: number;
  sessionId: number | null;
  exerciseId: ExerciseId;
  amount: number;
  setIndex: number;
  dayKey: DayKey;
  createdAt: number;
  xpAwarded: number;
}

export interface WorkoutSessionRow {
  id: number;
  day_key: string;
  started_at: number;
  ended_at: number;
  total_xp: number;
  xp_locked: number;
  set_count?: number;
}

export interface WorkoutSessionSummary {
  id: number;
  dayKey: DayKey;
  startedAt: number;
  endedAt: number;
  totalXp: number;
  xpLocked: boolean;
  setCount: number;
}

export interface RankExamRow {
  id: number;
  target_rank: string;
  results: string;
  passed: number;
  day_key: string;
  taken_at: number;
}

export interface RankExamRecord {
  id: number;
  targetRank: Rank;
  results: BaselineTest;
  passed: boolean;
  dayKey: DayKey;
  takenAt: number;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    const value = JSON.parse(text) as unknown;
    return (value ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseStats(text: string): Stats {
  const raw = parseJson<Record<string, unknown>>(text, {});
  const stats = {} as Stats;
  for (const key of STAT_KEYS) stats[key] = toNumber(raw[key]);
  return stats;
}

export function parseBaseline(text: string): BaselineTest {
  const raw = parseJson<Record<string, unknown>>(text, {});
  return {
    pushups: toNumber(raw.pushups),
    situps: toNumber(raw.situps),
    squats: toNumber(raw.squats),
    plankSeconds: toNumber(raw.plankSeconds),
  };
}

export function parseRank(value: string): Rank {
  return (RANKS as readonly string[]).includes(value) ? (value as Rank) : 'E';
}

export function rowToPlayer(row: PlayerRow): Player {
  return {
    name: row.name,
    level: row.level,
    xp: row.xp,
    totalXp: row.total_xp,
    rank: parseRank(row.rank),
    stats: parseStats(row.stats),
    statXp: parseStats(row.stat_xp),
    unspentPoints: row.unspent_points,
    baseline: parseBaseline(row.baseline),
    createdDay: row.created_day,
    rankExamCooldownUntil: row.rank_exam_cooldown_until,
  };
}

/** Bind params for the `player` upsert, in column order (excluding id). */
export function playerToParams(
  player: Player,
  extra: { lastRolloverDay: DayKey; dailyQuestId: string | null; penaltyQuestId: string | null; updatedAt: number },
): (string | number | null)[] {
  return [
    player.name,
    player.level,
    player.xp,
    player.totalXp,
    player.rank,
    JSON.stringify(player.stats),
    JSON.stringify(player.statXp),
    player.unspentPoints,
    JSON.stringify(player.baseline),
    player.createdDay,
    player.rankExamCooldownUntil,
    extra.lastRolloverDay,
    extra.dailyQuestId,
    extra.penaltyQuestId,
    extra.updatedAt,
  ];
}

function parseObjectives(text: string): QuestObjective[] {
  const raw = parseJson<unknown[]>(text, []);
  if (!Array.isArray(raw)) return [];
  const objectives: QuestObjective[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.exerciseId !== 'string' || !isExerciseId(o.exerciseId)) continue;
    objectives.push({ exerciseId: o.exerciseId, target: toNumber(o.target, 1), progress: toNumber(o.progress) });
  }
  return objectives;
}

const QUEST_KINDS: readonly QuestKind[] = ['daily', 'penalty'];
const QUEST_STATUSES: readonly QuestStatus[] = ['active', 'completed', 'failed'];

export function rowToQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    kind: QUEST_KINDS.includes(row.kind as QuestKind) ? (row.kind as QuestKind) : 'daily',
    dayKey: row.day_key,
    title: row.title,
    objectives: parseObjectives(row.objectives),
    rewardXp: row.reward_xp,
    awardedXp: row.awarded_xp,
    status: QUEST_STATUSES.includes(row.status as QuestStatus) ? (row.status as QuestStatus) : 'failed',
    completedAt: row.completed_at,
  };
}

/** Bind params for the `quests` upsert, in column order. */
export function questToParams(quest: Quest): (string | number | null)[] {
  return [
    quest.id,
    quest.kind,
    quest.dayKey,
    quest.title,
    JSON.stringify(quest.objectives),
    quest.rewardXp,
    quest.awardedXp,
    quest.status,
    quest.completedAt,
  ];
}

export function rowToExerciseLog(row: ExerciseLogRow): ExerciseLog | null {
  if (!isExerciseId(row.exercise_id)) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    amount: row.amount,
    setIndex: row.set_index,
    dayKey: row.day_key,
    createdAt: row.created_at,
    xpAwarded: row.xp_awarded,
  };
}

export function rowToSession(row: WorkoutSessionRow): WorkoutSessionSummary {
  return {
    id: row.id,
    dayKey: row.day_key,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    totalXp: row.total_xp,
    xpLocked: row.xp_locked === 1,
    setCount: row.set_count ?? 0,
  };
}

export function rowToRankExam(row: RankExamRow): RankExamRecord {
  return {
    id: row.id,
    targetRank: parseRank(row.target_rank),
    results: parseBaseline(row.results),
    passed: row.passed === 1,
    dayKey: row.day_key,
    takenAt: row.taken_at,
  };
}
