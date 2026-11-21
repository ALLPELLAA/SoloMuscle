/// <reference types="jest" />
/**
 * Daily quest generator and penalty quest — docs/GAME_DESIGN.md §5–§6.
 * Targets are computed by hand from:
 *   levelFactor = 1 + 0.08·(level − 1)
 *   statFactor  = clamp(0.6 + S/25, 0.8, 3.0)
 *   raw         = base · levelFactor · statFactor
 * and the §5 unit-aware rounding.
 */
import {
  DAILY_CORE,
  DAILY_TARGETS,
  FOCUS_POOLS,
  PENALTY_OBJECTIVES,
  PENALTY_QUEST_TITLE,
  addQuestProgress,
  dailyQuestId,
  dailyRewardXp,
  dailyTarget,
  generateDailyQuest,
  generatePenaltyQuest,
  isQuestComplete,
  levelFactor,
  penaltyQuestId,
  pickFocusExercise,
  questProgress,
  roundTarget,
  statFactor,
} from './quests';
import { emptyStats } from './stats';
import type { ExerciseId, Player, Quest, Stats } from './types';

/** Objective without its system note (notes are covered in features.test.ts, docs §12). */
function withoutNote(o: { exerciseId: string; target: number; progress: number }) {
  return { exerciseId: o.exerciseId, target: o.target, progress: o.progress };
}

// ---------------------------------------------------------------------------
// Independent reference implementations of the spec's seeding (FNV-1a 32-bit +
// mulberry32), written with BigInt so they do not share code with src/game.
// ---------------------------------------------------------------------------
const U32 = 0xffffffffn;

function refFnv1a(input: string): number {
  let hash = 0x811c9dc5n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * 0x01000193n) & U32;
  }
  return Number(hash);
}

function refMulberry32(seed: number): () => number {
  let a = BigInt(seed >>> 0);
  const mul = (x: bigint, y: bigint) => (x * y) & U32;
  return () => {
    a = (a + 0x6d2b79f5n) & U32;
    let t = a;
    t = mul(t ^ (t >> 15n), t | 1n);
    t = t ^ ((t + mul(t ^ (t >> 7n), t | 61n)) & U32);
    return Number((t ^ (t >> 14n)) & U32) / 4294967296;
  };
}

function refFocusIndex(createdDay: string, dayKey: string, poolLength: number): number {
  const rng = refMulberry32(refFnv1a(`${createdDay}|${dayKey}|daily`));
  return Math.floor(rng() * poolLength);
}

// ---------------------------------------------------------------------------

const SPEC_STATS: Stats = { strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 };

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Test',
    level: 1,
    xp: 0,
    totalXp: 0,
    rank: 'E',
    stats: { ...SPEC_STATS },
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

function dayKeys(count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(2026, 0, 1 + i, 12);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

describe('spec tables (§5, §6)', () => {
  it('core objectives are pushup, situp, squat in that order', () => {
    expect([...DAILY_CORE]).toEqual(['pushup', 'situp', 'squat']);
  });

  it('focus pools match the spec', () => {
    expect(FOCUS_POOLS).toEqual({
      strength: ['lunge'],
      endurance: ['plank', 'run'],
      agility: ['burpee', 'jump_rope', 'jumping_jack'],
      vitality: ['walk', 'run'],
      flexibility: ['stretch', 'yoga'],
    });
  });

  it('daily base/max table matches the spec', () => {
    expect(DAILY_TARGETS).toEqual({
      pushup: { base: 10, max: 150 },
      situp: { base: 10, max: 150 },
      squat: { base: 15, max: 200 },
      lunge: { base: 12, max: 150 },
      plank: { base: 30, max: 600 },
      run: { base: 10, max: 60 },
      burpee: { base: 8, max: 100 },
      jump_rope: { base: 3, max: 30 },
      jumping_jack: { base: 30, max: 300 },
      walk: { base: 15, max: 90 },
      stretch: { base: 5, max: 30 },
      yoga: { base: 10, max: 45 },
    });
  });

  it('every focus exercise has a daily target', () => {
    for (const pool of Object.values(FOCUS_POOLS)) {
      for (const id of pool) expect(DAILY_TARGETS[id]).toBeDefined();
    }
  });

  it('penalty table matches the spec (order burpee, squat, plank, run)', () => {
    expect(PENALTY_OBJECTIVES).toEqual([
      { exerciseId: 'burpee', base: 20, max: 150 },
      { exerciseId: 'squat', base: 50, max: 300 },
      { exerciseId: 'plank', base: 120, max: 900 },
      { exerciseId: 'run', base: 15, max: 90 },
    ]);
  });
});

describe('levelFactor', () => {
  it.each([
    [1, 1],
    [2, 1.08],
    [6, 1.4],
    [11, 1.8],
    [26, 3],
    [51, 5],
  ])('level %i → %f (no clamp)', (level, factor) => {
    expect(levelFactor(level)).toBeCloseTo(factor, 10);
  });
});

describe('statFactor', () => {
  it.each([
    [0, 0.8], // 0.6 → clamped up
    [4, 0.8], // 0.76 → clamped up
    [5, 0.8], // exactly the lower bound
    [6, 0.84],
    [10, 1.0],
    [25, 1.6],
    [59, 2.96],
    [60, 3.0], // exactly the upper bound
    [61, 3.0], // 3.04 → clamped down
    [999, 3.0],
  ])('S = %i → %f', (s, factor) => {
    expect(statFactor(s)).toBeCloseTo(factor, 10);
  });
});

describe('roundTarget (§5 rounding)', () => {
  describe('reps', () => {
    it('uses Math.round below 20', () => {
      expect(roundTarget(18, 'reps', 150)).toBe(18); // not 20
      expect(roundTarget(19.4, 'reps', 150)).toBe(19);
      expect(roundTarget(10.8, 'reps', 150)).toBe(11);
      expect(roundTarget(16.2, 'reps', 150)).toBe(16);
    });

    it('rounds to the nearest multiple of 5 from 20', () => {
      expect(roundTarget(20, 'reps', 150)).toBe(20);
      expect(roundTarget(21, 'reps', 150)).toBe(20); // not 21
      expect(roundTarget(22.4, 'reps', 150)).toBe(20);
      expect(roundTarget(22.6, 'reps', 150)).toBe(25);
      expect(roundTarget(23.76, 'reps', 150)).toBe(25);
      expect(roundTarget(47.52, 'reps', 300)).toBe(50);
    });

    it('clamps to [1, max]', () => {
      expect(roundTarget(0.2, 'reps', 150)).toBe(1);
      expect(roundTarget(0, 'reps', 150)).toBe(1);
      expect(roundTarget(150, 'reps', 150)).toBe(150);
      expect(roundTarget(152.6, 'reps', 150)).toBe(150);
      expect(roundTarget(1000, 'reps', 150)).toBe(150);
    });
  });

  describe('seconds', () => {
    it('always rounds to the nearest multiple of 5', () => {
      expect(roundTarget(31, 'seconds', 600)).toBe(30);
      expect(roundTarget(33, 'seconds', 600)).toBe(35);
      expect(roundTarget(3, 'seconds', 600)).toBe(5); // below 20 too
      expect(roundTarget(12, 'seconds', 600)).toBe(10);
      expect(roundTarget(206.4, 'seconds', 900)).toBe(205);
    });

    it('clamps to [1, max]', () => {
      expect(roundTarget(2, 'seconds', 600)).toBe(1); // nearest multiple is 0 → clamped to 1
      expect(roundTarget(700, 'seconds', 600)).toBe(600);
    });
  });

  describe('minutes', () => {
    it('uses Math.round (never multiples of 5)', () => {
      expect(roundTarget(3.4, 'minutes', 30)).toBe(3);
      expect(roundTarget(3.6, 'minutes', 30)).toBe(4);
      expect(roundTarget(22, 'minutes', 60)).toBe(22);
      expect(roundTarget(24.08, 'minutes', 60)).toBe(24);
    });

    it('clamps to [1, max]', () => {
      expect(roundTarget(0.3, 'minutes', 30)).toBe(1);
      expect(roundTarget(85.8, 'minutes', 30)).toBe(30);
    });
  });
});

describe('dailyTarget', () => {
  it('spec example player at level 1 (stats 12/13/11/10/7)', () => {
    const p = { level: 1, stats: SPEC_STATS };
    // pushup: 10 · 1 · (0.6 + 12/25 = 1.08) = 10.8 → 11
    expect(dailyTarget('pushup', p)).toBe(11);
    // situp: primary endurance 13 → 1.12 → 11.2 → 11
    expect(dailyTarget('situp', p)).toBe(11);
    // squat: 15 · 1.08 = 16.2 → 16
    expect(dailyTarget('squat', p)).toBe(16);
    // stretch: 5 · (0.6 + 7/25 = 0.88) = 4.4 dk → 4
    expect(dailyTarget('stretch', p)).toBe(4);
    // yoga: 10 · 0.88 = 8.8 dk → 9
    expect(dailyTarget('yoga', p)).toBe(9);
    // burpee: 8 · (0.6 + 11/25 = 1.04) = 8.32 → 8
    expect(dailyTarget('burpee', p)).toBe(8);
    // jump_rope: 3 · 1.04 = 3.12 dk → 3
    expect(dailyTarget('jump_rope', p)).toBe(3);
    // jumping_jack: 30 · 1.04 = 31.2 → ≥ 20 → 30
    expect(dailyTarget('jumping_jack', p)).toBe(30);
    // walk: 15 · (0.6 + 10/25 = 1.0) = 15 dk
    expect(dailyTarget('walk', p)).toBe(15);
    // plank: 30 · 1.12 = 33.6 sn → 35
    expect(dailyTarget('plank', p)).toBe(35);
    // run: 10 · 1.12 = 11.2 dk → 11
    expect(dailyTarget('run', p)).toBe(11);
    // lunge: primary strength (tie with agility) 12 → 12 · 1.08 = 12.96 → 13
    expect(dailyTarget('lunge', p)).toBe(13);
  });

  it('scales with level (level 5, strength 30, endurance 20, agility 15)', () => {
    const p = { level: 5, stats: { strength: 30, endurance: 20, agility: 15, vitality: 25, flexibility: 40 } };
    // lf = 1.32
    // pushup: 10 · 1.32 · 1.8 = 23.76 → 25
    expect(dailyTarget('pushup', p)).toBe(25);
    // situp: 10 · 1.32 · 1.4 = 18.48 → 18
    expect(dailyTarget('situp', p)).toBe(18);
    // squat: 15 · 1.32 · 1.8 = 35.64 → 35
    expect(dailyTarget('squat', p)).toBe(35);
    // burpee: 8 · 1.32 · 1.2 = 12.672 → 13
    expect(dailyTarget('burpee', p)).toBe(13);
    // jump_rope: 3 · 1.32 · 1.2 = 4.752 → 5
    expect(dailyTarget('jump_rope', p)).toBe(5);
    // jumping_jack: 30 · 1.32 · 1.2 = 47.52 → 50
    expect(dailyTarget('jumping_jack', p)).toBe(50);
  });

  it('level 10, endurance 20: plank 70 sn, run 24 dk', () => {
    const p = { level: 10, stats: { ...SPEC_STATS, endurance: 20 } };
    // lf 1.72, sf 1.4 → plank 72.24 → 70 ; run 24.08 → 24
    expect(dailyTarget('plank', p)).toBe(70);
    expect(dailyTarget('run', p)).toBe(24);
  });

  it('uses the primary stat even on weight ties (lunge → strength, run → endurance)', () => {
    const p = { level: 1, stats: { strength: 30, endurance: 30, agility: 5, vitality: 5, flexibility: 5 } };
    // lunge via strength 30: 12 · 1.8 = 21.6 → 20 (via agility it would be 9.6 → 10)
    expect(dailyTarget('lunge', p)).toBe(20);
    // run via endurance 30: 10 · 1.8 = 18 (via vitality it would be 8)
    expect(dailyTarget('run', p)).toBe(18);
  });

  it('stat factor lower clamp (stat 1 → 0.8)', () => {
    const p = { level: 1, stats: emptyStats(1) };
    expect(dailyTarget('pushup', p)).toBe(8); // 10 · 0.8
    expect(dailyTarget('squat', p)).toBe(12); // 15 · 0.8
    expect(dailyTarget('stretch', p)).toBe(4); // 5 · 0.8
  });

  it('reaches the max exactly and caps beyond it', () => {
    // level 50: lf 4.92 ; S = 100 → sf 3 → pushup 147.6 → 150 (= max)
    expect(dailyTarget('pushup', { level: 50, stats: emptyStats(100) })).toBe(150);
    // level 60: lf 5.72 → pushup 171.6 → 170 → 150 ; squat 257.4 → 255 → 200 ; stretch 85.8 → 30
    const high = { level: 60, stats: emptyStats(100) };
    expect(dailyTarget('pushup', high)).toBe(150);
    expect(dailyTarget('squat', high)).toBe(200);
    expect(dailyTarget('stretch', high)).toBe(30);
    expect(dailyTarget('plank', high)).toBe(515); // 30 · 5.72 · 3 = 514.8 → 515 (< 600)
    expect(dailyTarget('run', high)).toBe(60); // 171.6 → 60
  });

  it('throws for an exercise without a daily target (pullup)', () => {
    expect(() => dailyTarget('pullup', { level: 1, stats: SPEC_STATS })).toThrow();
  });
});

describe('dailyRewardXp / ids', () => {
  it.each([
    [1, 75],
    [2, 100],
    [10, 300],
    [50, 1300],
  ])('level %i → %i XP', (level, xp) => {
    expect(dailyRewardXp(level)).toBe(xp);
  });

  it('formats quest ids', () => {
    expect(dailyQuestId('2026-03-10')).toBe('daily-2026-03-10');
    expect(penaltyQuestId('2026-03-10')).toBe('penalty-2026-03-10');
  });
});

describe('pickFocusExercise', () => {
  it('always picks lunge when strength is weakest (pool of 1)', () => {
    const player = makePlayer({ stats: { ...SPEC_STATS, strength: 1 } });
    for (const day of dayKeys(20)) expect(pickFocusExercise(player, day)).toBe('lunge');
  });

  it.each([
    ['endurance', { endurance: 1 }],
    ['agility', { agility: 1 }],
    ['vitality', { vitality: 1 }],
    ['flexibility', { flexibility: 1 }],
  ] as const)('weakest %s → floor(rng() · pool.length) from its pool', (stat, override) => {
    const player = makePlayer({ stats: { ...SPEC_STATS, ...override } });
    const pool = FOCUS_POOLS[stat];
    for (const day of dayKeys(40)) {
      const expected = pool[refFocusIndex(player.createdDay, day, pool.length)];
      expect(pickFocusExercise(player, day)).toBe(expected);
    }
  });

  it('weakest-stat ties use STAT_KEYS order (endurance = vitality → endurance pool)', () => {
    const player = makePlayer({ stats: { strength: 9, endurance: 3, agility: 9, vitality: 3, flexibility: 9 } });
    for (const day of dayKeys(20)) expect(FOCUS_POOLS.endurance).toContain(pickFocusExercise(player, day));
  });

  it('depends on createdDay as part of the seed', () => {
    const pool = FOCUS_POOLS.agility;
    for (const createdDay of ['2025-06-01', '2026-01-10', '2026-11-21']) {
      const player = makePlayer({ createdDay, stats: { ...SPEC_STATS, agility: 1 } });
      for (const day of dayKeys(15)) {
        expect(pickFocusExercise(player, day)).toBe(pool[refFocusIndex(createdDay, day, pool.length)]);
      }
    }
  });

  it('eventually uses every member of a pool', () => {
    const player = makePlayer({ stats: { ...SPEC_STATS, agility: 1 } });
    const seen = new Set(dayKeys(120).map((d) => pickFocusExercise(player, d)));
    expect([...seen].sort()).toEqual(['burpee', 'jump_rope', 'jumping_jack']);
  });
});

describe('generateDailyQuest', () => {
  it('builds the spec example quest at level 1', () => {
    const player = makePlayer();
    const quest = generateDailyQuest(player, '2026-01-11');
    const focus: ExerciseId = FOCUS_POOLS.flexibility[refFocusIndex('2026-01-10', '2026-01-11', 2)];
    expect(quest).toMatchObject({
      id: 'daily-2026-01-11',
      kind: 'daily',
      dayKey: '2026-01-11',
      rewardXp: 75,
      awardedXp: 0,
      status: 'active',
      completedAt: null,
    });
    expect(quest.objectives.map(withoutNote)).toEqual([
      { exerciseId: 'pushup', target: 11, progress: 0 },
      { exerciseId: 'situp', target: 11, progress: 0 },
      { exerciseId: 'squat', target: 16, progress: 0 },
      { exerciseId: focus, target: focus === 'stretch' ? 4 : 9, progress: 0 },
    ]);
    expect(quest.title.length).toBeGreaterThan(0);
  });

  it('scales targets and reward with level (level 5, agility weakest)', () => {
    const player = makePlayer({
      level: 5,
      stats: { strength: 30, endurance: 20, agility: 15, vitality: 25, flexibility: 40 },
    });
    const quest = generateDailyQuest(player, '2026-02-01');
    expect(quest.rewardXp).toBe(175); // 50 + 25·5
    expect(quest.objectives.slice(0, 3).map(withoutNote)).toEqual([
      { exerciseId: 'pushup', target: 25, progress: 0 },
      { exerciseId: 'situp', target: 18, progress: 0 },
      { exerciseId: 'squat', target: 35, progress: 0 },
    ]);
    const focusTargets: Partial<Record<ExerciseId, number>> = { burpee: 13, jump_rope: 5, jumping_jack: 50 };
    const focus = quest.objectives[3];
    expect(focus.exerciseId).toBe(FOCUS_POOLS.agility[refFocusIndex(player.createdDay, '2026-02-01', 3)]);
    expect(focus.target).toBe(focusTargets[focus.exerciseId]);
  });

  it('always has 4 objectives: core in order + one focus from the weakest pool', () => {
    const player = makePlayer({ level: 7, stats: { ...SPEC_STATS, vitality: 2 } });
    for (const day of dayKeys(30)) {
      const quest = generateDailyQuest(player, day);
      expect(quest.objectives).toHaveLength(4);
      expect(quest.objectives.slice(0, 3).map((o) => o.exerciseId)).toEqual(['pushup', 'situp', 'squat']);
      expect(FOCUS_POOLS.vitality).toContain(quest.objectives[3].exerciseId);
      for (const o of quest.objectives) {
        expect(o.progress).toBe(0);
        expect(Number.isInteger(o.target)).toBe(true);
        expect(o.target).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('is deterministic for the same createdDay + dayKey', () => {
    const player = makePlayer({ stats: { ...SPEC_STATS, agility: 1 } });
    for (const day of dayKeys(10)) {
      expect(generateDailyQuest(player, day)).toEqual(generateDailyQuest({ ...player }, day));
    }
  });

  it('does not mutate the player', () => {
    const player = deepFreeze(makePlayer());
    const copy = structuredClone(player);
    generateDailyQuest(player, '2026-01-12');
    expect(player).toEqual(copy);
  });
});

describe('generatePenaltyQuest (§6)', () => {
  function targets(quest: Quest): Record<string, number> {
    return Object.fromEntries(quest.objectives.map((o) => [o.exerciseId, o.target]));
  }

  it('level 1 → base values, rewardXp 0', () => {
    const quest = generatePenaltyQuest({ level: 1 }, '2026-01-12');
    expect(quest).toMatchObject({
      id: 'penalty-2026-01-12',
      kind: 'penalty',
      dayKey: '2026-01-12',
      title: 'CEZA GÖREVİ: Hayatta Kalma',
      rewardXp: 0,
      awardedXp: 0,
      status: 'active',
      completedAt: null,
    });
    expect(PENALTY_QUEST_TITLE).toBe('CEZA GÖREVİ: Hayatta Kalma');
    expect(quest.objectives.map(withoutNote)).toEqual([
      { exerciseId: 'burpee', target: 20, progress: 0 },
      { exerciseId: 'squat', target: 50, progress: 0 },
      { exerciseId: 'plank', target: 120, progress: 0 },
      { exerciseId: 'run', target: 15, progress: 0 },
    ]);
  });

  it('level 2 (lf 1.08): 21.6→20, 54→55, 129.6→130 sn, 16.2→16 dk', () => {
    expect(targets(generatePenaltyQuest({ level: 2 }, '2026-01-12'))).toEqual({
      burpee: 20,
      squat: 55,
      plank: 130,
      run: 16,
    });
  });

  it('level 10 (lf 1.72): 34.4→35, 86→85, 206.4→205 sn, 25.8→26 dk', () => {
    expect(targets(generatePenaltyQuest({ level: 10 }, '2026-01-12'))).toEqual({
      burpee: 35,
      squat: 85,
      plank: 205,
      run: 26,
    });
  });

  it('level 50 (lf 4.92): 98.4→100, 246→245, 590.4→590 sn, 73.8→74 dk', () => {
    expect(targets(generatePenaltyQuest({ level: 50 }, '2026-01-12'))).toEqual({
      burpee: 100,
      squat: 245,
      plank: 590,
      run: 74,
    });
  });

  it('level 100 is capped at 150 / 300 / 900 / 90', () => {
    expect(targets(generatePenaltyQuest({ level: 100 }, '2026-01-12'))).toEqual({
      burpee: 150,
      squat: 300,
      plank: 900,
      run: 90,
    });
  });

  it('ignores stats (no stat factor)', () => {
    const weak = generatePenaltyQuest(makePlayer({ level: 10, stats: emptyStats(1) }), '2026-01-12');
    const strong = generatePenaltyQuest(makePlayer({ level: 10, stats: emptyStats(500) }), '2026-01-12');
    expect(strong).toEqual(weak);
  });
});

describe('quest progress', () => {
  function quest(overrides: Partial<Quest> = {}): Quest {
    return {
      id: 'daily-2026-01-12',
      kind: 'daily',
      dayKey: '2026-01-12',
      title: 'Günlük',
      objectives: [
        { exerciseId: 'pushup', target: 10, progress: 0, note: '' },
        { exerciseId: 'situp', target: 10, progress: 0, note: '' },
        { exerciseId: 'plank', target: 30, progress: 0, note: '' },
      ],
      rewardXp: 75,
      awardedXp: 0,
      status: 'active',
      completedAt: null,
      ...overrides,
    };
  }

  it('adds to the matching objective only', () => {
    const next = addQuestProgress(quest(), 'pushup', 4);
    expect(next.objectives.map((o) => o.progress)).toEqual([4, 0, 0]);
  });

  it('caps progress at the target', () => {
    const once = addQuestProgress(quest(), 'pushup', 25);
    expect(once.objectives[0].progress).toBe(10);
    const twice = addQuestProgress(addQuestProgress(quest(), 'plank', 20), 'plank', 20);
    expect(twice.objectives[2].progress).toBe(30);
  });

  it('reaching exactly the target counts as complete', () => {
    const next = addQuestProgress(quest(), 'pushup', 10);
    expect(next.objectives[0].progress).toBe(10);
  });

  it('returns the same instance when no objective matches', () => {
    const q = quest();
    expect(addQuestProgress(q, 'run', 10)).toBe(q);
  });

  it('returns the same instance when the objective is already complete', () => {
    const q = quest({
      objectives: [
        { exerciseId: 'pushup', target: 10, progress: 10, note: '' },
        { exerciseId: 'situp', target: 10, progress: 0, note: '' },
      ],
    });
    expect(addQuestProgress(q, 'pushup', 5)).toBe(q);
  });

  it.each(['completed', 'failed'] as const)('is a no-op on a %s quest', (status) => {
    const q = quest({ status });
    const next = addQuestProgress(q, 'pushup', 5);
    expect(next).toBe(q);
    expect(next.objectives[0].progress).toBe(0);
  });

  it('does not mutate the input quest', () => {
    const q = deepFreeze(quest());
    const copy = structuredClone(q);
    const next = addQuestProgress(q, 'situp', 3);
    expect(q).toEqual(copy);
    expect(next).not.toBe(q);
    expect(next.status).toBe('active');
  });

  it('isQuestComplete requires every objective to reach its target', () => {
    let q = quest();
    expect(isQuestComplete(q)).toBe(false);
    q = addQuestProgress(q, 'pushup', 10);
    q = addQuestProgress(q, 'situp', 10);
    expect(isQuestComplete(q)).toBe(false);
    q = addQuestProgress(q, 'plank', 29);
    expect(isQuestComplete(q)).toBe(false);
    q = addQuestProgress(q, 'plank', 1);
    expect(isQuestComplete(q)).toBe(true);
  });

  it('questProgress averages capped per-objective progress', () => {
    expect(questProgress(quest())).toBe(0);
    const q = quest({
      objectives: [
        { exerciseId: 'pushup', target: 10, progress: 5, note: '' }, // 0.5
        { exerciseId: 'situp', target: 10, progress: 20, note: '' }, // capped 1
        { exerciseId: 'plank', target: 30, progress: 0, note: '' }, // 0
      ],
    });
    expect(questProgress(q)).toBeCloseTo(0.5, 10);
    expect(questProgress(quest({ objectives: [] }))).toBe(1);
  });
});
