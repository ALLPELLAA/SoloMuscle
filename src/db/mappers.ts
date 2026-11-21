/**
 * Row ⇄ domain conversions. Pure (no expo-sqlite import) so they can be unit tested.
 */
import {
  RANKS,
  STAT_KEYS,
  isExerciseId,
  isValidRpe,
  type BaselineTest,
  type DayKey,
  type ExerciseId,
  type PersonalRecords,
  type Player,
  type Quest,
  type QuestKind,
  type QuestObjective,
  type QuestStatus,
  type Rank,
  type RecordSource,
  type RestDay,
  type RestDayKind,
  type Stats,
  type Streak,
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
  records: string;
  rpe: string;
  streak: string;
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
  rpe: number | null;
  is_record: number;
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
  rpe: number | null;
  isRecord: boolean;
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

const RECORD_SOURCES: readonly RecordSource[] = ['baseline', 'set', 'exam'];

export function parseRecords(text: string): PersonalRecords {
  const raw = parseJson<Record<string, unknown>>(text, {});
  const records: PersonalRecords = {};
  if (!raw || typeof raw !== 'object') return records;
  for (const [key, value] of Object.entries(raw)) {
    if (!isExerciseId(key) || !value || typeof value !== 'object') continue;
    const r = value as Record<string, unknown>;
    const amount = toNumber(r.amount, -1);
    if (amount <= 0 || typeof r.dayKey !== 'string') continue;
    records[key] = {
      amount,
      dayKey: r.dayKey,
      source: RECORD_SOURCES.includes(r.source as RecordSource) ? (r.source as RecordSource) : 'set',
      bonusDay: typeof r.bonusDay === 'string' ? r.bonusDay : null,
    };
  }
  return records;
}

export function parseRpeMap(text: string): Partial<Record<ExerciseId, number>> {
  const raw = parseJson<Record<string, unknown>>(text, {});
  const map: Partial<Record<ExerciseId, number>> = {};
  if (!raw || typeof raw !== 'object') return map;
  for (const [key, value] of Object.entries(raw)) {
    if (isExerciseId(key) && typeof value === 'number' && value >= 1 && value <= 10) map[key] = value;
  }
  return map;
}

export function parseStreak(text: string): Streak {
  const raw = parseJson<Record<string, unknown>>(text, {});
  const current = Math.max(0, Math.floor(toNumber(raw?.current)));
  const best = Math.max(current, Math.floor(toNumber(raw?.best)));
  return { current, best, lastCompletedDay: typeof raw?.lastCompletedDay === 'string' ? raw.lastCompletedDay : null };
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
    records: parseRecords(row.records ?? '{}'),
    rpe: parseRpeMap(row.rpe ?? '{}'),
    streak: parseStreak(row.streak ?? '{}'),
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
    JSON.stringify(player.records),
    JSON.stringify(player.rpe),
    JSON.stringify(player.streak),
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
    objectives.push({
      exerciseId: o.exerciseId,
      target: Math.max(1, toNumber(o.target, 1)),
      progress: toNumber(o.progress),
      note: typeof o.note === 'string' ? o.note : '',
    });
  }
  return objectives;
}

const QUEST_KINDS: readonly QuestKind[] = ['daily', 'penalty'];
const QUEST_STATUSES: readonly QuestStatus[] = ['active', 'completed', 'failed', 'excused'];

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
    rpe: isValidRpe(row.rpe) ? row.rpe : null,
    isRecord: row.is_record === 1,
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

export interface RestDayRow {
  day_key: string;
  kind: string;
  created_at: number;
}

export function rowToRestDay(row: RestDayRow): RestDay {
  const kind: RestDayKind = row.kind === 'sick' ? 'sick' : 'rest';
  return { dayKey: row.day_key, kind };
}

export interface StatSnapshotRow {
  day_key: string;
  level: number;
  total_xp: number;
  stats: string;
}

export interface StatSnapshot {
  dayKey: DayKey;
  level: number;
  totalXp: number;
  stats: Stats;
}

export function rowToSnapshot(row: StatSnapshotRow): StatSnapshot {
  return { dayKey: row.day_key, level: row.level, totalXp: row.total_xp, stats: parseStats(row.stats) };
}

export interface LastSetRow {
  exercise_id: string;
  amount: number;
  rpe: number | null;
}

export interface LastSet {
  amount: number;
  rpe: number | null;
}

export function rowsToLastSets(rows: readonly LastSetRow[]): Partial<Record<ExerciseId, LastSet>> {
  const map: Partial<Record<ExerciseId, LastSet>> = {};
  for (const row of rows) {
    if (!isExerciseId(row.exercise_id) || map[row.exercise_id]) continue;
    map[row.exercise_id] = { amount: row.amount, rpe: isValidRpe(row.rpe) ? row.rpe : null };
  }
  return map;
}
