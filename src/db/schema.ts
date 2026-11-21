import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'solomuscle.db';

/**
 * Ordered migrations. Index + 1 = schema version stored in `PRAGMA user_version`.
 * Never edit a shipped migration — append a new one.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS player (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    xp INTEGER NOT NULL,
    total_xp INTEGER NOT NULL,
    rank TEXT NOT NULL,
    stats TEXT NOT NULL,
    stat_xp TEXT NOT NULL,
    unspent_points INTEGER NOT NULL,
    baseline TEXT NOT NULL,
    created_day TEXT NOT NULL,
    rank_exam_cooldown_until TEXT,
    last_rollover_day TEXT NOT NULL,
    daily_quest_id TEXT,
    penalty_quest_id TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    day_key TEXT NOT NULL,
    title TEXT NOT NULL,
    objectives TEXT NOT NULL,
    reward_xp INTEGER NOT NULL,
    awarded_xp INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    completed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_quests_day ON quests (day_key);

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_key TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    total_xp INTEGER NOT NULL,
    xp_locked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exercise_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES workout_sessions (id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    set_index INTEGER NOT NULL,
    day_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    xp_awarded INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_exercise_logs_day ON exercise_logs (day_key);
  CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON exercise_logs (session_id);

  CREATE TABLE IF NOT EXISTS rank_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_rank TEXT NOT NULL,
    results TEXT NOT NULL,
    passed INTEGER NOT NULL,
    day_key TEXT NOT NULL,
    taken_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // 2 — personal records, RPE, streak, rest days, stat snapshots (docs §10–§14)
  `
  ALTER TABLE player ADD COLUMN records TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE player ADD COLUMN rpe TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE player ADD COLUMN streak TEXT NOT NULL DEFAULT '{"current":0,"best":0,"lastCompletedDay":null}';

  ALTER TABLE exercise_logs ADD COLUMN rpe INTEGER;
  ALTER TABLE exercise_logs ADD COLUMN is_record INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise ON exercise_logs (exercise_id, created_at);

  CREATE TABLE IF NOT EXISTS rest_days (
    day_key TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stat_snapshots (
    day_key TEXT PRIMARY KEY NOT NULL,
    level INTEGER NOT NULL,
    total_xp INTEGER NOT NULL,
    stats TEXT NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Runs pending migrations. Pass as `onInit` to `<SQLiteProvider>`. */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version > SCHEMA_VERSION) {
    throw new Error(`Veritabanı sürümü (${version}) uygulamadan yeni (${SCHEMA_VERSION}).`);
  }
  while (version < SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    const nextVersion = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration);
      await db.execAsync(`PRAGMA user_version = ${nextVersion}`);
    });
    version = nextVersion;
  }
}
