/** Personal records and "boss" fights (docs/GAME_DESIGN.md §10). */
import type {
  BaselineTest,
  DayKey,
  ExerciseEntry,
  ExerciseId,
  PersonalRecord,
  PersonalRecords,
} from './types';

/** Fixed boss name per exercise (original names). */
export const BOSS_NAMES: Record<ExerciseId, string> = {
  pushup: 'Demir Golem',
  situp: 'Çekirdek Yılanı',
  squat: 'Taş Dev',
  plank: 'Zaman Bekçisi',
  pullup: 'Gölge Tırmanıcı',
  lunge: 'İkiz Adımcı',
  burpee: 'Kaos İblisi',
  jumping_jack: 'Fırtına Kuklası',
  jump_rope: 'Ritim Hayaleti',
  run: 'Ufuk Avcısı',
  walk: 'Yol Ruhu',
  stretch: 'Bükülmez Heykel',
  yoga: 'Sessiz Lotus',
};

/** Bonus XP for beating a record: 30 + 10·level. */
export function recordBonusXp(level: number): number {
  return 30 + 10 * level;
}

/** Baseline/exam metric → exercise mapping. */
export const BASELINE_EXERCISES: readonly { key: keyof BaselineTest; exerciseId: ExerciseId }[] = [
  { key: 'pushups', exerciseId: 'pushup' },
  { key: 'situps', exerciseId: 'situp' },
  { key: 'squats', exerciseId: 'squat' },
  { key: 'plankSeconds', exerciseId: 'plank' },
];

/** Starting records from the onboarding test (only values > 0). */
export function initialRecordsFromBaseline(baseline: BaselineTest, dayKey: DayKey): PersonalRecords {
  const records: PersonalRecords = {};
  for (const { key, exerciseId } of BASELINE_EXERCISES) {
    const amount = baseline[key];
    if (amount > 0) records[exerciseId] = { amount, dayKey, source: 'baseline', bonusDay: null };
  }
  return records;
}

/**
 * Players created before records existed (schema v1) have no records: seed them from the
 * onboarding test (docs §10). Returns the same player when nothing changes.
 */
export function withBaselineRecords<P extends { records: PersonalRecords; baseline: BaselineTest; createdDay: DayKey }>(
  player: P,
): P {
  if (Object.keys(player.records).length > 0) return player;
  const records = initialRecordsFromBaseline(player.baseline, player.createdDay);
  return Object.keys(records).length > 0 ? { ...player, records } : player;
}

export interface RecordEvent {
  exerciseId: ExerciseId;
  bossName: string;
  /** Previous record amount (null when this set created the first record). */
  previous: number | null;
  amount: number;
  /** True when an existing record was beaten (boss defeated). */
  boss: boolean;
  bonusXp: number;
  /** True when a boss was defeated while XP was locked (bonus forfeited). */
  locked: boolean;
}

export interface RecordUpdate {
  records: PersonalRecords;
  event: RecordEvent | null;
}

/**
 * Checks a logged set against the record. `level` is the player's level at that moment,
 * `locked` whether XP is locked by an active penalty quest.
 */
export function applyRecord(
  records: PersonalRecords,
  entry: ExerciseEntry,
  today: DayKey,
  level: number,
  locked: boolean,
): RecordUpdate {
  const { exerciseId, amount } = entry;
  const current = records[exerciseId];
  const bossName = BOSS_NAMES[exerciseId];

  if (!current) {
    const record: PersonalRecord = { amount, dayKey: today, source: 'set', bonusDay: null };
    return {
      records: { ...records, [exerciseId]: record },
      event: { exerciseId, bossName, previous: null, amount, boss: false, bonusXp: 0, locked },
    };
  }

  if (amount <= current.amount) return { records, event: null };

  const bonusAllowed = !locked && current.bonusDay !== today;
  const bonusXp = bonusAllowed ? recordBonusXp(level) : 0;
  const record: PersonalRecord = {
    amount,
    dayKey: today,
    source: 'set',
    bonusDay: bonusAllowed ? today : current.bonusDay,
  };
  return {
    records: { ...records, [exerciseId]: record },
    event: { exerciseId, bossName, previous: current.amount, amount, boss: true, bonusXp, locked },
  };
}

/** Rank exam results raise records without boss/bonus. */
export function recordsFromExam(records: PersonalRecords, results: BaselineTest, today: DayKey): PersonalRecords {
  let next = records;
  for (const { key, exerciseId } of BASELINE_EXERCISES) {
    const amount = results[key];
    const current = next[exerciseId];
    if (amount > 0 && (!current || amount > current.amount)) {
      next = {
        ...next,
        [exerciseId]: { amount, dayKey: today, source: 'exam', bonusDay: current?.bonusDay ?? null },
      };
    }
  }
  return next;
}
