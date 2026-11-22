/// <reference types="jest" />
/**
 * Engine integration of §10 (records/boss), §11 (RPE), §13 (streak) and the
 * exam → record rule. Expected values derived by hand from docs/GAME_DESIGN.md.
 */
import { applyExerciseLogs, createInitialState, submitRankExam } from './engine';
import {
  GameRuleError,
  type BaselineTest,
  type DayKey,
  type ExerciseEntry,
  type GameState,
  type Player,
  type PersonalRecords,
  type Quest,
  type QuestObjective,
} from './types';

const CREATED: DayKey = '2026-11-01';
const YESTERDAY: DayKey = '2026-11-20';
const TODAY: DayKey = '2026-11-21';
const TOMORROW: DayKey = '2026-11-22';
const NOW = new Date(2026, 10, 21, 18, 0).getTime();

const BASELINE: BaselineTest = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };

function makeQuest(kind: Quest['kind'], objectives: Partial<QuestObjective>[], overrides: Partial<Quest> = {}): Quest {
  return {
    id: `${kind}-${TODAY}`,
    kind,
    dayKey: TODAY,
    title: kind === 'daily' ? 'Günlük Görev' : 'CEZA GÖREVİ: Hayatta Kalma',
    objectives: objectives.map((o) => ({ exerciseId: 'pushup', target: 10, progress: 0, note: '', ...o })),
    rewardXp: kind === 'daily' ? 75 : 0,
    awardedXp: 0,
    status: 'active',
    completedAt: null,
    ...overrides,
  };
}

/** Seeded player (records pushup 15, situp 20, squat 25, plank 45), no quests, today = TODAY. */
function makeState(player: Partial<Player> = {}, rest: Partial<GameState> = {}): GameState {
  const base = createInitialState('Avcı', BASELINE, CREATED);
  return {
    ...base,
    player: { ...base.player, ...player },
    dailyQuest: null,
    penaltyQuest: null,
    lastRolloverDay: TODAY,
    restDays: [],
    ...rest,
  };
}

function log(state: GameState, entries: ExerciseEntry[]) {
  return applyExerciseLogs(state, entries, NOW);
}

// ---------------------------------------------------------------------------
// §10 Records & boss
// ---------------------------------------------------------------------------

describe('records while logging sets (§10)', () => {
  it('tie with the record: no record, no bonus', () => {
    const state = makeState();
    const result = log(state, [{ exerciseId: 'pushup', amount: 15 }]);
    expect(result.recordEvents).toEqual([]);
    expect(result.entryRecord).toEqual([false]);
    expect(result.recordBonusXp).toBe(0);
    expect(result.entryXp).toEqual([15]);
    expect(result.state.player.records).toEqual(state.player.records);
  });

  it('first record of an exercise: saved, no boss, no bonus', () => {
    const result = log(makeState(), [{ exerciseId: 'pullup', amount: 5 }]);
    expect(result.state.player.records.pullup).toEqual({ amount: 5, dayKey: TODAY, source: 'set', bonusDay: null });
    expect(result.recordEvents).toHaveLength(1);
    expect(result.recordEvents[0]).toMatchObject({ exerciseId: 'pullup', boss: false, bonusXp: 0, previous: null });
    expect(result.entryRecord).toEqual([true]);
    expect(result.recordBonusXp).toBe(0);
    expect(result.totalXp).toBe(15); // 5 · 3
  });

  it('beating a record: boss + bonus (level 1 → 40) on level XP only', () => {
    const result = log(makeState(), [{ exerciseId: 'pushup', amount: 16 }]);
    expect(result.recordEvents).toEqual([
      {
        exerciseId: 'pushup',
        bossName: 'Demir Golem',
        previous: 15,
        amount: 16,
        boss: true,
        bonusXp: 40,
        locked: false,
      },
    ]);
    expect(result.exerciseXp).toBe(16);
    expect(result.recordBonusXp).toBe(40);
    expect(result.totalXp).toBe(56);
    expect(result.entryXp).toEqual([56]);
    expect(result.state.player.xp).toBe(56);
    expect(result.state.player.totalXp).toBe(56);
    // stat XP only from the set: strength round(16·0.7) = 11, endurance round(16·0.3) = 5
    expect(result.statXpGained).toEqual({ strength: 11, endurance: 5 });
    expect(result.state.player.records.pushup).toEqual({ amount: 16, dayKey: TODAY, source: 'set', bonusDay: TODAY });
  });

  it('bonus uses the level AFTER the set XP (set that levels up)', () => {
    // level 1, xp 95: +20 → 115 ≥ 100 → level 2, xp 15; bonus 30 + 10·2 = 50 → xp 65 (< 283)
    const result = log(makeState({ xp: 95, totalXp: 95 }), [{ exerciseId: 'pushup', amount: 20 }]);
    expect(result.recordEvents[0].bonusXp).toBe(50);
    expect(result.recordBonusXp).toBe(50);
    expect(result.state.player.level).toBe(2);
    expect(result.state.player.xp).toBe(65);
    expect(result.state.player.totalXp).toBe(95 + 70);
    expect(result.levelsGained).toBe(1);
    expect(result.pointsGained).toBe(3);
    expect(result.entryXp).toEqual([70]);
  });

  it('the bonus itself can level up', () => {
    // xp 60: +16 → 76 (level 1); bonus 40 → 116 → level 2, xp 16
    const result = log(makeState({ xp: 60, totalXp: 60 }), [{ exerciseId: 'pushup', amount: 16 }]);
    expect(result.recordBonusXp).toBe(40);
    expect(result.state.player.level).toBe(2);
    expect(result.state.player.xp).toBe(16);
    expect(result.levelsGained).toBe(1);
  });

  it('at most one bonus per exercise per day (same batch)', () => {
    // 16 → 16 + 40 = 56; 17 → +17 = 73, record again but bonus 0
    const result = log(makeState(), [
      { exerciseId: 'pushup', amount: 16 },
      { exerciseId: 'pushup', amount: 17 },
    ]);
    expect(result.recordEvents.map((e) => [e.boss, e.bonusXp])).toEqual([
      [true, 40],
      [true, 0],
    ]);
    expect(result.entryRecord).toEqual([true, true]);
    expect(result.entryXp).toEqual([56, 17]);
    expect(result.state.player.xp).toBe(73);
    expect(result.state.player.records.pushup).toEqual({ amount: 17, dayKey: TODAY, source: 'set', bonusDay: TODAY });
  });

  it('at most one bonus per exercise per day (separate logs the same day)', () => {
    const first = log(makeState(), [{ exerciseId: 'pushup', amount: 16 }]);
    const second = log(first.state, [{ exerciseId: 'pushup', amount: 18 }]);
    expect(second.recordEvents).toHaveLength(1);
    expect(second.recordEvents[0]).toMatchObject({ boss: true, bonusXp: 0, previous: 16, amount: 18 });
    expect(second.recordBonusXp).toBe(0);
    expect(second.state.player.records.pushup?.amount).toBe(18);
  });

  it('each exercise has its own daily bonus', () => {
    // pushup 16: 16 + 40 = 56; squat 26: round(20.8) = 21 → 77 (level 1) → bonus 40 → 117 → level 2, xp 17
    const result = log(makeState(), [
      { exerciseId: 'pushup', amount: 16 },
      { exerciseId: 'squat', amount: 26 },
    ]);
    expect(result.recordBonusXp).toBe(80);
    expect(result.state.player.level).toBe(2);
    expect(result.state.player.xp).toBe(17);
  });

  it('a bonus given yesterday does not block today', () => {
    const records: PersonalRecords = {
      pushup: { amount: 15, dayKey: YESTERDAY, source: 'set', bonusDay: YESTERDAY },
    };
    const result = log(makeState({ records }), [{ exerciseId: 'pushup', amount: 16 }]);
    expect(result.recordBonusXp).toBe(40);
  });

  it('first record then a higher set the same day → boss with bonus', () => {
    // pullup 5: 15 XP (first record); pullup 6: 18 → 33, beaten → +40 → 73
    const result = log(makeState(), [
      { exerciseId: 'pullup', amount: 5 },
      { exerciseId: 'pullup', amount: 6 },
    ]);
    expect(result.recordEvents.map((e) => [e.boss, e.bonusXp, e.previous])).toEqual([
      [false, 0, null],
      [true, 40, 5],
    ]);
    expect(result.state.player.xp).toBe(73);
  });

  it('XP locked by a penalty: record updated, bonus 0, bonusDay unchanged, no XP', () => {
    const records: PersonalRecords = {
      pushup: { amount: 15, dayKey: CREATED, source: 'baseline', bonusDay: '2026-11-10' },
    };
    const penalty = makeQuest('penalty', [{ exerciseId: 'burpee', target: 20 }]);
    const state = makeState({ records }, { penaltyQuest: penalty });
    const result = log(state, [{ exerciseId: 'pushup', amount: 20 }]);
    expect(result.xpLocked).toBe(true);
    expect(result.recordEvents[0]).toMatchObject({ boss: true, bonusXp: 0, locked: true });
    expect(result.state.player.records.pushup).toEqual({
      amount: 20,
      dayKey: TODAY,
      source: 'set',
      bonusDay: '2026-11-10',
    });
    expect(result.totalXp).toBe(0);
    expect(result.entryXp).toEqual([0]);
    expect(result.state.player.xp).toBe(0);
    expect(result.state.player.totalXp).toBe(0);
  });

  it('lock is decided when each set starts processing', () => {
    // squat 30 completes the penalty → still locked for this set (0 XP, no bonus, bonusDay stays null).
    // pushup 20: unlocked → 20 + bonus 40 = 60.
    // squat 31: round(24.8) = 25 → 85 (level 1) → bonus 40 (not consumed earlier) → 125 → level 2, xp 25.
    const penalty = makeQuest('penalty', [{ exerciseId: 'squat', target: 30 }]);
    const result = log(makeState({}, { penaltyQuest: penalty }), [
      { exerciseId: 'squat', amount: 30 },
      { exerciseId: 'pushup', amount: 20 },
      { exerciseId: 'squat', amount: 31 },
    ]);
    expect(result.recordEvents.map((e) => [e.exerciseId, e.bonusXp, e.locked])).toEqual([
      ['squat', 0, true],
      ['pushup', 40, false],
      ['squat', 40, false],
    ]);
    expect(result.entryXp).toEqual([0, 60, 65]);
    expect(result.recordBonusXp).toBe(80);
    expect(result.state.penaltyQuest?.status).toBe('completed');
    expect(result.state.player.level).toBe(2);
    expect(result.state.player.xp).toBe(25);
    expect(result.state.player.records.squat).toEqual({ amount: 31, dayKey: TODAY, source: 'set', bonusDay: TODAY });
  });

  it('does not mutate the input state', () => {
    const state = makeState({}, { penaltyQuest: makeQuest('penalty', [{ exerciseId: 'squat', target: 30 }]) });
    const snapshot = structuredClone(state);
    log(state, [
      { exerciseId: 'squat', amount: 30, rpe: 9 },
      { exerciseId: 'pushup', amount: 20, rpe: 6 },
    ]);
    expect(state).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// §11 RPE through the engine
// ---------------------------------------------------------------------------

describe('RPE while logging sets (§11)', () => {
  it('updates the per-exercise moving average in order', () => {
    // pushup: 8 → round2(0.7·8 + 0.3·6) = 7.4; squat: 5
    const result = log(makeState(), [
      { exerciseId: 'pushup', amount: 5, rpe: 8 },
      { exerciseId: 'squat', amount: 5, rpe: 5 },
      { exerciseId: 'pushup', amount: 5, rpe: 6 },
    ]);
    expect(result.state.player.rpe).toEqual({ pushup: 7.4, squat: 5 });
  });

  it('builds on the stored average', () => {
    // round2(0.7·7.3 + 0.3·8) = 7.51
    const result = log(makeState({ rpe: { pushup: 7.3 } }), [{ exerciseId: 'pushup', amount: 5, rpe: 8 }]);
    expect(result.state.player.rpe.pushup).toBe(7.51);
  });

  it('sets without RPE leave the average untouched', () => {
    const result = log(makeState({ rpe: { pushup: 7.3 } }), [{ exerciseId: 'pushup', amount: 5 }]);
    expect(result.state.player.rpe).toEqual({ pushup: 7.3 });
  });

  it('is updated even while XP is locked', () => {
    const state = makeState({}, { penaltyQuest: makeQuest('penalty', [{ exerciseId: 'burpee', target: 20 }]) });
    const result = log(state, [{ exerciseId: 'pushup', amount: 5, rpe: 9 }]);
    expect(result.xpLocked).toBe(true);
    expect(result.state.player.rpe.pushup).toBe(9);
  });

  it.each([0, 11, 7.5, NaN])('invalid RPE %p rejects the whole batch (invalid_rpe)', (rpe) => {
    const state = makeState();
    const snapshot = structuredClone(state);
    try {
      log(state, [
        { exerciseId: 'pushup', amount: 20 },
        { exerciseId: 'squat', amount: 10, rpe },
      ]);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRuleError);
      expect((error as GameRuleError).code).toBe('invalid_rpe');
    }
    expect(state).toEqual(snapshot);
  });

  it('RPE does not change XP', () => {
    const a = log(makeState(), [{ exerciseId: 'run', amount: 10 }]);
    const b = log(makeState(), [{ exerciseId: 'run', amount: 10, rpe: 10 }]);
    expect(b.totalXp).toBe(a.totalXp);
    expect(b.exerciseXp).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// §13 Streak on completion
// ---------------------------------------------------------------------------

describe('streak on daily quest completion (§13)', () => {
  const daily = () => makeQuest('daily', [{ exerciseId: 'pushup', target: 10 }]);

  it('+1 on completion, best kept when higher', () => {
    const state = makeState({ streak: { current: 2, best: 9, lastCompletedDay: YESTERDAY } }, { dailyQuest: daily() });
    const result = log(state, [{ exerciseId: 'pushup', amount: 10 }]);
    expect(result.state.dailyQuest?.status).toBe('completed');
    expect(result.streakExtended).toBe(true);
    expect(result.state.player.streak).toEqual({ current: 3, best: 9, lastCompletedDay: TODAY });
  });

  it('best follows current when it is exceeded', () => {
    const state = makeState({ streak: { current: 5, best: 5, lastCompletedDay: YESTERDAY } }, { dailyQuest: daily() });
    const result = log(state, [{ exerciseId: 'pushup', amount: 12 }]);
    expect(result.state.player.streak).toEqual({ current: 6, best: 6, lastCompletedDay: TODAY });
  });

  it('only once per day: more sets after completion do not extend it', () => {
    const state = makeState({ streak: { current: 0, best: 4, lastCompletedDay: null } }, { dailyQuest: daily() });
    const first = log(state, [
      { exerciseId: 'pushup', amount: 10 },
      { exerciseId: 'pushup', amount: 10 },
    ]);
    expect(first.state.player.streak).toEqual({ current: 1, best: 4, lastCompletedDay: TODAY });
    const again = log(first.state, [{ exerciseId: 'pushup', amount: 10 }]);
    expect(again.streakExtended).toBe(false);
    expect(again.state.player.streak).toEqual({ current: 1, best: 4, lastCompletedDay: TODAY });
  });

  it('no completion → streak unchanged', () => {
    const streak = { current: 2, best: 9, lastCompletedDay: YESTERDAY };
    const result = log(makeState({ streak }, { dailyQuest: daily() }), [{ exerciseId: 'pushup', amount: 9 }]);
    expect(result.streakExtended).toBe(false);
    expect(result.state.player.streak).toEqual(streak);
  });

  it('completion while XP is locked still counts for the streak (reward forfeited)', () => {
    const state = makeState(
      { streak: { current: 1, best: 1, lastCompletedDay: YESTERDAY } },
      { dailyQuest: daily(), penaltyQuest: makeQuest('penalty', [{ exerciseId: 'burpee', target: 20 }]) },
    );
    const result = log(state, [{ exerciseId: 'pushup', amount: 10 }]);
    expect(result.state.dailyQuest?.awardedXp).toBe(0);
    expect(result.state.player.streak).toEqual({ current: 2, best: 2, lastCompletedDay: TODAY });
  });
});

// ---------------------------------------------------------------------------
// Rank exam → records (§10)
// ---------------------------------------------------------------------------

describe('rank exam results update records (source "exam", no boss/bonus)', () => {
  const examState = (baseline: BaselineTest = BASELINE) => {
    const base = createInitialState('Avcı', baseline, CREATED);
    return { ...base, player: { ...base.player, level: 5 }, lastRolloverDay: TODAY, dailyQuest: null };
  };

  it('pass: all four records raised; XP = rank reward only', () => {
    const state = examState();
    const result = submitRankExam(state, { pushups: 22, situps: 26, squats: 31, plankSeconds: 61 }, TODAY);
    expect(result.evaluation.passed).toBe(true);
    const r = result.state.player.records;
    expect(r.pushup).toMatchObject({ amount: 22, dayKey: TODAY, source: 'exam' });
    expect(r.situp).toMatchObject({ amount: 26, dayKey: TODAY, source: 'exam' });
    expect(r.squat).toMatchObject({ amount: 31, dayKey: TODAY, source: 'exam' });
    expect(r.plank).toMatchObject({ amount: 61, dayKey: TODAY, source: 'exam' });
    // 250 · 1 (D); no record bonus
    expect(result.rewardXp).toBe(250);
    expect(result.state.player.xp).toBe(250);
    expect(result.state.player.totalXp).toBe(250);
  });

  it('fail: higher results still update records; equal/lower ones do not', () => {
    const state = examState();
    // pushups 15 < 20 → fail
    const result = submitRankExam(state, { pushups: 15, situps: 30, squats: 10, plankSeconds: 0 }, TODAY);
    expect(result.evaluation.passed).toBe(false);
    const r = result.state.player.records;
    expect(r.pushup).toEqual(state.player.records.pushup); // equal → unchanged
    expect(r.situp).toMatchObject({ amount: 30, dayKey: TODAY, source: 'exam' });
    expect(r.squat).toEqual(state.player.records.squat); // lower → unchanged
    expect(r.plank).toEqual(state.player.records.plank);
    expect(result.state.player.xp).toBe(0);
    expect(result.state.player.rankExamCooldownUntil).toBe(TOMORROW);
  });

  it('creates a record for a movement without one', () => {
    const state = examState({ pushups: 0, situps: 20, squats: 25, plankSeconds: 45 });
    expect(state.player.records.pushup).toBeUndefined();
    const result = submitRankExam(state, { pushups: 12, situps: 10, squats: 10, plankSeconds: 10 }, TODAY);
    expect(result.state.player.records.pushup).toMatchObject({ amount: 12, dayKey: TODAY, source: 'exam' });
  });

  it('does not mutate the input state', () => {
    const state = examState();
    const snapshot = structuredClone(state);
    submitRankExam(state, { pushups: 22, situps: 26, squats: 31, plankSeconds: 61 }, TODAY);
    submitRankExam(state, { pushups: 30, situps: 1, squats: 40, plankSeconds: 50 }, TODAY);
    expect(state).toEqual(snapshot);
  });
});
