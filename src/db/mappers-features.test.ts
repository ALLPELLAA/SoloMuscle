/// <reference types="jest" />
/**
 * Mappers for the §10–§14 columns/tables: records, RPE, streak, rest days,
 * stat snapshots and last sets. Parsing must be defensive against corrupt rows.
 */
import type { Player } from '@/game';

import {
  parseRecords,
  parseRpeMap,
  parseStreak,
  playerToParams,
  rowToExerciseLog,
  rowToPlayer,
  rowToQuest,
  rowToRestDay,
  rowToSnapshot,
  rowsToLastSets,
  type ExerciseLogRow,
  type LastSetRow,
  type PlayerRow,
  type QuestRow,
} from './mappers';

const CORRUPT = ['{not json', '', 'null', '42', '"text"', '[]', 'true'];

function playerRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: 1,
    name: 'Avcı',
    level: 4,
    xp: 10,
    total_xp: 920,
    rank: 'E',
    stats: JSON.stringify({ strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 }),
    stat_xp: JSON.stringify({ strength: 1, endurance: 2, agility: 3, vitality: 4, flexibility: 5 }),
    unspent_points: 0,
    baseline: JSON.stringify({ pushups: 15, situps: 20, squats: 25, plankSeconds: 45 }),
    created_day: '2026-11-01',
    rank_exam_cooldown_until: null,
    last_rollover_day: '2026-11-21',
    daily_quest_id: 'daily-2026-11-21',
    penalty_quest_id: null,
    updated_at: 1,
    records: JSON.stringify({
      pushup: { amount: 22, dayKey: '2026-11-20', source: 'set', bonusDay: '2026-11-20' },
      plank: { amount: 45, dayKey: '2026-11-01', source: 'baseline', bonusDay: null },
      squat: { amount: 31, dayKey: '2026-11-21', source: 'exam', bonusDay: null },
    }),
    rpe: JSON.stringify({ pushup: 7.51, squat: 5 }),
    streak: JSON.stringify({ current: 3, best: 9, lastCompletedDay: '2026-11-20' }),
    ...overrides,
  };
}

describe('parseRecords', () => {
  it('parses valid records', () => {
    expect(parseRecords(playerRow().records)).toEqual({
      pushup: { amount: 22, dayKey: '2026-11-20', source: 'set', bonusDay: '2026-11-20' },
      plank: { amount: 45, dayKey: '2026-11-01', source: 'baseline', bonusDay: null },
      squat: { amount: 31, dayKey: '2026-11-21', source: 'exam', bonusDay: null },
    });
  });

  it.each(CORRUPT)('corrupt/non-object JSON %p → {}', (text) => {
    expect(parseRecords(text)).toEqual({});
  });

  it('drops invalid entries and normalises fields', () => {
    const text = JSON.stringify({
      teleport: { amount: 5, dayKey: '2026-11-20', source: 'set', bonusDay: null }, // unknown exercise
      pushup: { amount: 0, dayKey: '2026-11-20', source: 'set' }, // amount ≤ 0
      situp: { amount: -3, dayKey: '2026-11-20', source: 'set' }, // negative
      squat: { amount: '30', dayKey: '2026-11-20', source: 'set' }, // non-number
      plank: { amount: 60 }, // missing dayKey
      run: 'garbage', // not an object
      walk: null,
      burpee: { amount: 12, dayKey: '2026-11-19', source: 'hack', bonusDay: 7 }, // bad source + bonusDay
      yoga: { amount: 20, dayKey: '2026-11-18' }, // missing source / bonusDay
    });
    expect(parseRecords(text)).toEqual({
      burpee: { amount: 12, dayKey: '2026-11-19', source: 'set', bonusDay: null },
      yoga: { amount: 20, dayKey: '2026-11-18', source: 'set', bonusDay: null },
    });
  });
});

describe('parseRpeMap', () => {
  it('parses averages (2-decimal values allowed)', () => {
    expect(parseRpeMap(JSON.stringify({ pushup: 7.51, squat: 5, plank: 1, run: 10 }))).toEqual({
      pushup: 7.51,
      squat: 5,
      plank: 1,
      run: 10,
    });
  });

  it.each(CORRUPT)('corrupt/non-object JSON %p → {}', (text) => {
    expect(parseRpeMap(text)).toEqual({});
  });

  it('drops out-of-range, non-number and unknown entries', () => {
    expect(
      parseRpeMap(JSON.stringify({ pushup: 0, situp: 11, squat: '7', plank: null, teleport: 5, yoga: 6.2 })),
    ).toEqual({ yoga: 6.2 });
  });
});

describe('parseStreak', () => {
  it('parses a valid streak', () => {
    expect(parseStreak(playerRow().streak)).toEqual({ current: 3, best: 9, lastCompletedDay: '2026-11-20' });
  });

  it.each(CORRUPT)('corrupt/non-object JSON %p → empty streak', (text) => {
    expect(parseStreak(text)).toEqual({ current: 0, best: 0, lastCompletedDay: null });
  });

  it('normalises invalid values', () => {
    expect(parseStreak(JSON.stringify({ current: -2, best: 'x', lastCompletedDay: 5 }))).toEqual({
      current: 0,
      best: 0,
      lastCompletedDay: null,
    });
    // best can never be lower than current; fractions are floored
    expect(parseStreak(JSON.stringify({ current: 4.7, best: 2, lastCompletedDay: '2026-11-20' }))).toEqual({
      current: 4,
      best: 4,
      lastCompletedDay: '2026-11-20',
    });
  });
});

describe('rowToPlayer / playerToParams (records, rpe, streak)', () => {
  it('reads the new columns', () => {
    const player = rowToPlayer(playerRow());
    expect(player.records.pushup).toEqual({ amount: 22, dayKey: '2026-11-20', source: 'set', bonusDay: '2026-11-20' });
    expect(player.rpe).toEqual({ pushup: 7.51, squat: 5 });
    expect(player.streak).toEqual({ current: 3, best: 9, lastCompletedDay: '2026-11-20' });
  });

  it('corrupt new columns fall back to defaults', () => {
    const player = rowToPlayer(playerRow({ records: '{oops', rpe: 'nope', streak: '' }));
    expect(player.records).toEqual({});
    expect(player.rpe).toEqual({});
    expect(player.streak).toEqual({ current: 0, best: 0, lastCompletedDay: null });
    expect(player.stats.strength).toBe(12);
  });

  it('migration defaults parse to empty values', () => {
    const player = rowToPlayer(
      playerRow({ records: '{}', rpe: '{}', streak: '{"current":0,"best":0,"lastCompletedDay":null}' }),
    );
    expect(player.records).toEqual({});
    expect(player.rpe).toEqual({});
    expect(player.streak).toEqual({ current: 0, best: 0, lastCompletedDay: null });
  });

  it('records, rpe and streak are the last three params and round-trip losslessly', () => {
    const player: Player = rowToPlayer(playerRow());
    const params = playerToParams(player, {
      lastRolloverDay: '2026-11-21',
      dailyQuestId: 'daily-2026-11-21',
      penaltyQuestId: null,
      updatedAt: 99,
    });
    const [records, rpe, streak] = params.slice(-3) as string[];
    expect(JSON.parse(records)).toEqual(player.records);
    expect(JSON.parse(rpe)).toEqual(player.rpe);
    expect(JSON.parse(streak)).toEqual(player.streak);
    const again = rowToPlayer(playerRow({ records, rpe, streak }));
    expect(again).toEqual(player);
  });
});

describe('rowToExerciseLog (rpe, is_record)', () => {
  const row = (overrides: Partial<ExerciseLogRow> = {}): ExerciseLogRow => ({
    id: 7,
    session_id: 3,
    exercise_id: 'pushup',
    amount: 20,
    set_index: 0,
    day_key: '2026-11-21',
    created_at: 1000,
    xp_awarded: 70,
    rpe: 8,
    is_record: 1,
    ...overrides,
  });

  it('maps rpe and is_record', () => {
    expect(rowToExerciseLog(row())).toMatchObject({ rpe: 8, isRecord: true, xpAwarded: 70 });
    expect(rowToExerciseLog(row({ rpe: null, is_record: 0 }))).toMatchObject({ rpe: null, isRecord: false });
  });

  it.each([0, 11, 7.5, -1])('invalid stored rpe %p → null', (rpe) => {
    expect(rowToExerciseLog(row({ rpe }))?.rpe).toBeNull();
  });

  it('unknown exercise → null', () => {
    expect(rowToExerciseLog(row({ exercise_id: 'teleport' }))).toBeNull();
  });
});

describe('rowToRestDay', () => {
  it('maps rest and sick', () => {
    expect(rowToRestDay({ day_key: '2026-11-20', kind: 'rest', created_at: 1 })).toEqual({
      dayKey: '2026-11-20',
      kind: 'rest',
    });
    expect(rowToRestDay({ day_key: '2026-11-21', kind: 'sick', created_at: 2 })).toEqual({
      dayKey: '2026-11-21',
      kind: 'sick',
    });
  });

  it('unknown kind falls back to rest', () => {
    expect(rowToRestDay({ day_key: '2026-11-21', kind: 'vacation', created_at: 2 }).kind).toBe('rest');
  });
});

describe('rowToSnapshot', () => {
  it('maps a snapshot row', () => {
    expect(
      rowToSnapshot({
        day_key: '2026-11-21',
        level: 4,
        total_xp: 920,
        stats: JSON.stringify({ strength: 14, endurance: 13, agility: 11, vitality: 10, flexibility: 7 }),
      }),
    ).toEqual({
      dayKey: '2026-11-21',
      level: 4,
      totalXp: 920,
      stats: { strength: 14, endurance: 13, agility: 11, vitality: 10, flexibility: 7 },
    });
  });

  it('corrupt stats → zeros', () => {
    expect(rowToSnapshot({ day_key: '2026-11-21', level: 1, total_xp: 0, stats: '{bad' }).stats).toEqual({
      strength: 0,
      endurance: 0,
      agility: 0,
      vitality: 0,
      flexibility: 0,
    });
  });
});

describe('rowsToLastSets', () => {
  it('first row per exercise wins; invalid rpe → null; unknown exercise skipped', () => {
    const rows: LastSetRow[] = [
      { exercise_id: 'pushup', amount: 20, rpe: 8 },
      { exercise_id: 'pushup', amount: 5, rpe: 3 },
      { exercise_id: 'plank', amount: 60, rpe: null },
      { exercise_id: 'squat', amount: 30, rpe: 12 },
      { exercise_id: 'teleport', amount: 1, rpe: 5 },
    ];
    expect(rowsToLastSets(rows)).toEqual({
      pushup: { amount: 20, rpe: 8 },
      plank: { amount: 60, rpe: null },
      squat: { amount: 30, rpe: null },
    });
  });

  it('empty → {} and the input is not mutated', () => {
    expect(rowsToLastSets([])).toEqual({});
    const rows: LastSetRow[] = [{ exercise_id: 'run', amount: 10, rpe: 6 }];
    const snapshot = structuredClone(rows);
    rowsToLastSets(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe('rowToQuest (excused status, notes)', () => {
  const row = (overrides: Partial<QuestRow> = {}): QuestRow => ({
    id: 'daily-2026-11-20',
    kind: 'daily',
    day_key: '2026-11-20',
    title: 'Günlük Görev: Gelişim Protokolü',
    objectives: JSON.stringify([
      { exerciseId: 'pushup', target: 11, progress: 4, note: 'Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 → 11' },
      { exerciseId: 'situp', target: 11, progress: 0 },
    ]),
    reward_xp: 75,
    awarded_xp: 0,
    status: 'excused',
    completed_at: null,
    ...overrides,
  });

  it('keeps the excused status', () => {
    expect(rowToQuest(row()).status).toBe('excused');
  });

  it('keeps notes; a missing note becomes an empty string', () => {
    const quest = rowToQuest(row());
    expect(quest.objectives.map((o) => o.note)).toEqual(['Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 → 11', '']);
  });
});
