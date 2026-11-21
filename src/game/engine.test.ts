/// <reference types="jest" />
/**
 * Unit tests for src/game/engine.ts against docs/GAME_DESIGN.md §4–§7.
 *
 * Expected values are computed by hand from the spec formulas (the arithmetic is
 * written next to each value), never copied from the implementation's output.
 * States are crafted with the helpers below instead of grinding through logs.
 */
import { toDayKey } from './date';
import {
  applyExerciseLog,
  applyExerciseLogs,
  createInitialState,
  isXpLocked,
  rolloverDay,
  submitRankExam,
  type RolloverEvent,
} from './engine';
import { EXAM_BLOCK_MESSAGES } from './rank';
import {
  GameRuleError,
  type BaselineTest,
  type DayKey,
  type ExerciseEntry,
  type ExerciseId,
  type GameErrorCode,
  type GameState,
  type Player,
  type Quest,
  type QuestKind,
  type QuestObjective,
  type Rank,
  type Stats,
} from './types';

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const CREATED_DAY: DayKey = '2026-11-01';
const YESTERDAY: DayKey = '2026-11-20';
const TODAY: DayKey = '2026-11-21';
const TOMORROW: DayKey = '2026-11-22';
/** 2026-11-21 18:30 local time. */
const NOW = new Date(2026, 10, 21, 18, 30).getTime();
/** 2026-11-20 09:00 local time. */
const EARLIER = new Date(2026, 10, 20, 9, 0).getTime();

const PENALTY_TITLE = 'CEZA GÖREVİ: Hayatta Kalma';

function statsOf(value: number, overrides: Partial<Stats> = {}): Stats {
  return {
    strength: value,
    endurance: value,
    agility: value,
    vitality: value,
    flexibility: value,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Test',
    level: 1,
    xp: 0,
    totalXp: 0,
    rank: 'E',
    stats: statsOf(10),
    statXp: statsOf(0),
    unspentPoints: 0,
    baseline: { pushups: 10, situps: 10, squats: 10, plankSeconds: 30 },
    createdDay: CREATED_DAY,
    rankExamCooldownUntil: null,
    records: {},
    rpe: {},
    streak: { current: 0, best: 0, lastCompletedDay: null },
    ...overrides,
  };
}

/** [exerciseId, target, progress = 0] */
type ObjectiveSpec = [ExerciseId, number, number?];

function makeQuest(
  kind: QuestKind,
  dayKey: DayKey,
  objectives: ObjectiveSpec[],
  overrides: Partial<Quest> = {},
): Quest {
  return {
    id: `${kind}-${dayKey}`,
    kind,
    dayKey,
    title: kind === 'penalty' ? PENALTY_TITLE : 'Günlük Görev',
    objectives: objectives.map(([exerciseId, target, progress = 0]) => ({ exerciseId, target, progress, note: '' })),
    rewardXp: kind === 'daily' ? 75 : 0,
    awardedXp: 0,
    status: 'active',
    completedAt: null,
    ...overrides,
  };
}

/** Untouched daily quest of an all-10-stats, level-1 player (reward 50 + 25·1 = 75). */
function freshDaily(dayKey: DayKey = TODAY, overrides: Partial<Quest> = {}): Quest {
  return makeQuest(
    'daily',
    dayKey,
    [
      ['pushup', 10],
      ['situp', 10],
      ['squat', 15],
      ['lunge', 12],
    ],
    overrides,
  );
}

/** Daily quest where only the lunge objective (0/12) is left. */
function dailyLungeLeft(dayKey: DayKey = TODAY, overrides: Partial<Quest> = {}): Quest {
  return makeQuest(
    'daily',
    dayKey,
    [
      ['pushup', 10, 10],
      ['situp', 10, 10],
      ['squat', 15, 15],
      ['lunge', 12, 0],
    ],
    overrides,
  );
}

function completedDaily(dayKey: DayKey): Quest {
  return makeQuest(
    'daily',
    dayKey,
    [
      ['pushup', 10, 10],
      ['situp', 10, 10],
      ['squat', 15, 15],
      ['lunge', 12, 12],
    ],
    { status: 'completed', awardedXp: 75, completedAt: EARLIER },
  );
}

/** Level-1 penalty quest with progress given as [burpee, squat, plank, run]. */
function makePenalty(
  dayKey: DayKey,
  progress: [number, number, number, number] = [0, 0, 0, 0],
  overrides: Partial<Quest> = {},
): Quest {
  const [burpee, squat, plank, run] = progress;
  return makeQuest(
    'penalty',
    dayKey,
    [
      ['burpee', 20, burpee],
      ['squat', 50, squat],
      ['plank', 120, plank],
      ['run', 15, run],
    ],
    overrides,
  );
}

interface StateOptions {
  player?: Partial<Player>;
  dailyQuest?: Quest | null;
  penaltyQuest?: Quest | null;
  lastRolloverDay?: DayKey;
}

function makeState(options: StateOptions = {}): GameState {
  return {
    player: makePlayer(options.player),
    dailyQuest: options.dailyQuest !== undefined ? options.dailyQuest : freshDaily(),
    penaltyQuest: options.penaltyQuest !== undefined ? options.penaltyQuest : null,
    lastRolloverDay: options.lastRolloverDay ?? TODAY,
    restDays: [],
  };
}

/** Recursively freezes a value; any mutation attempt then throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as object)) deepFreeze(child);
  }
  return value;
}

/** Drops zero / missing entries so `{ a: 0 }` and `{}` compare equal. */
function nonZero(stats: Partial<Stats>): Partial<Stats> {
  return Object.fromEntries(
    Object.entries(stats).filter(([, v]) => v !== undefined && v !== 0),
  ) as Partial<Stats>;
}

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value');
  return value;
}

function eventTypes(events: RolloverEvent[]): RolloverEvent['type'][] {
  return events.map((e) => e.type);
}

function findEvent<T extends RolloverEvent['type']>(
  events: RolloverEvent[],
  type: T,
): Extract<RolloverEvent, { type: T }> {
  const event = events.find((e) => e.type === type);
  if (!event) throw new Error(`Missing "${type}" event`);
  return event as Extract<RolloverEvent, { type: T }>;
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to throw');
}

function expectRuleError(fn: () => unknown, code?: GameErrorCode): GameRuleError {
  const error = thrown(fn);
  expect(error).toBeInstanceOf(GameRuleError);
  if (code) expect((error as GameRuleError).code).toBe(code);
  return error as GameRuleError;
}

function objectiveTuples(quest: Quest | null): [ExerciseId, number, number][] {
  return must(quest).objectives.map((o) => [o.exerciseId, o.target, o.progress]);
}

/** Fresh daily quest whose focus is lunge (strength is the weakest stat). */
function expectFreshDaily(
  quest: Quest | null,
  dayKey: DayKey,
  [pushup, situp, squat, lunge]: [number, number, number, number],
  rewardXp: number,
): void {
  expect(quest).toMatchObject({
    id: `daily-${dayKey}`,
    kind: 'daily',
    dayKey,
    status: 'active',
    rewardXp,
    awardedXp: 0,
    completedAt: null,
  });
  expect(objectiveTuples(quest)).toEqual([
    ['pushup', pushup, 0],
    ['situp', situp, 0],
    ['squat', squat, 0],
    ['lunge', lunge, 0],
  ]);
}

function expectFreshPenalty(
  quest: Quest | null,
  dayKey: DayKey,
  [burpee, squat, plank, run]: [number, number, number, number] = [20, 50, 120, 15],
): void {
  expect(quest).toMatchObject({
    id: `penalty-${dayKey}`,
    kind: 'penalty',
    dayKey,
    title: PENALTY_TITLE,
    status: 'active',
    rewardXp: 0,
    awardedXp: 0,
    completedAt: null,
  });
  expect(objectiveTuples(quest)).toEqual([
    ['burpee', burpee, 0],
    ['squat', squat, 0],
    ['plank', plank, 0],
    ['run', run, 0],
  ]);
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState (§2, §5)', () => {
  // Spec example: 15 push-ups, 20 sit-ups, 25 squats, 45 s plank.
  const baseline: BaselineTest = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };

  it('creates a level 1, rank E player with the spec starting stats', () => {
    const state = createInitialState('  Ali  ', baseline, TODAY);
    expect(state.player).toEqual({
      name: 'Ali',
      level: 1,
      xp: 0,
      totalXp: 0,
      rank: 'E',
      // strength 5+4.5+2.5=12, endurance 5+4.5+3=12.5→13, agility 5+3.75+2=10.75→11,
      // vitality 5+3+1.5=9.5→10, flexibility 5+1.5=6.5→7
      stats: { strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 },
      statXp: statsOf(0),
      unspentPoints: 0,
      baseline,
      createdDay: TODAY,
      rankExamCooldownUntil: null,
      // §10: the onboarding test seeds the first personal records; §11/§13 start empty.
      records: {
        pushup: { amount: 15, dayKey: TODAY, source: 'baseline', bonusDay: null },
        situp: { amount: 20, dayKey: TODAY, source: 'baseline', bonusDay: null },
        squat: { amount: 25, dayKey: TODAY, source: 'baseline', bonusDay: null },
        plank: { amount: 45, dayKey: TODAY, source: 'baseline', bonusDay: null },
      },
      rpe: {},
      streak: { current: 0, best: 0, lastCompletedDay: null },
    });
  });

  it('has no penalty, is not XP-locked and has rolled over to today', () => {
    const state = createInitialState('Ali', baseline, TODAY);
    expect(state.penaltyQuest).toBeNull();
    expect(state.lastRolloverDay).toBe(TODAY);
    expect(isXpLocked(state)).toBe(false);
  });

  it("generates today's daily quest scaled to the starting stats", () => {
    const quest = must(createInitialState('Ali', baseline, TODAY).dailyQuest);
    expect(quest).toMatchObject({
      id: 'daily-2026-11-21',
      kind: 'daily',
      dayKey: TODAY,
      status: 'active',
      rewardXp: 75, // 50 + 25·1
      awardedXp: 0,
      completedAt: null,
    });
    expect(quest.objectives).toHaveLength(4);
    const withoutNote = ({ exerciseId, target, progress }: QuestObjective) => ({ exerciseId, target, progress });
    expect(quest.objectives.slice(0, 3).map(withoutNote)).toEqual([
      { exerciseId: 'pushup', target: 11, progress: 0 }, // 10·1·(0.6+12/25=1.08)=10.8→11
      { exerciseId: 'situp', target: 11, progress: 0 }, // 10·(0.6+13/25=1.12)=11.2→11
      { exerciseId: 'squat', target: 16, progress: 0 }, // 15·1.08=16.2→16
    ]);
    // Weakest stat is flexibility (7) → pool stretch/yoga, statFactor 0.6+7/25=0.88:
    // stretch 5·0.88=4.4→4 min, yoga 10·0.88=8.8→9 min.
    expect([
      { exerciseId: 'stretch', target: 4, progress: 0 },
      { exerciseId: 'yoga', target: 9, progress: 0 },
    ]).toContainEqual(withoutNote(quest.objectives[3]));
  });

  it('uses the given local DayKey for createdDay and the quest id', () => {
    const day = toDayKey(new Date(2026, 0, 5, 23, 59));
    expect(day).toBe('2026-01-05');
    const state = createInitialState('Ali', baseline, day);
    expect(state.player.createdDay).toBe('2026-01-05');
    expect(state.lastRolloverDay).toBe('2026-01-05');
    expect(state.dailyQuest?.id).toBe('daily-2026-01-05');
  });

  it('falls back to "Oyuncu" for a blank name', () => {
    expect(createInitialState('   ', baseline, TODAY).player.name).toBe('Oyuncu');
  });

  it.each<[string, BaselineTest]>([
    ['negative push-ups', { ...baseline, pushups: -1 }],
    ['too many sit-ups', { ...baseline, situps: 1001 }],
    ['fractional squats', { ...baseline, squats: 2.5 }],
    ['plank over 3600 s', { ...baseline, plankSeconds: 3601 }],
  ])('rejects an invalid baseline (%s) with GameRuleError', (_label, invalid) => {
    expectRuleError(() => createInitialState('Ali', invalid, TODAY));
  });

  it('is deterministic and does not mutate the baseline', () => {
    const frozen = deepFreeze({ ...baseline });
    const a = createInitialState('Ali', frozen, TODAY);
    const b = createInitialState('Ali', frozen, TODAY);
    expect(a).toEqual(b);
    expect(frozen).toEqual(baseline);
  });
});

// ---------------------------------------------------------------------------
// isXpLocked
// ---------------------------------------------------------------------------

describe('isXpLocked (§4, §6)', () => {
  it('is locked only while a penalty quest is active', () => {
    expect(isXpLocked({ penaltyQuest: null })).toBe(false);
    expect(isXpLocked({ penaltyQuest: makePenalty(TODAY) })).toBe(true);
    expect(isXpLocked({ penaltyQuest: makePenalty(TODAY, [20, 50, 120, 15], { status: 'completed' }) })).toBe(
      false,
    );
    expect(isXpLocked({ penaltyQuest: makePenalty(TODAY, undefined, { status: 'failed' }) })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rolloverDay
// ---------------------------------------------------------------------------

describe('rolloverDay (§6)', () => {
  describe('same day', () => {
    it("is a no-op when today's daily quest exists", () => {
      const state = deepFreeze(
        makeState({
          dailyQuest: makeQuest('daily', TODAY, [
            ['pushup', 10, 4],
            ['situp', 10],
            ['squat', 15],
            ['lunge', 12],
          ]),
          penaltyQuest: makePenalty('2026-11-19', [5, 0, 0, 0]),
        }),
      );
      const result = rolloverDay(state, TODAY);
      expect(result.changed).toBe(false);
      expect(result.events).toEqual([]);
      expect(result.archived).toEqual([]);
      expect(result.state).toEqual(state);
    });

    it('generates the daily quest when it is missing, without other changes', () => {
      const penalty = makePenalty('2026-11-19', [5, 0, 0, 0]);
      const state = deepFreeze(makeState({ dailyQuest: null, penaltyQuest: penalty }));
      const result = rolloverDay(state, TODAY);

      expect(result.changed).toBe(true);
      expectFreshDaily(result.state.dailyQuest, TODAY, [10, 10, 15, 12], 75);
      expect(result.state.penaltyQuest).toEqual(penalty);
      expect(result.state.player).toEqual(state.player);
      expect(result.state.lastRolloverDay).toBe(TODAY);
      expect(eventTypes(result.events)).toEqual(['new_daily']);
      expect(findEvent(result.events, 'new_daily').quest).toEqual(result.state.dailyQuest);
      expect(result.archived).toEqual([]);
    });
  });

  describe('clock moved backwards', () => {
    it.each([YESTERDAY, '2025-01-01'])('changes nothing when today is %s (< lastRolloverDay)', (today) => {
      const state = deepFreeze(
        makeState({
          lastRolloverDay: TODAY,
          dailyQuest: freshDaily(TODAY),
          penaltyQuest: makePenalty('2026-11-18', [3, 0, 0, 0]),
        }),
      );
      const result = rolloverDay(state, today);
      expect(result.changed).toBe(false);
      expect(result.events).toEqual([]);
      expect(result.archived).toEqual([]);
      expect(result.state).toEqual(state);
    });

    it('does not even generate a missing daily quest', () => {
      const state = deepFreeze(makeState({ lastRolloverDay: TODAY, dailyQuest: null }));
      const result = rolloverDay(state, YESTERDAY);
      expect(result.changed).toBe(false);
      expect(result.state.dailyQuest).toBeNull();
      expect(result.state.lastRolloverDay).toBe(TODAY);
    });
  });

  describe('next day', () => {
    it("archives a completed daily, opens no penalty and generates today's daily", () => {
      const previous = completedDaily(YESTERDAY);
      const state = deepFreeze(makeState({ lastRolloverDay: YESTERDAY, dailyQuest: previous }));
      const result = rolloverDay(state, TODAY);

      expect(result.changed).toBe(true);
      expect(result.state.penaltyQuest).toBeNull();
      expect(result.state.lastRolloverDay).toBe(TODAY);
      expectFreshDaily(result.state.dailyQuest, TODAY, [10, 10, 15, 12], 75);
      expect(eventTypes(result.events)).toEqual(['new_daily']);
      expect(findEvent(result.events, 'new_daily').quest).toEqual(result.state.dailyQuest);
      expect(result.archived).toEqual([previous]);
      expect(isXpLocked(result.state)).toBe(false);
    });

    it('fails an incomplete daily and opens a penalty quest for today', () => {
      const previous = makeQuest('daily', YESTERDAY, [
        ['pushup', 10, 6],
        ['situp', 10],
        ['squat', 15],
        ['lunge', 12],
      ]);
      const state = deepFreeze(makeState({ lastRolloverDay: YESTERDAY, dailyQuest: previous }));
      const result = rolloverDay(state, TODAY);

      expect(eventTypes(result.events)).toEqual(['daily_failed', 'penalty_started', 'new_daily']);

      const failed = findEvent(result.events, 'daily_failed');
      expect(failed.forgiven).toBe(false);
      expect(failed.quest).toEqual({ ...previous, status: 'failed' });
      expect(result.archived).toEqual([{ ...previous, status: 'failed' }]);

      expectFreshPenalty(result.state.penaltyQuest, TODAY);
      expect(findEvent(result.events, 'penalty_started').quest).toEqual(result.state.penaltyQuest);
      expect(isXpLocked(result.state)).toBe(true);

      expectFreshDaily(result.state.dailyQuest, TODAY, [10, 10, 15, 12], 75);
      expect(result.state.lastRolloverDay).toBe(TODAY);
    });

    it('counts a daily with 3 of 4 objectives done as missed', () => {
      const state = makeState({ lastRolloverDay: YESTERDAY, dailyQuest: dailyLungeLeft(YESTERDAY) });
      const result = rolloverDay(state, TODAY);
      expect(findEvent(result.events, 'daily_failed').forgiven).toBe(false);
      expectFreshPenalty(result.state.penaltyQuest, TODAY);
    });

    it('forgives the onboarding day (createdDay) daily: failed but no penalty', () => {
      const previous = freshDaily(YESTERDAY);
      const state = deepFreeze(
        makeState({ player: { createdDay: YESTERDAY }, lastRolloverDay: YESTERDAY, dailyQuest: previous }),
      );
      const result = rolloverDay(state, TODAY);

      expect(eventTypes(result.events)).toEqual(['daily_failed', 'new_daily']);
      const failed = findEvent(result.events, 'daily_failed');
      expect(failed.forgiven).toBe(true);
      expect(failed.quest.status).toBe('failed');
      expect(result.archived).toEqual([{ ...previous, status: 'failed' }]);
      expect(result.state.penaltyQuest).toBeNull();
      expect(isXpLocked(result.state)).toBe(false);
      expectFreshDaily(result.state.dailyQuest, TODAY, [10, 10, 15, 12], 75);
    });

    it('does not forgive the day after onboarding', () => {
      const state = makeState({
        player: { createdDay: '2026-11-19' },
        lastRolloverDay: YESTERDAY,
        dailyQuest: freshDaily(YESTERDAY),
      });
      const result = rolloverDay(state, TODAY);
      expect(findEvent(result.events, 'daily_failed').forgiven).toBe(false);
      expectFreshPenalty(result.state.penaltyQuest, TODAY);
    });

    it('opens no penalty when there was no previous daily quest', () => {
      const state = makeState({ lastRolloverDay: YESTERDAY, dailyQuest: null });
      const result = rolloverDay(state, TODAY);
      expect(eventTypes(result.events)).toEqual(['new_daily']);
      expect(result.archived).toEqual([]);
      expect(result.state.penaltyQuest).toBeNull();
    });

    it.each<[DayKey, DayKey]>([
      ['2026-11-30', '2026-12-01'], // month boundary
      ['2026-12-31', '2027-01-01'], // year boundary
      ['2027-02-28', '2027-03-01'], // non-leap February
      ['2028-02-28', '2028-02-29'], // leap day
      ['2026-03-07', '2026-03-08'], // US DST start
      ['2026-03-28', '2026-03-29'], // EU DST start
      ['2026-10-24', '2026-10-25'], // EU DST end
      ['2026-10-31', '2026-11-01'], // US DST end
    ])('treats %s → %s as consecutive days (completed daily → no penalty)', (last, today) => {
      const state = makeState({
        player: { createdDay: '2020-01-01' },
        lastRolloverDay: last,
        dailyQuest: completedDaily(last),
      });
      const result = rolloverDay(state, today);
      expect(eventTypes(result.events)).toEqual(['new_daily']);
      expect(result.state.penaltyQuest).toBeNull();
      expect(result.state.dailyQuest?.id).toBe(`daily-${today}`);
      expect(result.state.lastRolloverDay).toBe(today);
    });
  });

  describe('skipped days (gap ≥ 2)', () => {
    it.each<[DayKey, DayKey, number]>([
      ['2026-11-19', TODAY, 1], // diffDays 2 (boundary)
      ['2026-11-14', TODAY, 6], // diffDays 7
      ['2026-12-30', '2027-01-01', 1], // across the year
      ['2028-02-28', '2028-03-01', 1], // Feb 29 skipped in a leap year
    ])('opens a penalty after %s → %s even though the last daily was completed', (last, today, skipped) => {
      const previous = completedDaily(last);
      const state = deepFreeze(
        makeState({ player: { createdDay: '2020-01-01' }, lastRolloverDay: last, dailyQuest: previous }),
      );
      const result = rolloverDay(state, today);

      expect(eventTypes(result.events)).toEqual(['days_skipped', 'penalty_started', 'new_daily']);
      expect(findEvent(result.events, 'days_skipped').days).toBe(skipped);
      expectFreshPenalty(result.state.penaltyQuest, today);
      expect(result.state.dailyQuest?.id).toBe(`daily-${today}`);
      expect(result.state.lastRolloverDay).toBe(today);
      expect(result.archived).toEqual([previous]);
    });

    it('fails the stale daily and opens exactly one penalty when both rules apply', () => {
      const state = makeState({ lastRolloverDay: '2026-11-18', dailyQuest: freshDaily('2026-11-18') });
      const result = rolloverDay(state, TODAY);
      expect(eventTypes(result.events)).toEqual(['daily_failed', 'days_skipped', 'penalty_started', 'new_daily']);
      expect(findEvent(result.events, 'days_skipped').days).toBe(2);
      expectFreshPenalty(result.state.penaltyQuest, TODAY);
    });

    it('still opens a penalty when the forgiven onboarding day is followed by a skipped day', () => {
      const state = makeState({
        player: { createdDay: '2026-11-19' },
        lastRolloverDay: '2026-11-19',
        dailyQuest: freshDaily('2026-11-19'),
      });
      const result = rolloverDay(state, TODAY);
      expect(findEvent(result.events, 'daily_failed').forgiven).toBe(true);
      expect(findEvent(result.events, 'days_skipped').days).toBe(1);
      expectFreshPenalty(result.state.penaltyQuest, TODAY);
    });
  });

  describe('existing penalty quest', () => {
    it('keeps an active penalty instead of stacking a new one (penalty_continues)', () => {
      const penalty = makePenalty('2026-11-15', [20, 10, 0, 3]);
      const previous = freshDaily(YESTERDAY);
      const state = deepFreeze(makeState({ lastRolloverDay: YESTERDAY, dailyQuest: previous, penaltyQuest: penalty }));
      const result = rolloverDay(state, TODAY);

      expect(eventTypes(result.events)).toEqual(['daily_failed', 'penalty_continues', 'new_daily']);
      expect(findEvent(result.events, 'penalty_continues').quest).toEqual(penalty);
      expect(result.state.penaltyQuest).toEqual(penalty); // same id, progress kept
      expect(result.state.penaltyQuest?.id).toBe('penalty-2026-11-15');
      expect(result.archived).toEqual([{ ...previous, status: 'failed' }]);
    });

    it('does not stack penalties after a multi-day gap either', () => {
      const penalty = makePenalty('2026-11-10', [0, 0, 60, 0]);
      const state = makeState({
        lastRolloverDay: '2026-11-17',
        dailyQuest: completedDaily('2026-11-17'),
        penaltyQuest: penalty,
      });
      const result = rolloverDay(state, TODAY);
      expect(eventTypes(result.events)).toEqual(['days_skipped', 'penalty_continues', 'new_daily']);
      expect(result.state.penaltyQuest).toEqual(penalty);
    });

    it('keeps an active penalty across the day change when nothing was missed', () => {
      const penalty = makePenalty('2026-11-18', [10, 0, 0, 0]);
      const state = makeState({
        lastRolloverDay: YESTERDAY,
        dailyQuest: completedDaily(YESTERDAY),
        penaltyQuest: penalty,
      });
      const result = rolloverDay(state, TODAY);
      expect(eventTypes(result.events)).toEqual(['new_daily']);
      expect(result.state.penaltyQuest).toEqual(penalty);
      expect(isXpLocked(result.state)).toBe(true);
    });

    it('archives and removes a completed penalty', () => {
      const penalty = makePenalty('2026-11-18', [20, 50, 120, 15], { status: 'completed', completedAt: EARLIER });
      const previous = completedDaily(YESTERDAY);
      const state = deepFreeze(makeState({ lastRolloverDay: YESTERDAY, dailyQuest: previous, penaltyQuest: penalty }));
      const result = rolloverDay(state, TODAY);

      expect(result.state.penaltyQuest).toBeNull();
      expect(eventTypes(result.events)).toEqual(['new_daily']);
      expect(result.archived).toHaveLength(2);
      expect(result.archived).toEqual(expect.arrayContaining([previous, penalty]));
    });

    it('archives and removes a failed penalty', () => {
      const penalty = makePenalty('2026-11-18', [1, 2, 3, 4], { status: 'failed' });
      const state = makeState({
        lastRolloverDay: YESTERDAY,
        dailyQuest: completedDaily(YESTERDAY),
        penaltyQuest: penalty,
      });
      const result = rolloverDay(state, TODAY);
      expect(result.state.penaltyQuest).toBeNull();
      expect(result.archived).toContainEqual(penalty);
    });

    it('replaces a completed penalty with a fresh one when the day was missed again', () => {
      const old = makePenalty('2026-11-18', [20, 50, 120, 15], { status: 'completed', completedAt: EARLIER });
      const previous = freshDaily(YESTERDAY);
      const state = makeState({ lastRolloverDay: YESTERDAY, dailyQuest: previous, penaltyQuest: old });
      const result = rolloverDay(state, TODAY);

      expect(eventTypes(result.events)).toEqual(['daily_failed', 'penalty_started', 'new_daily']);
      expectFreshPenalty(result.state.penaltyQuest, TODAY);
      expect(result.archived).toHaveLength(2);
      expect(result.archived).toEqual(expect.arrayContaining([{ ...previous, status: 'failed' }, old]));
    });
  });

  describe('generated quests', () => {
    it.each<[number, [number, number, number, number]]>([
      [1, [20, 50, 120, 15]],
      // lf 1.24: burpee 24.8→25, squat 62→60, plank 148.8→150, run 18.6→19
      [4, [25, 60, 150, 19]],
      // lf 1.4: burpee 28→30, squat 70, plank 168→170, run 21
      [6, [30, 70, 170, 21]],
      // lf 9: 180/450/1080/135 clamped to the max 150/300/900/90
      [101, [150, 300, 900, 90]],
    ])('scales the penalty with level %i only (no stat factor)', (level, targets) => {
      // Stats of 40 would give statFactor 2.2 if it were (wrongly) applied.
      const state = makeState({
        player: { level, stats: statsOf(40) },
        lastRolloverDay: YESTERDAY,
        dailyQuest: freshDaily(YESTERDAY),
      });
      expectFreshPenalty(rolloverDay(state, TODAY).state.penaltyQuest, TODAY, targets);
    });

    it.each<[string, number, Stats, [number, number, number, number], number]>([
      ['level 1, all stats 10', 1, statsOf(10), [10, 10, 15, 12], 75],
      // lf 1.24: 12.4→12, 12.4→12, 18.6→19, 14.88→15; reward 50+25·4
      ['level 4, all stats 10', 4, statsOf(10), [12, 12, 19, 15], 150],
      // sf(str 20)=1.4, sf(end 30)=1.8: 14, 18, 21→20 (≥20 → nearest 5), 16.8→17
      [
        'level 1, mixed stats',
        1,
        { strength: 20, endurance: 30, agility: 25, vitality: 25, flexibility: 25 },
        [14, 18, 20, 17],
        75,
      ],
      // sf clamps to 0.8: 8, 8, 12, 9.6→10
      ['level 1, all stats 1', 1, statsOf(1), [8, 8, 12, 10], 75],
      // lf 9 · sf 3 → 270/270/405/324 clamped to 150/150/200/150; reward 50+25·101
      ['level 101, all stats 999', 101, statsOf(999), [150, 150, 200, 150], 2575],
    ])("generates today's daily scaled to the player (%s)", (_label, level, stats, targets, reward) => {
      const state = makeState({
        player: { level, stats },
        lastRolloverDay: YESTERDAY,
        dailyQuest: completedDaily(YESTERDAY),
      });
      const result = rolloverDay(state, TODAY);
      expectFreshDaily(result.state.dailyQuest, TODAY, targets, reward);
      expect(findEvent(result.events, 'new_daily').quest).toEqual(result.state.dailyQuest);
    });
  });

  describe('invariants', () => {
    it('never changes the player', () => {
      const state = makeState({
        player: { level: 7, xp: 123, totalXp: 4000, unspentPoints: 2, statXp: statsOf(5) },
        lastRolloverDay: '2026-11-15',
        dailyQuest: freshDaily('2026-11-15'),
      });
      expect(rolloverDay(state, TODAY).state.player).toEqual(state.player);
    });

    it('is pure (input not mutated) and deterministic', () => {
      const state = deepFreeze(
        makeState({
          lastRolloverDay: '2026-11-18',
          dailyQuest: freshDaily('2026-11-18'),
          penaltyQuest: makePenalty('2026-11-10', [20, 50, 120, 15], { status: 'completed', completedAt: EARLIER }),
        }),
      );
      const snapshot = structuredClone(state);
      const a = rolloverDay(state, TODAY);
      const b = rolloverDay(state, TODAY);
      expect(a).toEqual(b);
      expect(state).toEqual(snapshot);
    });

    it('is idempotent: rolling over to the same day again changes nothing', () => {
      const first = rolloverDay(makeState({ lastRolloverDay: YESTERDAY, dailyQuest: freshDaily(YESTERDAY) }), TODAY);
      const second = rolloverDay(first.state, TODAY);
      expect(second.changed).toBe(false);
      expect(second.events).toEqual([]);
      expect(second.state).toEqual(first.state);
    });
  });
});

// ---------------------------------------------------------------------------
// applyExerciseLogs
// ---------------------------------------------------------------------------

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

describe('applyExerciseLogs (§4, §5)', () => {
  describe('exercise XP and stat XP shares', () => {
    // [exercise, amount, round(amount·xpPerUnit), round(baseXp·weight) per stat]
    it.each<[ExerciseId, number, number, Partial<Stats>]>([
      ['pushup', 10, 10, { strength: 7, endurance: 3 }],
      ['situp', 7, 6, { endurance: 3, strength: 2 }], // 5.6→6; 3.36→3, 2.24→2
      ['squat', 3, 2, { strength: 1, agility: 1 }], // 2.4→2; 1.44→1, 0.96→1
      ['plank', 45, 23, { endurance: 16, vitality: 7 }], // 22.5→23; 15.75→16, 6.75→7
      ['pullup', 10, 30, { strength: 24, endurance: 6 }],
      ['lunge', 12, 10, { strength: 5, agility: 5 }], // 9.6→10; 4.8→5, 4.8→5
      ['burpee', 8, 16, { agility: 8, endurance: 5, strength: 3 }], // 4.8→5, 3.2→3
      ['jumping_jack', 5, 2, { agility: 1, vitality: 1 }], // 1.5→2; 0.9→1, 0.6→1
      ['jumping_jack', 1, 0, {}], // 0.3→0; 0.18→0, 0.12→0
      ['jump_rope', 3, 18, { agility: 13, endurance: 5 }], // 12.6→13, 5.4→5
      ['run', 10, 80, { endurance: 40, vitality: 40 }],
      ['walk', 15, 45, { vitality: 36, endurance: 9 }],
      ['stretch', 5, 20, { flexibility: 20 }],
      ['yoga', 10, 50, { flexibility: 35, vitality: 15 }],
    ])('%s × %i → %i XP', (exerciseId, amount, xp, shares) => {
      const state = makeState({ dailyQuest: null });
      const result = applyExerciseLogs(state, [{ exerciseId, amount }], NOW);

      expect(result.xpLocked).toBe(false);
      expect(result.entryXp).toEqual([xp]);
      expect(result.exerciseXp).toBe(xp);
      expect(result.questRewardXp).toBe(0);
      expect(result.totalXp).toBe(xp);
      expect(result.state.player.xp).toBe(xp);
      expect(result.state.player.totalXp).toBe(xp);
      expect(result.state.player.level).toBe(1);
      expect(nonZero(result.statXpGained)).toEqual(shares);
      // All stats are 10 → the next point needs 20 + 5·10 = 70, so shares stay as statXp.
      expect(result.state.player.statXp).toEqual({ ...statsOf(0), ...shares });
      expect(result.state.player.stats).toEqual(statsOf(10));
      expect(nonZero(result.statIncreases)).toEqual({});
    });

    it('reports XP per entry in input order and sums it', () => {
      const entries: ExerciseEntry[] = [
        { exerciseId: 'pushup', amount: 10 },
        { exerciseId: 'situp', amount: 7 },
        { exerciseId: 'plank', amount: 45 },
        { exerciseId: 'jumping_jack', amount: 1 },
        { exerciseId: 'squat', amount: 3 },
      ];
      const result = applyExerciseLogs(makeState({ dailyQuest: null }), entries, NOW);
      expect(result.entryXp).toEqual([10, 6, 23, 0, 2]);
      expect(result.exerciseXp).toBe(41);
      expect(result.totalXp).toBe(41);
      expect(result.state.player.xp).toBe(41);
      // strength 7+2+1, endurance 3+3+16, agility 1, vitality 7
      expect(nonZero(result.statXpGained)).toEqual({ strength: 10, endurance: 22, agility: 1, vitality: 7 });
    });

    it('rounds per set, not on the sum', () => {
      // 2 × round(3·0.8 = 2.4) = 4, while round(4.8) would be 5.
      const result = applyExerciseLogs(
        makeState({ dailyQuest: null }),
        [
          { exerciseId: 'squat', amount: 3 },
          { exerciseId: 'squat', amount: 3 },
        ],
        NOW,
      );
      expect(result.entryXp).toEqual([2, 2]);
      expect(result.exerciseXp).toBe(4);
      // strength 2 × round(1.44) = 2, agility 2 × round(0.96) = 2
      expect(nonZero(result.statXpGained)).toEqual({ strength: 2, agility: 2 });
    });

    it('handles an empty entry list as a no-op', () => {
      const state = deepFreeze(makeState());
      const result = applyExerciseLogs(state, [], NOW);
      expect(result.state).toEqual(state);
      expect(result.entryXp).toEqual([]);
      expect(result.totalXp).toBe(0);
      expect(result.levelsGained).toBe(0);
      expect(result.completedQuests).toEqual([]);
    });
  });

  describe('stat growth from training (statXpToNextPoint = 20 + 5·v)', () => {
    it('raises a stat by one point at exactly the threshold', () => {
      // strength 10 needs 70: 63 + 7 (pushup 10) = 70 → 11, remainder 0
      const state = makeState({ dailyQuest: null, player: { statXp: statsOf(0, { strength: 63 }) } });
      const result = applyExerciseLogs(state, [{ exerciseId: 'pushup', amount: 10 }], NOW);
      expect(result.state.player.stats.strength).toBe(11);
      expect(result.state.player.statXp.strength).toBe(0);
      expect(nonZero(result.statIncreases)).toEqual({ strength: 1 });
      expect(result.state.player.stats.endurance).toBe(10);
      expect(result.state.player.statXp.endurance).toBe(3);
    });

    it('does not raise a stat one XP short of the threshold', () => {
      const state = makeState({ dailyQuest: null, player: { statXp: statsOf(0, { strength: 62 }) } });
      const result = applyExerciseLogs(state, [{ exerciseId: 'pushup', amount: 10 }], NOW);
      expect(result.state.player.stats.strength).toBe(10);
      expect(result.state.player.statXp.strength).toBe(69);
      expect(nonZero(result.statIncreases)).toEqual({});
    });

    it('can raise a stat by several points from one set', () => {
      // pullup 50 → baseXp 150: strength 120, endurance 30.
      // strength 2: 120 −30 (v2) −35 (v3) −40 (v4) = 15 < 45 (v5) → 5, statXp 15
      // endurance 1: 30 −25 (v1) = 5 < 30 (v2) → 2, statXp 5
      const state = makeState({
        dailyQuest: null,
        player: { stats: statsOf(10, { strength: 2, endurance: 1 }) },
      });
      const result = applyExerciseLogs(state, [{ exerciseId: 'pullup', amount: 50 }], NOW);
      expect(result.state.player.stats).toEqual(statsOf(10, { strength: 5, endurance: 2 }));
      expect(result.state.player.statXp).toEqual(statsOf(0, { strength: 15, endurance: 5 }));
      expect(nonZero(result.statIncreases)).toEqual({ strength: 3, endurance: 1 });
      expect(nonZero(result.statXpGained)).toEqual({ strength: 120, endurance: 30 });
    });

    it('accumulates stat XP across entries of the same batch', () => {
      // 2 × pushup 50 → strength 35 + 35 = 70 = 20 + 5·10 → +1
      const result = applyExerciseLogs(
        makeState({ dailyQuest: null }),
        [
          { exerciseId: 'pushup', amount: 50 },
          { exerciseId: 'pushup', amount: 50 },
        ],
        NOW,
      );
      expect(result.state.player.stats.strength).toBe(11);
      expect(result.state.player.statXp.strength).toBe(0);
      expect(nonZero(result.statIncreases)).toEqual({ strength: 1 });
      expect(nonZero(result.statXpGained)).toEqual({ strength: 70, endurance: 30 });
    });

    it('stops at 999 and keeps the surplus stat XP', () => {
      const atCap = makeState({ dailyQuest: null, player: { stats: statsOf(10, { strength: 999 }) } });
      const capped = applyExerciseLogs(atCap, [{ exerciseId: 'pushup', amount: 100 }], NOW);
      expect(capped.state.player.stats.strength).toBe(999);
      expect(capped.state.player.statXp.strength).toBe(70);
      expect(capped.statIncreases.strength ?? 0).toBe(0);

      // 998 needs 20 + 5·998 = 5010: 5000 + 70 = 5070 → 999, surplus 60 kept
      const nearCap = makeState({
        dailyQuest: null,
        player: { stats: statsOf(10, { strength: 998 }), statXp: statsOf(0, { strength: 5000 }) },
      });
      const reached = applyExerciseLogs(nearCap, [{ exerciseId: 'pushup', amount: 100 }], NOW);
      expect(reached.state.player.stats.strength).toBe(999);
      expect(reached.state.player.statXp.strength).toBe(60);
      expect(reached.statIncreases.strength).toBe(1);
    });
  });

  describe('quest progress', () => {
    it('adds progress to matching objectives only and caps it at the target', () => {
      const result = applyExerciseLogs(
        makeState(),
        [
          { exerciseId: 'pushup', amount: 25 },
          { exerciseId: 'pullup', amount: 5 },
          { exerciseId: 'situp', amount: 4 },
          { exerciseId: 'situp', amount: 4 },
          { exerciseId: 'situp', amount: 5 },
        ],
        NOW,
      );
      expect(objectiveTuples(result.state.dailyQuest)).toEqual([
        ['pushup', 10, 10],
        ['situp', 10, 10],
        ['squat', 15, 0],
        ['lunge', 12, 0],
      ]);
      expect(result.state.dailyQuest?.status).toBe('active');
      // The full amount still earns XP even past the cap: 25, 5·3=15, round(3.2)=3, 3, round(4)=4.
      // §10: the 5th set (5 sit-ups) beats the record of 4 set by the 3rd → boss bonus 30 + 10·1 = 40.
      expect(result.entryXp).toEqual([25, 15, 3, 3, 44]);
      expect(result.exerciseXp).toBe(25 + 15 + 3 + 3 + 4);
      expect(result.recordBonusXp).toBe(40);
    });

    it('progresses the penalty and the daily quest from the same set', () => {
      const state = makeState({ penaltyQuest: makePenalty(YESTERDAY) });
      const result = applyExerciseLogs(state, [{ exerciseId: 'squat', amount: 20 }], NOW);
      expect(objectiveTuples(result.state.penaltyQuest)).toEqual([
        ['burpee', 20, 0],
        ['squat', 50, 20],
        ['plank', 120, 0],
        ['run', 15, 0],
      ]);
      expect(objectiveTuples(result.state.dailyQuest)).toEqual([
        ['pushup', 10, 0],
        ['situp', 10, 0],
        ['squat', 15, 15],
        ['lunge', 12, 0],
      ]);
    });

    it('stays active until every objective reaches its target', () => {
      const almost = applyExerciseLogs(makeState({ dailyQuest: dailyLungeLeft() }), [{ exerciseId: 'lunge', amount: 11 }], NOW);
      expect(almost.state.dailyQuest?.status).toBe('active');
      expect(almost.questRewardXp).toBe(0);
      expect(almost.completedQuests).toEqual([]);

      const done = applyExerciseLogs(almost.state, [{ exerciseId: 'lunge', amount: 1 }], NOW);
      expect(done.state.dailyQuest?.status).toBe('completed');
      expect(done.questRewardXp).toBe(75);
    });
  });

  describe('daily quest reward (§5)', () => {
    it('completes the daily and grants rewardXp to level XP only', () => {
      const state = deepFreeze(makeState({ dailyQuest: dailyLungeLeft() }));
      const result = applyExerciseLogs(state, [{ exerciseId: 'lunge', amount: 12 }], NOW);
      const quest = must(result.state.dailyQuest);

      expect(quest.status).toBe('completed');
      expect(quest.completedAt).toBe(NOW);
      expect(quest.awardedXp).toBe(75);
      expect(objectiveTuples(quest)[3]).toEqual(['lunge', 12, 12]);
      expect(result.completedQuests).toEqual([quest]);
      expect(result.forfeitedQuests).toEqual([]);

      expect(result.entryXp).toEqual([10]); // round(9.6)
      expect(result.exerciseXp).toBe(10);
      expect(result.questRewardXp).toBe(75);
      expect(result.totalXp).toBe(85);
      expect(result.state.player.xp).toBe(85);
      expect(result.state.player.totalXp).toBe(85);
      // The reward adds no stat XP: only the lunge shares (4.8→5, 4.8→5).
      expect(nonZero(result.statXpGained)).toEqual({ strength: 5, agility: 5 });
    });

    it('grants the reward only once within a batch', () => {
      const result = applyExerciseLogs(
        makeState({ dailyQuest: dailyLungeLeft() }),
        [
          { exerciseId: 'lunge', amount: 12 },
          { exerciseId: 'lunge', amount: 12 },
        ],
        NOW,
      );
      expect(result.questRewardXp).toBe(75);
      expect(result.exerciseXp).toBe(20);
      expect(result.totalXp).toBe(95);
      expect(result.completedQuests).toHaveLength(1);
    });

    it('does not grant the reward again on later logs', () => {
      const first = applyExerciseLogs(makeState({ dailyQuest: dailyLungeLeft() }), [{ exerciseId: 'lunge', amount: 12 }], EARLIER);
      const second = applyExerciseLogs(first.state, [{ exerciseId: 'lunge', amount: 12 }], NOW);
      expect(second.questRewardXp).toBe(0);
      expect(second.completedQuests).toEqual([]);
      expect(second.totalXp).toBe(10);
      expect(second.state.dailyQuest).toEqual(first.state.dailyQuest); // awardedXp / completedAt unchanged
      expect(second.state.player.xp).toBe(95);
    });

    it("uses the quest's stored rewardXp, not the player's current level", () => {
      // Quest generated at level 1 (75 XP); the player is level 3 by now (would be 125).
      const state = makeState({ player: { level: 3 }, dailyQuest: dailyLungeLeft() });
      const result = applyExerciseLogs(state, [{ exerciseId: 'lunge', amount: 12 }], NOW);
      expect(result.questRewardXp).toBe(75);
      expect(result.state.dailyQuest?.awardedXp).toBe(75);
    });

    it('can level the player up through the reward', () => {
      // 90 + 10 + 75 = 175 → level 2 with 175 − 100 = 75
      const state = makeState({ player: { xp: 90 }, dailyQuest: dailyLungeLeft() });
      const result = applyExerciseLogs(state, [{ exerciseId: 'lunge', amount: 12 }], NOW);
      expect(result.state.player.level).toBe(2);
      expect(result.state.player.xp).toBe(75);
      expect(result.levelsGained).toBe(1);
      expect(result.state.player.unspentPoints).toBe(3);
    });
  });

  describe('levels (§3)', () => {
    it('levels up several times from one set and grants +3 points per level', () => {
      // run 60 → 480 XP: −100 (L1) −283 (L2) = 97 < 520 (L3)
      const state = makeState({ dailyQuest: null, player: { unspentPoints: 2 } });
      const result = applyExerciseLogs(state, [{ exerciseId: 'run', amount: 60 }], NOW);
      expect(result.fromLevel).toBe(1);
      expect(result.toLevel).toBe(3);
      expect(result.levelsGained).toBe(2);
      expect(result.pointsGained).toBe(6);
      expect(result.state.player.level).toBe(3);
      expect(result.state.player.xp).toBe(97);
      expect(result.state.player.totalXp).toBe(480);
      expect(result.state.player.unspentPoints).toBe(8);
    });

    it('handles a very large set (6 levels at once)', () => {
      // run 600 → 4800: −100 −283 −520 −800 −1118 −1470 = 509 < 1852 (L7)
      const result = applyExerciseLogs(makeState({ dailyQuest: null }), [{ exerciseId: 'run', amount: 600 }], NOW);
      expect(result.state.player.level).toBe(7);
      expect(result.state.player.xp).toBe(509);
      expect(result.levelsGained).toBe(6);
      expect(result.pointsGained).toBe(18);
      expect(result.state.player.unspentPoints).toBe(18);
    });

    it.each<[number, number, number, number, number]>([
      // [level, xp, pushups, expected level, expected xp]
      [1, 90, 10, 2, 0], // exactly 100
      [1, 89, 10, 1, 99], // one short
      [4, 799, 1, 5, 0], // exactly 800
      [4, 798, 1, 4, 799],
      [10, 3100, 80, 11, 18], // 3180 − 3162
    ])('level %i with %i XP + %i XP → level %i, %i XP', (level, xp, amount, toLevel, toXp) => {
      const state = makeState({ dailyQuest: null, player: { level, xp } });
      const result = applyExerciseLogs(state, [{ exerciseId: 'pushup', amount }], NOW);
      expect(result.state.player.level).toBe(toLevel);
      expect(result.state.player.xp).toBe(toXp);
      expect(result.levelsGained).toBe(toLevel - level);
      expect(result.pointsGained).toBe(3 * (toLevel - level));
    });

    it('levels up across entries of the same batch', () => {
      const result = applyExerciseLogs(
        makeState({ dailyQuest: null }),
        [
          { exerciseId: 'pushup', amount: 60 },
          { exerciseId: 'pushup', amount: 60 },
        ],
        NOW,
      );
      expect(result.state.player.level).toBe(2);
      expect(result.state.player.xp).toBe(20);
      expect(result.levelsGained).toBe(1);
    });
  });

  describe('XP lock while a penalty quest is active (§4, §6)', () => {
    it('grants no level XP and no stat XP, but still records quest progress', () => {
      const state = deepFreeze(
        makeState({
          player: { xp: 99, statXp: statsOf(0, { strength: 69 }) },
          penaltyQuest: makePenalty(YESTERDAY),
        }),
      );
      const result = applyExerciseLogs(
        state,
        [
          { exerciseId: 'pushup', amount: 100 },
          { exerciseId: 'burpee', amount: 5 },
        ],
        NOW,
      );

      expect(result.xpLocked).toBe(true);
      expect(result.entryXp).toEqual([0, 0]);
      expect(result.exerciseXp).toBe(0);
      expect(result.questRewardXp).toBe(0);
      expect(result.totalXp).toBe(0);
      expect(result.levelsGained).toBe(0);
      expect(nonZero(result.statXpGained)).toEqual({});
      expect(nonZero(result.statIncreases)).toEqual({});
      // §10: records still update while XP is locked (no bonus); everything else is unchanged.
      expect({ ...result.state.player, records: state.player.records }).toEqual(state.player);
      expect(result.recordBonusXp).toBe(0);

      expect(objectiveTuples(result.state.penaltyQuest)[0]).toEqual(['burpee', 20, 5]);
      expect(objectiveTuples(result.state.dailyQuest)[0]).toEqual(['pushup', 10, 10]);
    });

    it('decides the lock per entry at its start: the completing entry earns 0, later ones earn XP', () => {
      // Only 5 min of running left on the penalty.
      const state = makeState({ penaltyQuest: makePenalty(YESTERDAY, [20, 50, 120, 10]) });
      const result = applyExerciseLogs(
        state,
        [
          { exerciseId: 'run', amount: 5 },
          { exerciseId: 'run', amount: 5 },
        ],
        NOW,
      );

      expect(result.xpLocked).toBe(true);
      expect(result.entryXp).toEqual([0, 40]);
      expect(result.exerciseXp).toBe(40);
      expect(result.state.player.xp).toBe(40);
      expect(nonZero(result.statXpGained)).toEqual({ endurance: 20, vitality: 20 });

      const penalty = must(result.state.penaltyQuest);
      expect(penalty.status).toBe('completed');
      expect(penalty.completedAt).toBe(NOW);
      expect(objectiveTuples(penalty)[3]).toEqual(['run', 15, 15]);
      expect(result.completedQuests.map((q) => q.id)).toEqual(['penalty-2026-11-20']);
      expect(isXpLocked(result.state)).toBe(false);
    });

    it('keeps every entry locked until the penalty is actually completed', () => {
      // run 10/15: +3 → 13 (still active), +3 → 15 (completes) — both entries start locked.
      const state = makeState({ penaltyQuest: makePenalty(YESTERDAY, [20, 50, 120, 10]) });
      const result = applyExerciseLogs(
        state,
        [
          { exerciseId: 'run', amount: 3 },
          { exerciseId: 'run', amount: 3 },
        ],
        NOW,
      );
      expect(result.entryXp).toEqual([0, 0]);
      expect(result.state.penaltyQuest?.status).toBe('completed');
    });

    it('forfeits the daily reward when the daily is completed while locked', () => {
      const state = makeState({ dailyQuest: dailyLungeLeft(), penaltyQuest: makePenalty(YESTERDAY) });
      const result = applyExerciseLogs(state, [{ exerciseId: 'lunge', amount: 12 }], NOW);
      const quest = must(result.state.dailyQuest);

      expect(quest.status).toBe('completed');
      expect(quest.completedAt).toBe(NOW);
      expect(quest.awardedXp).toBe(0);
      expect(result.questRewardXp).toBe(0);
      expect(result.totalXp).toBe(0);
      expect(result.forfeitedQuests).toEqual([quest]);
      expect(result.completedQuests).toEqual([quest]);
      expect(result.state.player.xp).toBe(0);
    });

    it('does not restore a forfeited reward when the penalty is finished later in the batch', () => {
      const state = makeState({
        dailyQuest: dailyLungeLeft(),
        penaltyQuest: makePenalty(YESTERDAY, [20, 50, 120, 0]),
      });
      const result = applyExerciseLogs(
        state,
        [
          { exerciseId: 'lunge', amount: 12 }, // completes the daily while locked → forfeited
          { exerciseId: 'run', amount: 15 }, // completes the penalty, still 0 XP
          { exerciseId: 'pushup', amount: 10 }, // unlocked → 10 XP
        ],
        NOW,
      );
      expect(result.entryXp).toEqual([0, 0, 10]);
      expect(result.exerciseXp).toBe(10);
      expect(result.questRewardXp).toBe(0);
      expect(result.totalXp).toBe(10);
      expect(result.state.dailyQuest?.awardedXp).toBe(0);
      expect(result.forfeitedQuests.map((q) => q.id)).toEqual(['daily-2026-11-21']);
      expect(result.completedQuests.map((q) => q.id)).toEqual(['daily-2026-11-21', 'penalty-2026-11-20']);
      expect(nonZero(result.statXpGained)).toEqual({ strength: 7, endurance: 3 });

      // Logging the daily exercise again afterwards still grants nothing.
      const later = applyExerciseLogs(result.state, [{ exerciseId: 'lunge', amount: 12 }], NOW);
      expect(later.questRewardXp).toBe(0);
      expect(later.entryXp).toEqual([10]);
    });

    it('grants the daily reward when the same set completes the penalty first', () => {
      // 10 squats finish both the penalty (40/50) and the daily (5/15).
      const state = makeState({
        dailyQuest: makeQuest('daily', TODAY, [
          ['pushup', 10, 10],
          ['situp', 10, 10],
          ['squat', 15, 5],
          ['lunge', 12, 12],
        ]),
        penaltyQuest: makePenalty(YESTERDAY, [20, 40, 120, 15]),
      });
      const result = applyExerciseLogs(state, [{ exerciseId: 'squat', amount: 10 }], NOW);

      expect(result.xpLocked).toBe(true);
      expect(result.entryXp).toEqual([0]); // exercise XP still locked for this set
      expect(nonZero(result.statXpGained)).toEqual({});
      expect(result.state.penaltyQuest?.status).toBe('completed');
      expect(result.state.dailyQuest?.status).toBe('completed');
      expect(result.state.dailyQuest?.awardedXp).toBe(75);
      expect(result.questRewardXp).toBe(75);
      expect(result.totalXp).toBe(75);
      expect(result.forfeitedQuests).toEqual([]);
      expect(result.completedQuests.map((q) => q.kind).sort()).toEqual(['daily', 'penalty']);
      expect(result.state.player.xp).toBe(75);
    });

    it('is not locked by a completed (not yet archived) penalty', () => {
      const state = makeState({
        dailyQuest: null,
        penaltyQuest: makePenalty(YESTERDAY, [20, 50, 120, 15], { status: 'completed', completedAt: EARLIER }),
      });
      const result = applyExerciseLogs(state, [{ exerciseId: 'pushup', amount: 10 }], NOW);
      expect(result.xpLocked).toBe(false);
      expect(result.entryXp).toEqual([10]);
      expect(result.state.penaltyQuest).toEqual(state.penaltyQuest);
    });
  });

  describe('validation', () => {
    it.each<[ExerciseId, number]>([
      ['pushup', 0],
      ['pushup', -1],
      ['pushup', 1001],
      ['pushup', 2.5],
      ['pushup', Number.NaN],
      ['pushup', Number.POSITIVE_INFINITY],
      ['plank', 0],
      ['plank', 7201],
      ['run', 0],
      ['run', 601],
      ['stretch', 1.5],
    ])('rejects %s × %d with GameRuleError(invalid_amount)', (exerciseId, amount) => {
      expectRuleError(() => applyExerciseLogs(makeState(), [{ exerciseId, amount }], NOW), 'invalid_amount');
    });

    it.each<[ExerciseId, number]>([
      ['pushup', 1],
      ['pushup', 1000],
      ['plank', 1],
      ['plank', 7200],
      ['run', 1],
      ['run', 600],
    ])('accepts the boundary amount %s × %d', (exerciseId, amount) => {
      expect(() => applyExerciseLogs(makeState(), [{ exerciseId, amount }], NOW)).not.toThrow();
    });

    it('rejects an unknown exercise with GameRuleError', () => {
      const entry = { exerciseId: 'deadlift', amount: 10 } as unknown as ExerciseEntry;
      expectRuleError(() => applyExerciseLogs(makeState(), [entry], NOW));
    });

    it('applies nothing when any entry of the batch is invalid', () => {
      const state = deepFreeze(makeState({ dailyQuest: dailyLungeLeft() }));
      const snapshot = structuredClone(state);
      expectRuleError(
        () =>
          applyExerciseLogs(
            state,
            [
              { exerciseId: 'lunge', amount: 12 },
              { exerciseId: 'pushup', amount: 0 },
            ],
            NOW,
          ),
        'invalid_amount',
      );
      expect(state).toEqual(snapshot);
    });
  });

  describe('invariants', () => {
    const entries: ExerciseEntry[] = [
      { exerciseId: 'run', amount: 5 }, // completes the penalty (locked → 0 XP)
      { exerciseId: 'lunge', amount: 12 }, // completes the daily (+75)
      { exerciseId: 'pushup', amount: 100 },
      { exerciseId: 'plank', amount: 45 },
    ];
    const buildState = () =>
      makeState({
        player: { xp: 50, unspentPoints: 1 },
        dailyQuest: dailyLungeLeft(),
        penaltyQuest: makePenalty(YESTERDAY, [20, 50, 120, 10]),
      });

    it('does not mutate its inputs', () => {
      const state = deepFreeze(buildState());
      const frozenEntries = deepFreeze(entries.map((e) => ({ ...e })));
      const snapshot = structuredClone(state);
      applyExerciseLogs(state, frozenEntries, NOW);
      expect(state).toEqual(snapshot);
      expect(frozenEntries).toEqual(entries);
    });

    it('is deterministic', () => {
      expect(applyExerciseLogs(buildState(), entries, NOW)).toEqual(applyExerciseLogs(buildState(), entries, NOW));
    });

    it('keeps the summary fields consistent', () => {
      const state = buildState();
      const result = applyExerciseLogs(state, entries, NOW);
      // entryXp: 0, 10, 100, 23 → exercise 133; reward 75; 50 + 208 = 258 → L2 (−100) 158 < 283
      expect(result.entryXp).toEqual([0, 10, 100, 23]);
      expect(sum(result.entryXp)).toBe(result.exerciseXp);
      expect(result.totalXp).toBe(result.exerciseXp + result.questRewardXp);
      expect(result.totalXp).toBe(208);
      expect(result.state.player.totalXp - state.player.totalXp).toBe(result.totalXp);
      expect(result.toLevel - result.fromLevel).toBe(result.levelsGained);
      expect(result.pointsGained).toBe(3 * result.levelsGained);
      expect(result.state.player.level).toBe(2);
      expect(result.state.player.xp).toBe(158);
      expect(result.state.player.unspentPoints).toBe(4);
    });

    it('applyExerciseLog(entry) equals applyExerciseLogs([entry])', () => {
      const entry: ExerciseEntry = { exerciseId: 'lunge', amount: 12 };
      const state = makeState({ dailyQuest: dailyLungeLeft() });
      expect(applyExerciseLog(state, entry, NOW)).toEqual(applyExerciseLogs(state, [entry], NOW));
    });
  });
});

// ---------------------------------------------------------------------------
// submitRankExam
// ---------------------------------------------------------------------------

interface RankCase {
  from: Rank;
  target: Rank;
  minLevel: number;
  thresholds: BaselineTest;
  reward: number;
}

// §7 table; reward = 250 · index(target) with D=1 … S=5.
const RANK_CASES: RankCase[] = [
  { from: 'E', target: 'D', minLevel: 5, thresholds: { pushups: 20, situps: 25, squats: 30, plankSeconds: 60 }, reward: 250 },
  { from: 'D', target: 'C', minLevel: 12, thresholds: { pushups: 35, situps: 40, squats: 50, plankSeconds: 90 }, reward: 500 },
  { from: 'C', target: 'B', minLevel: 22, thresholds: { pushups: 50, situps: 55, squats: 75, plankSeconds: 150 }, reward: 750 },
  { from: 'B', target: 'A', minLevel: 35, thresholds: { pushups: 70, situps: 75, squats: 100, plankSeconds: 210 }, reward: 1000 },
  { from: 'A', target: 'S', minLevel: 50, thresholds: { pushups: 100, situps: 100, squats: 150, plankSeconds: 300 }, reward: 1250 },
];

const D_PASS: BaselineTest = RANK_CASES[0].thresholds;
const D_FAIL: BaselineTest = { ...D_PASS, plankSeconds: 59 };
const METRICS = ['pushups', 'situps', 'squats', 'plankSeconds'] as const;

function examState(player: Partial<Player> = {}, options: Omit<StateOptions, 'player'> = {}): GameState {
  return makeState({ ...options, player: { level: 5, rank: 'E', ...player } });
}

describe('submitRankExam (§7)', () => {
  describe('eligibility', () => {
    it.each(RANK_CASES)('opens $from → $target exactly at level $minLevel and passes on exact thresholds', (c) => {
      const state = examState({ rank: c.from, level: c.minLevel });
      const result = submitRankExam(state, c.thresholds, TODAY);
      expect(result.evaluation.passed).toBe(true);
      expect(result.evaluation.target).toBe(c.target);
      expect(result.state.player.rank).toBe(c.target);
      expect(result.rewardXp).toBe(c.reward);
      // Reward is below xpToNextLevel(minLevel) for every rank → no level-up.
      expect(result.state.player.level).toBe(c.minLevel);
      expect(result.state.player.xp).toBe(c.reward);
      expect(result.state.player.totalXp).toBe(c.reward);
      expect(result.levelsGained).toBe(0);
      expect(result.state.player.rankExamCooldownUntil).toBeNull();
    });

    it.each(RANK_CASES)('blocks $from → $target at level $minLevel − 1', (c) => {
      const state = deepFreeze(examState({ rank: c.from, level: c.minLevel - 1 }));
      const error = expectRuleError(() => submitRankExam(state, c.thresholds, TODAY), 'exam_not_allowed');
      expect(error.message).toBe(EXAM_BLOCK_MESSAGES.level);
    });

    it('blocks a rank S player (max_rank)', () => {
      const error = expectRuleError(
        () => submitRankExam(examState({ rank: 'S', level: 99 }), RANK_CASES[4].thresholds, TODAY),
        'exam_not_allowed',
      );
      expect(error.message).toBe(EXAM_BLOCK_MESSAGES.max_rank);
    });

    it('blocks while a penalty quest is active', () => {
      const state = examState({}, { penaltyQuest: makePenalty(YESTERDAY) });
      const error = expectRuleError(() => submitRankExam(state, D_PASS, TODAY), 'exam_not_allowed');
      expect(error.message).toBe(EXAM_BLOCK_MESSAGES.penalty);
    });

    it('is not blocked by a completed (not yet archived) penalty', () => {
      const state = examState(
        {},
        { penaltyQuest: makePenalty(YESTERDAY, [20, 50, 120, 15], { status: 'completed', completedAt: EARLIER }) },
      );
      expect(submitRankExam(state, D_PASS, TODAY).state.player.rank).toBe('D');
    });

    it('reports the first failing reason in spec order', () => {
      const penalty = makePenalty(YESTERDAY);
      // max_rank before penalty
      expect(
        expectRuleError(() => submitRankExam(examState({ rank: 'S' }, { penaltyQuest: penalty }), D_PASS, TODAY))
          .message,
      ).toBe(EXAM_BLOCK_MESSAGES.max_rank);
      // penalty before level
      expect(
        expectRuleError(() => submitRankExam(examState({ level: 1 }, { penaltyQuest: penalty }), D_PASS, TODAY))
          .message,
      ).toBe(EXAM_BLOCK_MESSAGES.penalty);
      // level before cooldown
      expect(
        expectRuleError(() =>
          submitRankExam(examState({ level: 4, rankExamCooldownUntil: TOMORROW }), D_PASS, TODAY),
        ).message,
      ).toBe(EXAM_BLOCK_MESSAGES.level);
    });

    it('blocks until the cooldown day and opens on it', () => {
      const state = examState({ rankExamCooldownUntil: TOMORROW });
      const error = expectRuleError(() => submitRankExam(state, D_PASS, TODAY), 'exam_not_allowed');
      expect(error.message).toBe(EXAM_BLOCK_MESSAGES.cooldown);

      expect(submitRankExam(state, D_PASS, TOMORROW).state.player.rank).toBe('D'); // today == cooldown
      expect(submitRankExam(state, D_PASS, '2026-11-23').state.player.rank).toBe('D'); // today > cooldown
    });

    it('targets only the next rank (no skipping)', () => {
      const result = submitRankExam(examState({ level: 60 }), RANK_CASES[4].thresholds, TODAY);
      expect(result.evaluation.target).toBe('D');
      expect(result.state.player.rank).toBe('D');
      expect(result.rewardXp).toBe(250);
    });

    it('blocks further exams after reaching S', () => {
      const passed = submitRankExam(examState({ rank: 'A', level: 50 }), RANK_CASES[4].thresholds, TODAY);
      expect(passed.state.player.rank).toBe('S');
      expectRuleError(() => submitRankExam(passed.state, RANK_CASES[4].thresholds, TOMORROW), 'exam_not_allowed');
    });
  });

  describe('failing', () => {
    it('keeps the rank, grants nothing and sets the cooldown to tomorrow', () => {
      const state = examState({ xp: 40, totalXp: 900, unspentPoints: 2 });
      const result = submitRankExam(state, D_FAIL, TODAY);

      expect(result.evaluation.passed).toBe(false);
      expect(result.evaluation.target).toBe('D');
      expect(result.rewardXp).toBe(0);
      expect(result.levelsGained).toBe(0);
      expect(result.pointsGained).toBe(0);
      expect(result.fromLevel).toBe(5);
      expect(result.toLevel).toBe(5);
      // §10: exam results also update records (no bonus).
      expect({ ...result.state.player, records: state.player.records }).toEqual({
        ...state.player,
        rankExamCooldownUntil: TOMORROW,
      });
      expect(result.state.dailyQuest).toEqual(state.dailyQuest);
      expect(result.state.penaltyQuest).toEqual(state.penaltyQuest);
      expect(result.state.lastRolloverDay).toBe(state.lastRolloverDay);
    });

    it.each(METRICS)('fails when only %s is one below its threshold', (key) => {
      const results = { ...D_PASS, [key]: D_PASS[key] - 1 };
      const result = submitRankExam(examState(), results, TODAY);
      expect(result.evaluation.passed).toBe(false);
      expect(result.state.player.rank).toBe('E');
      const byKey = Object.fromEntries(result.evaluation.checks.map((c) => [c.key, c]));
      expect(Object.keys(byKey).sort()).toEqual([...METRICS].sort());
      for (const metric of METRICS) {
        expect(byKey[metric]).toMatchObject({
          required: D_PASS[metric],
          actual: results[metric],
          passed: metric !== key,
        });
      }
    });

    it.each<[DayKey, DayKey]>([
      ['2026-11-30', '2026-12-01'],
      ['2026-12-31', '2027-01-01'],
      ['2027-02-28', '2027-03-01'],
      ['2028-02-28', '2028-02-29'],
    ])('sets the cooldown after a failure on %s to %s', (today, cooldown) => {
      const result = submitRankExam(examState(), D_FAIL, today);
      expect(result.state.player.rankExamCooldownUntil).toBe(cooldown);
    });

    it('allows a retry the next day, and passing clears the cooldown', () => {
      const failed = submitRankExam(examState(), D_FAIL, TODAY);
      expectRuleError(() => submitRankExam(failed.state, D_PASS, TODAY), 'exam_not_allowed');

      const passed = submitRankExam(failed.state, D_PASS, TOMORROW);
      expect(passed.state.player.rank).toBe('D');
      expect(passed.state.player.rankExamCooldownUntil).toBeNull();
    });
  });

  describe('passing', () => {
    it('can level the player up through the reward', () => {
      // level 5 (needs 1118): 1000 + 250 = 1250 → level 6 with 132
      const state = examState({ xp: 1000, totalXp: 3000, unspentPoints: 1 });
      const result = submitRankExam(state, D_PASS, TODAY);
      expect(result.rewardXp).toBe(250);
      expect(result.fromLevel).toBe(5);
      expect(result.toLevel).toBe(6);
      expect(result.levelsGained).toBe(1);
      expect(result.pointsGained).toBe(3);
      expect(result.state.player.level).toBe(6);
      expect(result.state.player.xp).toBe(132);
      expect(result.state.player.totalXp).toBe(3250);
      expect(result.state.player.unspentPoints).toBe(4);
    });

    it.each<[number, number, number]>([
      [868, 6, 0], // 868 + 250 = 1118 exactly
      [867, 5, 1117], // one short
    ])('level 5 with %i XP → level %i, %i XP after the D reward', (xp, level, rest) => {
      const result = submitRankExam(examState({ xp }), D_PASS, TODAY);
      expect(result.state.player.level).toBe(level);
      expect(result.state.player.xp).toBe(rest);
    });

    it('clears an expired cooldown', () => {
      const result = submitRankExam(examState({ rankExamCooldownUntil: YESTERDAY }), D_PASS, TODAY);
      expect(result.state.player.rankExamCooldownUntil).toBeNull();
    });

    it('accepts results above the thresholds up to the input limits', () => {
      const best: BaselineTest = { pushups: 1000, situps: 1000, squats: 1000, plankSeconds: 3600 };
      const result = submitRankExam(examState(), best, TODAY);
      expect(result.evaluation.passed).toBe(true);
      expect(result.evaluation.checks.every((c) => c.passed)).toBe(true);
    });

    it('changes only rank, XP fields and cooldown', () => {
      const state = examState({ stats: statsOf(25), statXp: statsOf(3) }, { penaltyQuest: null });
      const result = submitRankExam(state, D_PASS, TODAY);
      // §10: exam results also update records (no bonus).
      expect({ ...result.state.player, records: state.player.records }).toEqual({
        ...state.player,
        rank: 'D',
        xp: 250,
        totalXp: 250,
        rankExamCooldownUntil: null,
      });
      expect(result.state.dailyQuest).toEqual(state.dailyQuest);
      expect(result.state.lastRolloverDay).toBe(state.lastRolloverDay);
    });
  });

  describe('validation and invariants', () => {
    it.each<[string, BaselineTest]>([
      ['negative push-ups', { ...D_PASS, pushups: -1 }],
      ['fractional sit-ups', { ...D_PASS, situps: 25.5 }],
      ['squats over 1000', { ...D_PASS, squats: 1001 }],
      ['plank over 3600 s', { ...D_PASS, plankSeconds: 3601 }],
      ['NaN push-ups', { ...D_PASS, pushups: Number.NaN }],
    ])('rejects invalid results (%s) with GameRuleError', (_label, results) => {
      const state = deepFreeze(examState());
      const snapshot = structuredClone(state);
      expectRuleError(() => submitRankExam(state, results, TODAY));
      expect(state).toEqual(snapshot);
    });

    it('does not mutate its inputs and is deterministic', () => {
      const state = deepFreeze(examState({ xp: 1000 }));
      const results = deepFreeze({ ...D_PASS });
      const snapshot = structuredClone(state);
      const a = submitRankExam(state, results, TODAY);
      const b = submitRankExam(state, results, TODAY);
      expect(a).toEqual(b);
      expect(state).toEqual(snapshot);
      expect(results).toEqual(D_PASS);

      const failState = deepFreeze(examState());
      submitRankExam(failState, deepFreeze({ ...D_FAIL }), TODAY);
      expect(failState.player.rankExamCooldownUntil).toBeNull();
    });
  });
});
