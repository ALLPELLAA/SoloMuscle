/// <reference types="jest" />
/**
 * Personal records & bosses — docs/GAME_DESIGN.md §10.
 * Expected values are derived by hand from the spec (arithmetic next to each value).
 */
import { EXERCISE_IDS } from './exercises';
import {
  BOSS_NAMES,
  applyRecord,
  initialRecordsFromBaseline,
  recordBonusXp,
  recordsFromExam,
} from './records';
import type { BaselineTest, DayKey, PersonalRecords } from './types';

const CREATED: DayKey = '2026-11-01';
const YESTERDAY: DayKey = '2026-11-20';
const TODAY: DayKey = '2026-11-21';

const BASELINE: BaselineTest = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };

function baselineRecords(): PersonalRecords {
  return {
    pushup: { amount: 15, dayKey: CREATED, source: 'baseline', bonusDay: null },
    situp: { amount: 20, dayKey: CREATED, source: 'baseline', bonusDay: null },
    squat: { amount: 25, dayKey: CREATED, source: 'baseline', bonusDay: null },
    plank: { amount: 45, dayKey: CREATED, source: 'baseline', bonusDay: null },
  };
}

describe('recordBonusXp (§10: 30 + 10·level)', () => {
  it.each([
    [1, 40], // 30 + 10
    [2, 50], // 30 + 20
    [7, 100], // 30 + 70
    [50, 530], // 30 + 500
  ])('level %i → %i XP', (level, expected) => {
    expect(recordBonusXp(level)).toBe(expected);
  });
});

describe('BOSS_NAMES', () => {
  it('Şınav boss is "Demir Golem"', () => {
    expect(BOSS_NAMES.pushup).toBe('Demir Golem');
  });

  it('every exercise has a fixed, non-empty, unique boss name', () => {
    const names = EXERCISE_IDS.map((id) => BOSS_NAMES[id]);
    for (const name of names) {
      expect(typeof name).toBe('string');
      expect(name.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(names).size).toBe(EXERCISE_IDS.length);
  });
});

describe('initialRecordsFromBaseline (onboarding records)', () => {
  it('creates baseline records for the four test movements', () => {
    expect(initialRecordsFromBaseline(BASELINE, CREATED)).toEqual(baselineRecords());
  });

  it('skips movements whose baseline value is 0', () => {
    const records = initialRecordsFromBaseline({ pushups: 0, situps: 3, squats: 0, plankSeconds: 0 }, CREATED);
    expect(records).toEqual({ situp: { amount: 3, dayKey: CREATED, source: 'baseline', bonusDay: null } });
  });

  it('all zeros → no records', () => {
    expect(initialRecordsFromBaseline({ pushups: 0, situps: 0, squats: 0, plankSeconds: 0 }, CREATED)).toEqual({});
  });
});

describe('applyRecord', () => {
  it('equal to the record is NOT a record (no event, records unchanged)', () => {
    const records = baselineRecords();
    const update = applyRecord(records, { exerciseId: 'pushup', amount: 15 }, TODAY, 3, false);
    expect(update.event).toBeNull();
    expect(update.records).toEqual(baselineRecords());
  });

  it('below the record → no event', () => {
    const update = applyRecord(baselineRecords(), { exerciseId: 'squat', amount: 10 }, TODAY, 3, false);
    expect(update.event).toBeNull();
    expect(update.records.squat).toEqual(baselineRecords().squat);
  });

  it('first set of an exercise becomes the first record: no boss, no bonus', () => {
    const update = applyRecord(baselineRecords(), { exerciseId: 'pullup', amount: 5 }, TODAY, 4, false);
    expect(update.records.pullup).toEqual({ amount: 5, dayKey: TODAY, source: 'set', bonusDay: null });
    expect(update.event).toMatchObject({ exerciseId: 'pullup', previous: null, amount: 5, boss: false, bonusXp: 0 });
  });

  it('beating a record → BOSS YENİLDİ with bonus 30 + 10·level and bonusDay = today', () => {
    const update = applyRecord(baselineRecords(), { exerciseId: 'pushup', amount: 16 }, TODAY, 3, false);
    expect(update.records.pushup).toEqual({ amount: 16, dayKey: TODAY, source: 'set', bonusDay: TODAY });
    expect(update.event).toEqual({
      exerciseId: 'pushup',
      bossName: 'Demir Golem',
      previous: 15,
      amount: 16,
      boss: true,
      bonusXp: 60, // 30 + 10·3
      locked: false,
    });
  });

  it('only one bonus per exercise per day: a second record the same day is saved, boss shown, bonus 0', () => {
    const first = applyRecord(baselineRecords(), { exerciseId: 'pushup', amount: 16 }, TODAY, 2, false);
    const second = applyRecord(first.records, { exerciseId: 'pushup', amount: 18 }, TODAY, 2, false);
    expect(second.records.pushup).toEqual({ amount: 18, dayKey: TODAY, source: 'set', bonusDay: TODAY });
    expect(second.event).toMatchObject({ boss: true, previous: 16, amount: 18, bonusXp: 0 });
  });

  it('the daily bonus limit is per exercise (another exercise still gets its bonus)', () => {
    const first = applyRecord(baselineRecords(), { exerciseId: 'pushup', amount: 16 }, TODAY, 2, false);
    const other = applyRecord(first.records, { exerciseId: 'situp', amount: 21 }, TODAY, 2, false);
    expect(other.event).toMatchObject({ exerciseId: 'situp', boss: true, bonusXp: 50 }); // 30 + 20
    expect(other.records.situp?.bonusDay).toBe(TODAY);
  });

  it('a bonus granted yesterday does not block today', () => {
    const records: PersonalRecords = {
      pushup: { amount: 30, dayKey: YESTERDAY, source: 'set', bonusDay: YESTERDAY },
    };
    const update = applyRecord(records, { exerciseId: 'pushup', amount: 31 }, TODAY, 1, false);
    expect(update.event).toMatchObject({ boss: true, bonusXp: 40 });
    expect(update.records.pushup?.bonusDay).toBe(TODAY);
  });

  it('a first record today does not consume the daily bonus', () => {
    const first = applyRecord({}, { exerciseId: 'burpee', amount: 10 }, TODAY, 1, false);
    const beaten = applyRecord(first.records, { exerciseId: 'burpee', amount: 11 }, TODAY, 1, false);
    expect(beaten.event).toMatchObject({ boss: true, previous: 10, bonusXp: 40 });
  });

  it('XP locked: record is still updated, bonus 0, bonusDay unchanged', () => {
    const records: PersonalRecords = {
      pushup: { amount: 15, dayKey: CREATED, source: 'baseline', bonusDay: '2026-11-10' },
    };
    const update = applyRecord(records, { exerciseId: 'pushup', amount: 20 }, TODAY, 5, true);
    expect(update.records.pushup).toEqual({ amount: 20, dayKey: TODAY, source: 'set', bonusDay: '2026-11-10' });
    expect(update.event).toMatchObject({ boss: true, bonusXp: 0, locked: true, previous: 15, amount: 20 });
  });

  it('XP locked does not consume the daily bonus: unlocked record later the same day gets it', () => {
    const locked = applyRecord(baselineRecords(), { exerciseId: 'pushup', amount: 20 }, TODAY, 1, true);
    expect(locked.records.pushup?.bonusDay).toBeNull();
    const unlocked = applyRecord(locked.records, { exerciseId: 'pushup', amount: 21 }, TODAY, 1, false);
    expect(unlocked.event).toMatchObject({ boss: true, bonusXp: 40 });
  });

  it('does not mutate its inputs', () => {
    const records = baselineRecords();
    const entry = { exerciseId: 'pushup' as const, amount: 40 };
    const snapshot = structuredClone(records);
    applyRecord(records, entry, TODAY, 3, false);
    applyRecord(records, { exerciseId: 'yoga', amount: 10 }, TODAY, 3, false);
    expect(records).toEqual(snapshot);
    expect(entry).toEqual({ exerciseId: 'pushup', amount: 40 });
  });
});

describe('recordsFromExam (source "exam", no boss/bonus)', () => {
  it('raises records for the four movements where the result is higher', () => {
    const next = recordsFromExam(
      baselineRecords(),
      { pushups: 22, situps: 20, squats: 10, plankSeconds: 90 },
      TODAY,
    );
    expect(next.pushup).toMatchObject({ amount: 22, dayKey: TODAY, source: 'exam' });
    // equal → unchanged
    expect(next.situp).toEqual(baselineRecords().situp);
    // lower → unchanged
    expect(next.squat).toEqual(baselineRecords().squat);
    expect(next.plank).toMatchObject({ amount: 90, dayKey: TODAY, source: 'exam' });
  });

  it('creates a record for a movement that had none', () => {
    const next = recordsFromExam({}, { pushups: 12, situps: 0, squats: 0, plankSeconds: 0 }, TODAY);
    expect(next.pushup).toMatchObject({ amount: 12, dayKey: TODAY, source: 'exam' });
  });

  it('does not touch other exercises nor mutate the input', () => {
    const records: PersonalRecords = {
      ...baselineRecords(),
      run: { amount: 30, dayKey: YESTERDAY, source: 'set', bonusDay: YESTERDAY },
    };
    const snapshot = structuredClone(records);
    const next = recordsFromExam(records, { pushups: 100, situps: 100, squats: 100, plankSeconds: 300 }, TODAY);
    expect(next.run).toEqual(snapshot.run);
    expect(records).toEqual(snapshot);
  });
});
