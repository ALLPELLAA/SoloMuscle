/// <reference types="jest" />
/**
 * Tests for docs/GAME_DESIGN.md §10–§14 (records/boss, RPE, notes, rest days/streak, heatmap).
 * Expected values are computed by hand from the spec.
 */
import { buildHeatmap, quantile, rawXpByDay, weekdayIndex } from './activity';
import { addDays } from './date';
import { applyExerciseLogs, createInitialState, rolloverDay, submitRankExam } from './engine';
import { dailyTargetBreakdown, describeDailyTarget, generateDailyQuest, generatePenaltyQuest } from './quests';
import {
  applyRecord,
  initialRecordsFromBaseline,
  recordBonusXp,
  recordsFromExam,
  withBaselineRecords,
} from './records';
import { buildReminderPlan } from './reminders';
import {
  REST_DAY_LIMIT,
  extendStreak,
  getRestDayEligibility,
  markRestDay,
  restDaysInWindow,
  unmarkRestDay,
} from './rest-days';
import { rpeFactor, updateRpeAverage } from './rpe';
import { GameRuleError, type GameState, type Player } from './types';

const BASELINE = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };
const DAY0 = '2026-03-02'; // a Monday

function fresh(): GameState {
  return createInitialState('Test', BASELINE, DAY0);
}

function withPlayer(state: GameState, patch: Partial<Player>): GameState {
  return { ...state, player: { ...state.player, ...patch } };
}

describe('§10 personal records & boss', () => {
  test('onboarding seeds records for the four baseline exercises (only > 0)', () => {
    expect(initialRecordsFromBaseline({ pushups: 15, situps: 0, squats: 25, plankSeconds: 45 }, DAY0)).toEqual({
      pushup: { amount: 15, dayKey: DAY0, source: 'baseline', bonusDay: null },
      squat: { amount: 25, dayKey: DAY0, source: 'baseline', bonusDay: null },
      plank: { amount: 45, dayKey: DAY0, source: 'baseline', bonusDay: null },
    });
    expect(fresh().player.records.pushup?.amount).toBe(15);
  });

  test('recordBonusXp = 30 + 10·level', () => {
    expect(recordBonusXp(1)).toBe(40);
    expect(recordBonusXp(7)).toBe(100);
  });

  test('first set of an exercise creates a record without boss or bonus', () => {
    const { records, event } = applyRecord({}, { exerciseId: 'burpee', amount: 12 }, DAY0, 3, false);
    expect(records.burpee).toEqual({ amount: 12, dayKey: DAY0, source: 'set', bonusDay: null });
    expect(event).toMatchObject({ boss: false, bonusXp: 0, previous: null, bossName: 'Kaos İblisi' });
  });

  test('equal amount is not a record; higher amount defeats the boss once per day', () => {
    const base = initialRecordsFromBaseline(BASELINE, DAY0);
    expect(applyRecord(base, { exerciseId: 'pushup', amount: 15 }, DAY0, 1, false).event).toBeNull();
    const first = applyRecord(base, { exerciseId: 'pushup', amount: 16 }, DAY0, 2, false);
    expect(first.event).toMatchObject({ boss: true, previous: 15, amount: 16, bonusXp: 50, bossName: 'Demir Golem' });
    expect(first.records.pushup).toEqual({ amount: 16, dayKey: DAY0, source: 'set', bonusDay: DAY0 });
    const second = applyRecord(first.records, { exerciseId: 'pushup', amount: 18 }, DAY0, 2, false);
    expect(second.event).toMatchObject({ boss: true, previous: 16, amount: 18, bonusXp: 0 });
    expect(second.records.pushup?.amount).toBe(18);
    const nextDay = applyRecord(second.records, { exerciseId: 'pushup', amount: 19 }, addDays(DAY0, 1), 2, false);
    expect(nextDay.event?.bonusXp).toBe(50);
  });

  test('locked XP: record updates, bonus 0, bonusDay unchanged', () => {
    const base = initialRecordsFromBaseline(BASELINE, DAY0);
    const r = applyRecord(base, { exerciseId: 'pushup', amount: 30 }, DAY0, 4, true);
    expect(r.event).toMatchObject({ boss: true, bonusXp: 0, locked: true });
    expect(r.records.pushup).toEqual({ amount: 30, dayKey: DAY0, source: 'set', bonusDay: null });
  });

  test('engine grants boss bonus with the level after the set XP and reports per-entry flags', () => {
    // 100 push-ups = 100 XP → exactly level 2 (needs 100), then bonus 30 + 10·2 = 50.
    const result = applyExerciseLogs(fresh(), [{ exerciseId: 'pushup', amount: 100 }], 1000);
    expect(result.exerciseXp).toBe(100);
    expect(result.recordBonusXp).toBe(50);
    expect(result.entryXp).toEqual([150]);
    expect(result.entryRecord).toEqual([true]);
    expect(result.recordEvents).toHaveLength(1);
    expect(result.state.player.level).toBe(2);
    expect(result.state.player.xp).toBe(50);
    expect(result.totalXp).toBe(150);
  });

  test('exam results raise records without bonus', () => {
    const base = initialRecordsFromBaseline({ ...BASELINE, situps: 0 }, DAY0); // no sit-up record yet
    const next = recordsFromExam(base, { pushups: 20, situps: 10, squats: 25, plankSeconds: 60 }, '2026-04-01');
    expect(next.pushup).toEqual({ amount: 20, dayKey: '2026-04-01', source: 'exam', bonusDay: null });
    expect(next.situp).toEqual({ amount: 10, dayKey: '2026-04-01', source: 'exam', bonusDay: null });
    expect(next.squat).toBe(base.squat);
    expect(next.plank?.amount).toBe(60);
  });

  test('submitRankExam stores exam records even on failure', () => {
    const state = withPlayer(fresh(), { level: 5 });
    const result = submitRankExam(state, { pushups: 40, situps: 1, squats: 1, plankSeconds: 1 }, DAY0);
    expect(result.evaluation.passed).toBe(false);
    expect(result.state.player.records.pushup?.amount).toBe(40);
  });
});

describe('§11 RPE', () => {
  test('moving average and factor', () => {
    expect(updateRpeAverage(undefined, 9)).toBe(9);
    expect(updateRpeAverage(9, 5)).toBe(7.8); // 0.7·9 + 0.3·5
    expect(rpeFactor(undefined)).toBe(1);
    expect(rpeFactor(7)).toBe(1);
    expect(rpeFactor(5)).toBeCloseTo(1.1);
    expect(rpeFactor(10)).toBeCloseTo(0.85);
    expect(rpeFactor(1)).toBe(1.2);
  });

  test('logged RPE updates the average even when XP is locked', () => {
    const locked = { ...fresh(), penaltyQuest: generatePenaltyQuest({ level: 1 }, DAY0) };
    const result = applyExerciseLogs(locked, [{ exerciseId: 'squat', amount: 10, rpe: 4 }], 1);
    expect(result.totalXp).toBe(0);
    expect(result.state.player.rpe.squat).toBe(4);
  });

  test('invalid RPE throws and applies nothing', () => {
    expect(() => applyExerciseLogs(fresh(), [{ exerciseId: 'squat', amount: 10, rpe: 11 }], 1)).toThrow(GameRuleError);
    expect(() => applyExerciseLogs(fresh(), [{ exerciseId: 'squat', amount: 10, rpe: 2.5 }], 1)).toThrow(GameRuleError);
  });

  test('easy RPE raises the next daily target, hard RPE lowers it', () => {
    const player = fresh().player; // level 1, strength 12
    // pushup: 10 · 1 · (0.6 + 12/25 = 1.08) = 10.8 → 11
    expect(dailyTargetBreakdown('pushup', player).target).toBe(11);
    // RPE 3 → factor 1.2: 10.8 · 1.2 = 12.96 → 13
    expect(dailyTargetBreakdown('pushup', { ...player, rpe: { pushup: 3 } }).target).toBe(13);
    // RPE 10 → factor 0.85: 10.8 · 0.85 = 9.18 → 9
    expect(dailyTargetBreakdown('pushup', { ...player, rpe: { pushup: 10 } }).target).toBe(9);
  });
});

describe('§12 objective notes', () => {
  test('daily notes explain the number', () => {
    const player = fresh().player;
    expect(describeDailyTarget(dailyTargetBreakdown('pushup', player))).toBe(
      'Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 → 11',
    );
    expect(describeDailyTarget(dailyTargetBreakdown('pushup', { ...player, rpe: { pushup: 8.4 } }))).toBe(
      'Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 · RPE 8,4 ×0,93 → 10',
    );
    const capped = dailyTargetBreakdown('pushup', { ...player, level: 60, stats: { ...player.stats, strength: 80 } });
    expect(describeDailyTarget(capped).endsWith('→ 150 (üst sınır)')).toBe(true);
  });

  test('every generated objective has a note; focus objective names the weakest stat', () => {
    const quest = generateDailyQuest(fresh().player, DAY0);
    expect(quest.objectives.every((o) => o.note.length > 0)).toBe(true);
    // weakest stat for the baseline is flexibility (7)
    expect(quest.objectives[3].note.startsWith('Odak: en zayıf statın Esneklik (7). ')).toBe(true);
    const penalty = generatePenaltyQuest({ level: 3 }, DAY0);
    // 20 · 1.16 = 23.2 → nearest 5 → 25
    expect(penalty.objectives[0].note).toBe('Ceza: taban 20 · Lv 3 ×1,16 → 25');
  });
});

describe('§13 rest days and streak', () => {
  test('eligibility: already marked, quest completed, limit of 3 in 7 days', () => {
    const s0 = fresh();
    expect(getRestDayEligibility(s0, DAY0).allowed).toBe(true);
    const marked = markRestDay(s0, DAY0, 'sick');
    expect(getRestDayEligibility(marked, DAY0).reason).toBe('already_marked');
    expect(() => markRestDay(marked, DAY0, 'rest')).toThrow(GameRuleError);

    const completed: GameState = { ...s0, dailyQuest: { ...s0.dailyQuest!, status: 'completed' } };
    expect(getRestDayEligibility(completed, DAY0).reason).toBe('quest_completed');

    const today = '2026-03-10';
    const three: GameState = {
      ...s0,
      dailyQuest: null,
      restDays: [
        { dayKey: '2026-03-04', kind: 'rest' }, // 6 days before → inside window
        { dayKey: '2026-03-06', kind: 'rest' },
        { dayKey: '2026-03-08', kind: 'sick' },
      ],
    };
    expect(restDaysInWindow(three.restDays, today)).toBe(REST_DAY_LIMIT);
    expect(getRestDayEligibility(three, today).reason).toBe('limit');
    // 2026-03-11: 03-04 falls out of the window
    expect(getRestDayEligibility(three, '2026-03-11').allowed).toBe(true);
  });

  test('unmark only affects today', () => {
    const marked = markRestDay(fresh(), DAY0, 'rest');
    expect(unmarkRestDay(marked, DAY0).restDays).toEqual([]);
    const untouched = unmarkRestDay(marked, addDays(DAY0, 1));
    expect(untouched).toBe(marked);
  });

  test('rest day: incomplete quest is excused, no penalty, streak kept', () => {
    let state = rolloverDay(fresh(), addDays(DAY0, 1)).state; // day 1 (grace day passed)
    state = withPlayer(state, { streak: { current: 4, best: 6, lastCompletedDay: DAY0 } });
    state = markRestDay(state, addDays(DAY0, 1), 'sick');
    const result = rolloverDay(state, addDays(DAY0, 2));
    expect(result.state.penaltyQuest).toBeNull();
    expect(result.archived[0].status).toBe('excused');
    expect(result.events.map((e) => e.type)).toContain('daily_excused');
    expect(result.state.player.streak.current).toBe(4);
  });

  test('missed quest breaks the streak and opens a penalty', () => {
    let state = rolloverDay(fresh(), addDays(DAY0, 1)).state;
    state = withPlayer(state, { streak: { current: 4, best: 6, lastCompletedDay: DAY0 } });
    const result = rolloverDay(state, addDays(DAY0, 2));
    expect(result.state.penaltyQuest?.status).toBe('active');
    expect(result.state.player.streak).toEqual({ current: 0, best: 6, lastCompletedDay: DAY0 });
    expect(result.events).toContainEqual({ type: 'streak_broken', previous: 4 });
  });

  test('a full day without opening the app breaks the streak even after a rest day', () => {
    let state = withPlayer(fresh(), { streak: { current: 2, best: 2, lastCompletedDay: DAY0 } });
    state = { ...state, dailyQuest: { ...state.dailyQuest!, status: 'completed' } };
    const result = rolloverDay(state, addDays(DAY0, 3));
    expect(result.state.player.streak.current).toBe(0);
    expect(result.state.penaltyQuest?.status).toBe('active');
  });

  test('completing the daily quest extends the streak exactly once per day', () => {
    const s0 = fresh();
    const entries = s0.dailyQuest!.objectives.map((o) => ({ exerciseId: o.exerciseId, amount: o.target }));
    const done = applyExerciseLogs(s0, entries, 5);
    expect(done.streakExtended).toBe(true);
    expect(done.state.player.streak).toEqual({ current: 1, best: 1, lastCompletedDay: DAY0 });
    const again = applyExerciseLogs(done.state, [{ exerciseId: 'pushup', amount: 5 }], 6);
    expect(again.streakExtended).toBe(false);
    expect(again.state.player.streak.current).toBe(1);
    expect(extendStreak({ current: 1, best: 1, lastCompletedDay: DAY0 }, DAY0).current).toBe(1);
  });

  test('no reminder on a rest day, even with an active penalty', () => {
    const now = new Date(2026, 2, 2, 8, 0).getTime();
    const plan = buildReminderPlan({
      now,
      settings: { enabled: true, hour: 19, minute: 0 },
      todayQuestDone: false,
      penaltyActive: true,
      todayRest: true,
      days: 3,
    });
    expect(plan.map((p) => new Date(p.at).getDate())).toEqual([3, 4]);
  });
});

describe('§14 heatmap', () => {
  test('raw XP per day ignores unknown exercises', () => {
    expect(
      rawXpByDay([
        { dayKey: DAY0, exerciseId: 'pushup', amount: 20 },
        { dayKey: DAY0, exerciseId: 'plank', amount: 61 }, // 30.5 → 31
        { dayKey: '2026-03-03', exerciseId: 'nope', amount: 99 },
      ]),
    ).toEqual({ [DAY0]: 51 });
  });

  test('quantile helper', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2); // floor(0.25·4) = 1
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4); // floor(0.75·4) = 3
  });

  test('grid shape, Monday-first, future cells, levels and flags', () => {
    const endDay = '2026-03-04'; // Wednesday
    expect(weekdayIndex(endDay)).toBe(2);
    const values = { '2026-03-02': 10, '2026-03-03': 40, '2026-03-04': 100, '2026-02-23': 20 };
    const map = buildHeatmap({
      endDay,
      weeks: 2,
      values,
      restDays: ['2026-02-25'],
      questDays: ['2026-03-03'],
    });
    expect(map.weeks).toHaveLength(2);
    expect(map.weeks[0][0].dayKey).toBe('2026-02-23');
    expect(map.weeks[1][0].dayKey).toBe('2026-03-02');
    expect(map.weeks[1][3]).toMatchObject({ dayKey: '2026-03-05', future: true, level: 0 });
    // positive sorted: [10, 20, 40, 100] → q1 = v[0] = 10, q2 = v[1] = 20, q3 = v[2] = 40
    expect(map.thresholds).toEqual([10, 20, 40]);
    expect(map.weeks[1][0].level).toBe(1);
    expect(map.weeks[0][0].level).toBe(2);
    expect(map.weeks[1][1].level).toBe(3);
    expect(map.weeks[1][2].level).toBe(4);
    expect(map.weeks[0][2].rest).toBe(true);
    expect(map.weeks[1][1].questDone).toBe(true);
    expect(map.activeDays).toBe(4);
    expect(map.totalValue).toBe(170);
  });
});

describe('review fixes', () => {
  test('entryBoss separates defeated bosses from first records (§10)', () => {
    // pushup record 15 from the baseline → 16 beats it; burpee has no record → first record only.
    const result = applyExerciseLogs(
      fresh(),
      [
        { exerciseId: 'burpee', amount: 5 },
        { exerciseId: 'pushup', amount: 16 },
      ],
      1,
    );
    expect(result.entryRecord).toEqual([true, true]);
    expect(result.entryBoss).toEqual([false, true]);
  });

  test('withBaselineRecords seeds records for players created before records existed', () => {
    const player: Player = { ...fresh().player, records: {} };
    const seeded = withBaselineRecords(player);
    expect(seeded.records.pushup).toEqual({ amount: 15, dayKey: DAY0, source: 'baseline', bonusDay: null });
    expect(Object.keys(seeded.records).sort()).toEqual(['plank', 'pushup', 'situp', 'squat']);
    // existing records are left alone (same instance)
    const withRecords = fresh().player;
    expect(withBaselineRecords(withRecords)).toBe(withRecords);
    // an all-zero baseline has nothing to seed
    const zero = { ...player, baseline: { pushups: 0, situps: 0, squats: 0, plankSeconds: 0 } };
    expect(withBaselineRecords(zero)).toBe(zero);
  });
});
