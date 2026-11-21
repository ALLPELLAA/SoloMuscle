/// <reference types="jest" />
/**
 * Rank exams — docs/GAME_DESIGN.md §7.
 */
import {
  EXAM_BLOCK_MESSAGES,
  EXAM_METRICS,
  RANK_REQUIREMENTS,
  evaluateRankExam,
  examCooldownAfterFailure,
  getExamEligibility,
  nextRank,
  rankIndex,
  rankUpRewardXp,
  type ExamRank,
} from './rank';
import { emptyStats } from './stats';
import { RANKS, type BaselineTest, type GameState, type Player, type Quest, type Rank } from './types';

/** Spec table §7, transcribed by hand. */
const SPEC_TABLE: Record<ExamRank, { minLevel: number; thresholds: BaselineTest }> = {
  D: { minLevel: 5, thresholds: { pushups: 20, situps: 25, squats: 30, plankSeconds: 60 } },
  C: { minLevel: 12, thresholds: { pushups: 35, situps: 40, squats: 50, plankSeconds: 90 } },
  B: { minLevel: 22, thresholds: { pushups: 50, situps: 55, squats: 75, plankSeconds: 150 } },
  A: { minLevel: 35, thresholds: { pushups: 70, situps: 75, squats: 100, plankSeconds: 210 } },
  S: { minLevel: 50, thresholds: { pushups: 100, situps: 100, squats: 150, plankSeconds: 300 } },
};

const EXAM_RANKS: ExamRank[] = ['D', 'C', 'B', 'A', 'S'];
const METRIC_KEYS: (keyof BaselineTest)[] = ['pushups', 'situps', 'squats', 'plankSeconds'];

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Test',
    level: 5,
    xp: 0,
    totalXp: 1703,
    rank: 'E',
    stats: emptyStats(20),
    statXp: emptyStats(),
    unspentPoints: 0,
    baseline: { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 },
    createdDay: '2026-01-10',
    rankExamCooldownUntil: null,
    records: {},
    rpe: {},
    streak: { current: 0, best: 0, lastCompletedDay: null },
    ...overrides,
  };
}

function penaltyQuest(status: Quest['status']): Quest {
  return {
    id: 'penalty-2026-03-10',
    kind: 'penalty',
    dayKey: '2026-03-10',
    title: 'CEZA GÖREVİ: Hayatta Kalma',
    objectives: [{ exerciseId: 'burpee', target: 20, progress: 0, note: '' }],
    rewardXp: 0,
    awardedXp: 0,
    status,
    completedAt: null,
  };
}

function makeState(player: Partial<Player> = {}, penalty: Quest | null = null): GameState {
  return {
    player: makePlayer(player),
    dailyQuest: null,
    penaltyQuest: penalty,
    lastRolloverDay: '2026-03-10',
    restDays: [],
  };
}

describe('rank order and thresholds', () => {
  it('ranks go E → D → C → B → A → S', () => {
    expect(RANKS).toEqual(['E', 'D', 'C', 'B', 'A', 'S']);
    expect(RANKS.map(rankIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('requirement table matches the spec', () => {
    expect(RANK_REQUIREMENTS).toEqual(SPEC_TABLE);
  });

  it('min levels are increasing', () => {
    const levels = EXAM_RANKS.map((r) => RANK_REQUIREMENTS[r].minLevel);
    expect(levels).toEqual([5, 12, 22, 35, 50]);
  });

  it('exam metrics are push-ups, sit-ups, squats, plank (Turkish labels)', () => {
    expect(EXAM_METRICS.map((m) => m.key)).toEqual(METRIC_KEYS);
    expect(EXAM_METRICS.map((m) => m.label)).toEqual(['Şınav', 'Mekik', 'Squat', 'Plank']);
  });
});

describe('nextRank', () => {
  it.each([
    ['E', 'D'],
    ['D', 'C'],
    ['C', 'B'],
    ['B', 'A'],
    ['A', 'S'],
  ] as const)('%s → %s', (from, to) => {
    expect(nextRank(from)).toBe(to);
  });

  it('S has no next rank', () => {
    expect(nextRank('S')).toBeNull();
  });

  it('unknown rank has no next rank', () => {
    expect(nextRank('Z' as Rank)).toBeNull();
  });
});

describe('rankUpRewardXp = 250 · targetIndex', () => {
  it.each([
    ['D', 250],
    ['C', 500],
    ['B', 750],
    ['A', 1000],
    ['S', 1250],
  ] as const)('%s → %i XP', (target, xp) => {
    expect(rankUpRewardXp(target)).toBe(xp);
  });
});

describe('evaluateRankExam', () => {
  it.each(EXAM_RANKS)('%s: passes when every result equals its threshold', (target) => {
    const evaluation = evaluateRankExam(target, { ...SPEC_TABLE[target].thresholds });
    expect(evaluation.target).toBe(target);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.checks.every((c) => c.passed)).toBe(true);
  });

  it.each(EXAM_RANKS.flatMap((target) => METRIC_KEYS.map((key) => [target, key] as const)))(
    '%s: fails when %s is one below its threshold',
    (target, key) => {
      const results = { ...SPEC_TABLE[target].thresholds };
      results[key] -= 1;
      const evaluation = evaluateRankExam(target, results);
      expect(evaluation.passed).toBe(false);
      for (const check of evaluation.checks) {
        expect(check.passed).toBe(check.key !== key);
      }
    },
  );

  it('passes when results exceed every threshold', () => {
    expect(evaluateRankExam('D', { pushups: 100, situps: 100, squats: 100, plankSeconds: 600 }).passed).toBe(true);
  });

  it('fails when all results are zero', () => {
    const evaluation = evaluateRankExam('D', { pushups: 0, situps: 0, squats: 0, plankSeconds: 0 });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.checks.map((c) => c.passed)).toEqual([false, false, false, false]);
  });

  it('reports required and actual values in metric order', () => {
    const evaluation = evaluateRankExam('C', { pushups: 40, situps: 39, squats: 50, plankSeconds: 120 });
    expect(evaluation.checks.map(({ key, required, actual, passed }) => ({ key, required, actual, passed }))).toEqual([
      { key: 'pushups', required: 35, actual: 40, passed: true },
      { key: 'situps', required: 40, actual: 39, passed: false },
      { key: 'squats', required: 50, actual: 50, passed: true },
      { key: 'plankSeconds', required: 90, actual: 120, passed: true },
    ]);
    expect(evaluation.passed).toBe(false);
  });

  it('does not mutate the results', () => {
    const results = Object.freeze({ pushups: 20, situps: 25, squats: 30, plankSeconds: 60 });
    expect(() => evaluateRankExam('D', results)).not.toThrow();
  });
});

describe('getExamEligibility — reasons checked in order', () => {
  const TODAY = '2026-03-10';

  it('max_rank wins over every other reason', () => {
    const state = makeState({ rank: 'S', level: 1, rankExamCooldownUntil: '2026-03-20' }, penaltyQuest('active'));
    const e = getExamEligibility(state, TODAY);
    expect(e.allowed).toBe(false);
    expect(e.reason).toBe('max_rank');
    expect(e.target).toBeNull();
  });

  it('penalty comes before level and cooldown', () => {
    const state = makeState({ rank: 'E', level: 1, rankExamCooldownUntil: '2026-03-20' }, penaltyQuest('active'));
    const e = getExamEligibility(state, TODAY);
    expect(e.allowed).toBe(false);
    expect(e.reason).toBe('penalty');
    expect(e.target).toBe('D');
  });

  it('level comes before cooldown', () => {
    const state = makeState({ rank: 'E', level: 4, rankExamCooldownUntil: '2026-03-20' });
    const e = getExamEligibility(state, TODAY);
    expect(e.allowed).toBe(false);
    expect(e.reason).toBe('level');
    expect(e.requiredLevel).toBe(5);
  });

  it('cooldown blocks while today < cooldownUntil', () => {
    const state = makeState({ rank: 'E', level: 5, rankExamCooldownUntil: '2026-03-11' });
    const e = getExamEligibility(state, TODAY);
    expect(e.allowed).toBe(false);
    expect(e.reason).toBe('cooldown');
    expect(e.cooldownUntil).toBe('2026-03-11');
  });

  it('cooldown is over on the cooldown day itself (boundary)', () => {
    const state = makeState({ rank: 'E', level: 5, rankExamCooldownUntil: '2026-03-10' });
    const e = getExamEligibility(state, TODAY);
    expect(e.allowed).toBe(true);
    expect(e.reason).toBeNull();
  });

  it('cooldown is over after the cooldown day', () => {
    const state = makeState({ rank: 'E', level: 5, rankExamCooldownUntil: '2026-03-01' });
    expect(getExamEligibility(state, TODAY).allowed).toBe(true);
  });

  it('cooldown compares calendar days across month/year boundaries', () => {
    const state = makeState({ rank: 'E', level: 5, rankExamCooldownUntil: '2027-01-01' });
    expect(getExamEligibility(state, '2026-12-31').reason).toBe('cooldown');
    expect(getExamEligibility(state, '2027-01-01').allowed).toBe(true);
  });

  it('level boundary: exactly the min level is allowed, one below is not', () => {
    for (const [rank, target] of [
      ['E', 'D'],
      ['D', 'C'],
      ['C', 'B'],
      ['B', 'A'],
      ['A', 'S'],
    ] as const) {
      const min = SPEC_TABLE[target].minLevel;
      const below = getExamEligibility(makeState({ rank, level: min - 1 }), TODAY);
      expect(below).toMatchObject({ allowed: false, reason: 'level', target, requiredLevel: min });
      const exact = getExamEligibility(makeState({ rank, level: min }), TODAY);
      expect(exact).toMatchObject({ allowed: true, reason: null, target, requiredLevel: min });
    }
  });

  it('a completed (not active) penalty quest does not block', () => {
    const state = makeState({ rank: 'E', level: 5 }, penaltyQuest('completed'));
    expect(getExamEligibility(state, TODAY).allowed).toBe(true);
  });

  it('every block reason has a Turkish message', () => {
    for (const reason of ['max_rank', 'penalty', 'level', 'cooldown'] as const) {
      expect(EXAM_BLOCK_MESSAGES[reason]).toEqual(expect.any(String));
      expect(EXAM_BLOCK_MESSAGES[reason].length).toBeGreaterThan(0);
    }
  });
});

describe('examCooldownAfterFailure = today + 1 day', () => {
  it.each([
    ['2026-03-10', '2026-03-11'],
    ['2026-01-31', '2026-02-01'],
    ['2026-02-28', '2026-03-01'],
    ['2024-02-28', '2024-02-29'],
    ['2026-12-31', '2027-01-01'],
  ])('%s → %s', (today, until) => {
    expect(examCooldownAfterFailure(today)).toBe(until);
  });
});
