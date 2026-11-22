/**
 * SQLite persistence. Contains no game rules: it stores what `src/game` computes.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { BaselineTest, DailyVolumeRow, DayKey, ExerciseEntry, ExerciseId, GameState, Quest, Rank, RestDayKind } from '@/game';

import {
  playerToParams,
  questToParams,
  rowToExerciseLog,
  rowToPlayer,
  rowToQuest,
  rowToRankExam,
  rowToRestDay,
  rowToSession,
  rowToSnapshot,
  rowsToLastSets,
  type ExerciseLog,
  type ExerciseLogRow,
  type LastSet,
  type LastSetRow,
  type PlayerRow,
  type QuestRow,
  type RankExamRecord,
  type RankExamRow,
  type RestDayRow,
  type StatSnapshot,
  type StatSnapshotRow,
  type WorkoutSessionRow,
  type WorkoutSessionSummary,
} from './mappers';

const UPSERT_PLAYER = `
  INSERT INTO player (
    id, name, level, xp, total_xp, rank, stats, stat_xp, unspent_points, baseline,
    created_day, rank_exam_cooldown_until, last_rollover_day, daily_quest_id, penalty_quest_id, updated_at,
    records, rpe, streak
  ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    updated_at = excluded.updated_at,
    records = excluded.records,
    rpe = excluded.rpe,
    streak = excluded.streak
`;

const UPSERT_SNAPSHOT = `
  INSERT INTO stat_snapshots (day_key, level, total_xp, stats) VALUES (?, ?, ?, ?)
  ON CONFLICT (day_key) DO UPDATE SET
    level = excluded.level,
    total_xp = excluded.total_xp,
    stats = excluded.stats
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
  const [dailyQuest, penaltyQuest, restRows] = await Promise.all([
    getQuest(db, row.daily_quest_id),
    getQuest(db, row.penalty_quest_id),
    db.getAllAsync<RestDayRow>('SELECT * FROM rest_days ORDER BY day_key ASC'),
  ]);
  return {
    player: rowToPlayer(row),
    dailyQuest,
    penaltyQuest,
    lastRolloverDay: row.last_rollover_day,
    restDays: restRows.map(rowToRestDay),
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
  // One snapshot per day: the last save of the day wins (stat charts, docs §14).
  await db.runAsync(
    UPSERT_SNAPSHOT,
    state.lastRolloverDay,
    state.player.level,
    state.player.totalXp,
    JSON.stringify(state.player.stats),
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
  /** Per entry: did it set a personal record? */
  entryRecord: boolean[];
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
        `INSERT INTO exercise_logs (session_id, exercise_id, amount, set_index, day_key, created_at, xp_awarded, rpe, is_record)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        entry.exerciseId,
        entry.amount,
        i,
        workout.dayKey,
        workout.endedAt,
        workout.entryXp[i] ?? 0,
        entry.rpe ?? null,
        workout.entryRecord[i] ? 1 : 0,
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

/** Stores today's rest-day mark (kind) or removes it (null) together with the new state. */
export async function saveRestDay(
  db: SQLiteDatabase,
  state: GameState,
  change: { dayKey: DayKey; kind: RestDayKind | null; now: number },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (change.kind) {
      await db.runAsync(
        'INSERT OR REPLACE INTO rest_days (day_key, kind, created_at) VALUES (?, ?, ?)',
        change.dayKey,
        change.kind,
        change.now,
      );
    } else {
      await db.runAsync('DELETE FROM rest_days WHERE day_key = ?', change.dayKey);
    }
    await writeState(db, state, [], change.now);
  });
}

/** Most recent set (amount + RPE) of every exercise, for auto-fill (docs §9). */
export async function getLastSets(db: SQLiteDatabase): Promise<Partial<Record<ExerciseId, LastSet>>> {
  const rows = await db.getAllAsync<LastSetRow>(
    `SELECT l.exercise_id AS exercise_id, l.amount AS amount, l.rpe AS rpe
     FROM (SELECT DISTINCT exercise_id FROM exercise_logs) e
     JOIN exercise_logs l ON l.id = (
       SELECT l2.id FROM exercise_logs l2
       WHERE l2.exercise_id = e.exercise_id
       ORDER BY l2.created_at DESC, l2.set_index DESC
       LIMIT 1
     )`,
  );
  return rowsToLastSets(rows);
}

/**
 * One row per logged set since `fromDay` (inclusive) for the heatmap. Not summed in SQL:
 * raw XP is rounded per set (docs §14: Σ round(amount·xpPerUnit)).
 */
export async function getDailyVolume(db: SQLiteDatabase, fromDay: DayKey): Promise<DailyVolumeRow[]> {
  return db.getAllAsync<DailyVolumeRow>(
    'SELECT day_key AS dayKey, exercise_id AS exerciseId, amount FROM exercise_logs WHERE day_key >= ?',
    fromDay,
  );
}

export async function listCompletedQuestDays(db: SQLiteDatabase, fromDay: DayKey): Promise<DayKey[]> {
  const rows = await db.getAllAsync<{ day_key: string }>(
    "SELECT day_key FROM quests WHERE kind = 'daily' AND status = 'completed' AND day_key >= ?",
    fromDay,
  );
  return rows.map((r) => r.day_key);
}

/** Last `limit` daily stat snapshots, oldest first. */
export async function listStatSnapshots(db: SQLiteDatabase, limit = 60): Promise<StatSnapshot[]> {
  const rows = await db.getAllAsync<StatSnapshotRow>(
    'SELECT * FROM stat_snapshots ORDER BY day_key DESC LIMIT ?',
    limit,
  );
  return rows.map(rowToSnapshot).reverse();
}

/** Sets that created or beat a personal record, newest first. */
export async function listRecordLogs(db: SQLiteDatabase, limit = 30): Promise<ExerciseLog[]> {
  const rows = await db.getAllAsync<ExerciseLogRow>(
    'SELECT * FROM exercise_logs WHERE is_record = 1 ORDER BY created_at DESC, set_index DESC LIMIT ?',
    limit,
  );
  return rows.map(rowToExerciseLog).filter((log): log is ExerciseLog => log !== null);
}

/** Deletes all progress (keeps the schema and settings). */
export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM exercise_logs;
      DELETE FROM workout_sessions;
      DELETE FROM rank_exams;
      DELETE FROM quests;
      DELETE FROM rest_days;
      DELETE FROM stat_snapshots;
      DELETE FROM player;
    `);
  });
}
