/**
 * SQLite persistence. Contains no game rules: it stores what `src/game` computes.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { BaselineTest, DayKey, ExerciseEntry, GameState, Quest, Rank } from '@/game';

import {
  playerToParams,
  questToParams,
  rowToExerciseLog,
  rowToPlayer,
  rowToQuest,
  rowToRankExam,
  rowToSession,
  type ExerciseLog,
  type ExerciseLogRow,
  type PlayerRow,
  type QuestRow,
  type RankExamRecord,
  type RankExamRow,
  type WorkoutSessionRow,
  type WorkoutSessionSummary,
} from './mappers';

const UPSERT_PLAYER = `
  INSERT INTO player (
    id, name, level, xp, total_xp, rank, stats, stat_xp, unspent_points, baseline,
    created_day, rank_exam_cooldown_until, last_rollover_day, daily_quest_id, penalty_quest_id, updated_at
  ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    level = excluded.level,
    xp = excluded.xp,
    total_xp = excluded.total_xp,
    rank = excluded.rank,
    stats = excluded.stats,
    stat_xp = excluded.stat_xp,
    unspent_points = excluded.unspent_points,
    baseline = excluded.baseline,
    created_day = excluded.created_day,
    rank_exam_cooldown_until = excluded.rank_exam_cooldown_until,
    last_rollover_day = excluded.last_rollover_day,
    daily_quest_id = excluded.daily_quest_id,
    penalty_quest_id = excluded.penalty_quest_id,
    updated_at = excluded.updated_at
`;

const UPSERT_QUEST = `
  INSERT INTO quests (id, kind, day_key, title, objectives, reward_xp, awarded_xp, status, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    kind = excluded.kind,
    day_key = excluded.day_key,
    title = excluded.title,
    objectives = excluded.objectives,
    reward_xp = excluded.reward_xp,
    awarded_xp = excluded.awarded_xp,
    status = excluded.status,
    completed_at = excluded.completed_at
`;

async function getQuest(db: SQLiteDatabase, id: string | null): Promise<Quest | null> {
  if (!id) return null;
  const row = await db.getFirstAsync<QuestRow>('SELECT * FROM quests WHERE id = ?', id);
  return row ? rowToQuest(row) : null;
}

export async function loadGameState(db: SQLiteDatabase): Promise<GameState | null> {
  const row = await db.getFirstAsync<PlayerRow>('SELECT * FROM player WHERE id = 1');
  if (!row) return null;
  const [dailyQuest, penaltyQuest] = await Promise.all([
    getQuest(db, row.daily_quest_id),
    getQuest(db, row.penalty_quest_id),
  ]);
  return {
    player: rowToPlayer(row),
    dailyQuest,
    penaltyQuest,
    lastRolloverDay: row.last_rollover_day,
  };
}

/** Writes player + current quests (+ archived quests). Call inside a transaction when combined. */
async function writeState(db: SQLiteDatabase, state: GameState, archived: Quest[], now: number): Promise<void> {
  for (const quest of archived) await db.runAsync(UPSERT_QUEST, questToParams(quest));
  if (state.dailyQuest) await db.runAsync(UPSERT_QUEST, questToParams(state.dailyQuest));
  if (state.penaltyQuest) await db.runAsync(UPSERT_QUEST, questToParams(state.penaltyQuest));
  await db.runAsync(
    UPSERT_PLAYER,
    playerToParams(state.player, {
      lastRolloverDay: state.lastRolloverDay,
      dailyQuestId: state.dailyQuest?.id ?? null,
      penaltyQuestId: state.penaltyQuest?.id ?? null,
      updatedAt: now,
    }),
  );
}

export async function saveGameState(
  db: SQLiteDatabase,
  state: GameState,
  options: { archived?: Quest[]; now: number },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await writeState(db, state, options.archived ?? [], options.now);
  });
}

export interface WorkoutRecord {
  dayKey: DayKey;
  startedAt: number;
  endedAt: number;
  entries: ExerciseEntry[];
  entryXp: number[];
  xpLocked: boolean;
}

/** Atomically stores a finished workout and the resulting game state. */
export async function saveWorkout(
  db: SQLiteDatabase,
  state: GameState,
  workout: WorkoutRecord,
): Promise<number> {
  let sessionId = 0;
  await db.withTransactionAsync(async () => {
    const totalXp = workout.entryXp.reduce((a, b) => a + b, 0);
    const session = await db.runAsync(
      'INSERT INTO workout_sessions (day_key, started_at, ended_at, total_xp, xp_locked) VALUES (?, ?, ?, ?, ?)',
      workout.dayKey,
      workout.startedAt,
      workout.endedAt,
      totalXp,
      workout.xpLocked ? 1 : 0,
    );
    sessionId = session.lastInsertRowId;
    for (let i = 0; i < workout.entries.length; i++) {
      const entry = workout.entries[i];
      await db.runAsync(
        `INSERT INTO exercise_logs (session_id, exercise_id, amount, set_index, day_key, created_at, xp_awarded)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        entry.exerciseId,
        entry.amount,
        i,
        workout.dayKey,
        workout.endedAt,
        workout.entryXp[i] ?? 0,
      );
    }
    await writeState(db, state, [], workout.endedAt);
  });
  return sessionId;
}

export async function saveRankExam(
  db: SQLiteDatabase,
  state: GameState,
  exam: { targetRank: Rank; results: BaselineTest; passed: boolean; dayKey: DayKey; takenAt: number },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO rank_exams (target_rank, results, passed, day_key, taken_at) VALUES (?, ?, ?, ?, ?)',
      exam.targetRank,
      JSON.stringify(exam.results),
      exam.passed ? 1 : 0,
      exam.dayKey,
      exam.takenAt,
    );
    await writeState(db, state, [], exam.takenAt);
  });
}

export async function listRecentSessions(db: SQLiteDatabase, limit = 20): Promise<WorkoutSessionSummary[]> {
  const rows = await db.getAllAsync<WorkoutSessionRow>(
    `SELECT s.*, (SELECT COUNT(*) FROM exercise_logs l WHERE l.session_id = s.id) AS set_count
     FROM workout_sessions s ORDER BY s.ended_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(rowToSession);
}

export async function listSessionLogs(db: SQLiteDatabase, sessionId: number): Promise<ExerciseLog[]> {
  const rows = await db.getAllAsync<ExerciseLogRow>(
    'SELECT * FROM exercise_logs WHERE session_id = ? ORDER BY set_index ASC',
    sessionId,
  );
  return rows.map(rowToExerciseLog).filter((log): log is ExerciseLog => log !== null);
}

export async function listLogsForDay(db: SQLiteDatabase, dayKey: DayKey): Promise<ExerciseLog[]> {
  const rows = await db.getAllAsync<ExerciseLogRow>(
    'SELECT * FROM exercise_logs WHERE day_key = ? ORDER BY created_at ASC, set_index ASC',
    dayKey,
  );
  return rows.map(rowToExerciseLog).filter((log): log is ExerciseLog => log !== null);
}

export async function listRankExams(db: SQLiteDatabase, limit = 20): Promise<RankExamRecord[]> {
  const rows = await db.getAllAsync<RankExamRow>('SELECT * FROM rank_exams ORDER BY taken_at DESC LIMIT ?', limit);
  return rows.map(rowToRankExam);
}

export async function listQuestHistory(db: SQLiteDatabase, limit = 30): Promise<Quest[]> {
  const rows = await db.getAllAsync<QuestRow>(
    'SELECT * FROM quests ORDER BY day_key DESC, kind DESC LIMIT ?',
    limit,
  );
  return rows.map(rowToQuest);
}

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

/** Deletes all progress (keeps the schema). */
export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM exercise_logs;
      DELETE FROM workout_sessions;
      DELETE FROM rank_exams;
      DELETE FROM quests;
      DELETE FROM player;
    `);
  });
}
