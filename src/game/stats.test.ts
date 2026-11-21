/// <reference types="jest" />
/**
 * Stats, onboarding baseline and stat-point allocation — docs/GAME_DESIGN.md §1–§4.
 * Expected values are computed by hand from the spec formulas.
 */
import {
  BASELINE_LIMITS,
  DEFAULT_PLAYER_NAME,
  STAT_MAX,
  allocateStatPoints,
  applyStatXp,
  createPlayer,
  emptyStats,
  initialStatsFromBaseline,
  normalizePlayerName,
  statXpToNextPoint,
  sumStats,
  validateAllocation,
  validateBaseline,
  weakestStat,
} from './stats';
import { GameRuleError, STAT_KEYS, STAT_LABELS, type BaselineTest, type Player, type Stats } from './types';

function stats(values: Partial<Stats> = {}, fill = 10): Stats {
  return { ...emptyStats(fill), ...values };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Test',
    level: 3,
    xp: 0,
    totalXp: 383,
    rank: 'E',
    stats: stats(),
    statXp: emptyStats(),
    unspentPoints: 3,
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

function baseline(values: Partial<BaselineTest> = {}): BaselineTest {
  return { pushups: 0, situps: 0, squats: 0, plankSeconds: 0, ...values };
}

describe('stat catalogue (§1)', () => {
  it('has the five stats in spec order with Turkish labels', () => {
    expect(STAT_KEYS).toEqual(['strength', 'endurance', 'agility', 'vitality', 'flexibility']);
    expect(STAT_LABELS).toEqual({
      strength: 'Güç',
      endurance: 'Dayanıklılık',
      agility: 'Çeviklik',
      vitality: 'Vitalite',
      flexibility: 'Esneklik',
    });
  });

  it('caps stats at 999', () => {
    expect(STAT_MAX).toBe(999);
  });
});

describe('initialStatsFromBaseline (§2)', () => {
  it('matches the spec example 15/20/25/45 → 12/13/11/10/7', () => {
    // strength    = 5 + 4.5 + 2.5        = 12
    // endurance   = 5 + 4.5 + 3          = 12.5 → 13
    // agility     = 5 + 3.75 + 2         = 10.75 → 11
    // vitality    = 5 + 0.05·60 + 1.5    = 9.5 → 10
    // flexibility = 5 + 1.5              = 6.5 → 7
    expect(initialStatsFromBaseline({ pushups: 15, situps: 20, squats: 25, plankSeconds: 45 })).toEqual({
      strength: 12,
      endurance: 13,
      agility: 11,
      vitality: 10,
      flexibility: 7,
    });
  });

  it('gives 5 in every stat for an all-zero test', () => {
    expect(initialStatsFromBaseline(baseline())).toEqual(emptyStats(5));
  });

  it('rounds each stat with Math.round', () => {
    // strength = 5 + 0.3·1 = 5.3 → 5 ; 5 + 0.3·2 = 5.6 → 6
    expect(initialStatsFromBaseline(baseline({ pushups: 1 })).strength).toBe(5);
    expect(initialStatsFromBaseline(baseline({ pushups: 2 })).strength).toBe(6);
    // endurance = 5 + 14/10 = 6.4 → 6 ; 5 + 16/10 = 6.6 → 7
    expect(initialStatsFromBaseline(baseline({ plankSeconds: 14 })).endurance).toBe(6);
    expect(initialStatsFromBaseline(baseline({ plankSeconds: 16 })).endurance).toBe(7);
    // flexibility = 5 + 15/30 = 5.5 → 6 (half rounds up)
    expect(initialStatsFromBaseline(baseline({ plankSeconds: 15 })).flexibility).toBe(6);
    // agility = 5 + 0.15·10 + 0.1·0 = 6.5 → 7
    expect(initialStatsFromBaseline(baseline({ squats: 10 })).agility).toBe(7);
  });

  it('computes each formula independently', () => {
    // pushups 40, situps 60, squats 80, plank 120
    // strength    = 5 + 12 + 8             = 25
    // endurance   = 5 + 12 + 9             = 26
    // agility     = 5 + 12 + 6             = 23
    // vitality    = 5 + 0.05·180 + 4       = 18
    // flexibility = 5 + 4                  = 9
    expect(initialStatsFromBaseline({ pushups: 40, situps: 60, squats: 80, plankSeconds: 120 })).toEqual({
      strength: 25,
      endurance: 26,
      agility: 23,
      vitality: 18,
      flexibility: 9,
    });
  });

  it('reaches exactly 50 without clamping, and clamps above 50', () => {
    // strength = 5 + 0.3·150 = 50
    expect(initialStatsFromBaseline(baseline({ pushups: 150 })).strength).toBe(50);
    // 5 + 0.3·152 = 50.6 → 51 → clamped to 50
    expect(initialStatsFromBaseline(baseline({ pushups: 152 })).strength).toBe(50);
    // flexibility = 5 + 1350/30 = 50
    expect(initialStatsFromBaseline(baseline({ plankSeconds: 1350 })).flexibility).toBe(50);
  });

  it('clamps every stat to 50 at the maximum valid input', () => {
    expect(
      initialStatsFromBaseline({ pushups: 1000, situps: 1000, squats: 1000, plankSeconds: 3600 }),
    ).toEqual(emptyStats(50));
  });

  it('always yields integers in [1, 50]', () => {
    for (const pushups of [0, 7, 33, 99, 500]) {
      for (const plankSeconds of [0, 1, 59, 301, 3600]) {
        const result = initialStatsFromBaseline({ pushups, situps: pushups, squats: pushups, plankSeconds });
        for (const key of STAT_KEYS) {
          expect(Number.isInteger(result[key])).toBe(true);
          expect(result[key]).toBeGreaterThanOrEqual(1);
          expect(result[key]).toBeLessThanOrEqual(50);
        }
      }
    }
  });

  it('throws GameRuleError(invalid_baseline) for an out-of-range test', () => {
    expect(() => initialStatsFromBaseline(baseline({ pushups: -1 }))).toThrow(GameRuleError);
    try {
      initialStatsFromBaseline(baseline({ plankSeconds: 3601 }));
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRuleError);
      expect((error as GameRuleError).code).toBe('invalid_baseline');
    }
  });

  it('does not mutate the input', () => {
    const input = deepFreeze({ pushups: 15, situps: 20, squats: 25, plankSeconds: 45 });
    expect(() => initialStatsFromBaseline(input)).not.toThrow();
  });
});

describe('validateBaseline (§2 limits)', () => {
  it('declares the spec limits', () => {
    expect(BASELINE_LIMITS.pushups).toMatchObject({ min: 0, max: 1000 });
    expect(BASELINE_LIMITS.situps).toMatchObject({ min: 0, max: 1000 });
    expect(BASELINE_LIMITS.squats).toMatchObject({ min: 0, max: 1000 });
    expect(BASELINE_LIMITS.plankSeconds).toMatchObject({ min: 0, max: 3600 });
  });

  it('accepts both inclusive bounds', () => {
    expect(validateBaseline(baseline())).toEqual({});
    expect(validateBaseline({ pushups: 1000, situps: 1000, squats: 1000, plankSeconds: 3600 })).toEqual({});
  });

  it.each(['pushups', 'situps', 'squats'] as const)('rejects %s = 1001 and -1', (key) => {
    const over = validateBaseline(baseline({ [key]: 1001 }));
    expect(Object.keys(over)).toEqual([key]);
    expect(typeof over[key]).toBe('string');
    const under = validateBaseline(baseline({ [key]: -1 }));
    expect(Object.keys(under)).toEqual([key]);
  });

  it('rejects plankSeconds = 3601 and -1', () => {
    expect(Object.keys(validateBaseline(baseline({ plankSeconds: 3601 })))).toEqual(['plankSeconds']);
    expect(Object.keys(validateBaseline(baseline({ plankSeconds: -1 })))).toEqual(['plankSeconds']);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-integer value %p', (value) => {
    expect(validateBaseline(baseline({ squats: value })).squats).toEqual(expect.any(String));
  });

  it('rejects a non-number value', () => {
    const bad = { ...baseline(), situps: '12' } as unknown as BaselineTest;
    expect(validateBaseline(bad).situps).toEqual(expect.any(String));
  });

  it('reports every invalid field at once', () => {
    const errors = validateBaseline({ pushups: -1, situps: 2000, squats: 0.5, plankSeconds: 4000 });
    expect(Object.keys(errors).sort()).toEqual(['plankSeconds', 'pushups', 'situps', 'squats']);
  });
});

describe('normalizePlayerName & createPlayer (§2)', () => {
  it('trims the name', () => {
    expect(normalizePlayerName('  Jin-Woo  ')).toBe('Jin-Woo');
  });

  it('falls back to "Oyuncu" when empty', () => {
    expect(DEFAULT_PLAYER_NAME).toBe('Oyuncu');
    expect(normalizePlayerName('')).toBe('Oyuncu');
    expect(normalizePlayerName('    ')).toBe('Oyuncu');
  });

  it('keeps at most 20 characters', () => {
    expect(normalizePlayerName('a'.repeat(20))).toBe('a'.repeat(20));
    expect(normalizePlayerName('b'.repeat(25)).length).toBeLessThanOrEqual(20);
    expect(normalizePlayerName('ş')).toBe('ş');
  });

  it('never cuts a character in half when truncating (emoji at the 20th character)', () => {
    // 19 letters + one emoji = 20 characters (21 UTF-16 code units). Truncating by code units
    // would leave a lone high surrogate, which is not a character at all.
    const name = normalizePlayerName(`${'a'.repeat(19)}😀`);
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    expect(loneSurrogate.test(name)).toBe(false);
  });

  it('creates a level-1 E-rank player with zeroed progress', () => {
    const test = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };
    const player = createPlayer('  Ali ', test, '2026-03-10');
    expect(player).toEqual({
      name: 'Ali',
      level: 1,
      xp: 0,
      totalXp: 0,
      rank: 'E',
      stats: { strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 },
      statXp: emptyStats(0),
      unspentPoints: 0,
      baseline: test,
      createdDay: '2026-03-10',
      rankExamCooldownUntil: null,
      // docs §10: onboarding seeds personal records; §11/§13: no RPE data, empty streak
      records: {
        pushup: { amount: 15, dayKey: '2026-03-10', source: 'baseline', bonusDay: null },
        situp: { amount: 20, dayKey: '2026-03-10', source: 'baseline', bonusDay: null },
        squat: { amount: 25, dayKey: '2026-03-10', source: 'baseline', bonusDay: null },
        plank: { amount: 45, dayKey: '2026-03-10', source: 'baseline', bonusDay: null },
      },
      rpe: {},
      streak: { current: 0, best: 0, lastCompletedDay: null },
    });
    expect(player.baseline).not.toBe(test);
  });
});

describe('statXpToNextPoint (§4)', () => {
  it.each([
    [0, 20],
    [1, 25],
    [10, 70],
    [50, 270],
    [998, 5010],
  ])('stat %i needs %i stat XP (20 + 5·v)', (value, need) => {
    expect(statXpToNextPoint(value)).toBe(need);
  });
});

describe('applyStatXp (§4)', () => {
  it('converts stat XP into a point at the exact threshold', () => {
    const result = applyStatXp(stats({ strength: 10 }), emptyStats(), { strength: 70 });
    expect(result.stats.strength).toBe(11);
    expect(result.statXp.strength).toBe(0);
    expect(result.increases).toEqual({ strength: 1 });
  });

  it('keeps the XP when one below the threshold', () => {
    const result = applyStatXp(stats({ strength: 10 }), emptyStats(), { strength: 69 });
    expect(result.stats.strength).toBe(10);
    expect(result.statXp.strength).toBe(69);
    expect(result.increases.strength ?? 0).toBe(0);
  });

  it('adds to existing stat XP', () => {
    const result = applyStatXp(stats({ agility: 4 }), { ...emptyStats(), agility: 30 }, { agility: 10 });
    // need at 4 = 40 → 30 + 10 = 40 → agility 5, 0 left
    expect(result.stats.agility).toBe(5);
    expect(result.statXp.agility).toBe(0);
  });

  it('can raise a stat several points; the requirement grows with each point', () => {
    // 10 → 11 costs 70, 11 → 12 costs 75 → 145 gives +2 ; 146 leaves 1
    const exact = applyStatXp(stats({ strength: 10 }), emptyStats(), { strength: 145 });
    expect(exact.stats.strength).toBe(12);
    expect(exact.statXp.strength).toBe(0);
    expect(exact.increases.strength).toBe(2);
    const plusOne = applyStatXp(stats({ strength: 10 }), emptyStats(), { strength: 146 });
    expect(plusOne.stats.strength).toBe(12);
    expect(plusOne.statXp.strength).toBe(1);
    // 144 is one short of the second point: 11 with 74 left
    const minusOne = applyStatXp(stats({ strength: 10 }), emptyStats(), { strength: 144 });
    expect(minusOne.stats.strength).toBe(11);
    expect(minusOne.statXp.strength).toBe(74);
  });

  it('handles several stats independently', () => {
    const result = applyStatXp(stats(), emptyStats(), { strength: 70, endurance: 20, vitality: 140 });
    expect(result.stats).toEqual(stats({ strength: 11, vitality: 11 }));
    expect(result.statXp).toEqual({ ...emptyStats(), endurance: 20, vitality: 70 });
    expect(result.increases).toEqual({ strength: 1, vitality: 1 });
  });

  it('stops at 999 and keeps the excess stat XP', () => {
    // 998 → 999 costs 5010
    const toCap = applyStatXp(stats({ strength: 998 }), emptyStats(), { strength: 5010 + 6000 });
    expect(toCap.stats.strength).toBe(999);
    expect(toCap.statXp.strength).toBe(6000);
    expect(toCap.increases.strength).toBe(1);

    const atCap = applyStatXp(stats({ strength: 999 }), emptyStats(), { strength: 100000 });
    expect(atCap.stats.strength).toBe(999);
    expect(atCap.statXp.strength).toBe(100000);
    expect(atCap.increases.strength ?? 0).toBe(0);
  });

  it('with no gains returns equal values', () => {
    const s = stats({ flexibility: 3 });
    const x = { ...emptyStats(), flexibility: 5 };
    const result = applyStatXp(s, x, {});
    expect(result.stats).toEqual(s);
    expect(result.statXp).toEqual(x);
    expect(result.increases).toEqual({});
  });

  it('does not mutate its inputs', () => {
    const s = deepFreeze(stats({ strength: 10 }));
    const x = deepFreeze(emptyStats());
    const g = deepFreeze({ strength: 500, agility: 30 });
    const sCopy = structuredClone(s);
    const xCopy = structuredClone(x);
    applyStatXp(s, x, g);
    expect(s).toEqual(sCopy);
    expect(x).toEqual(xCopy);
  });
});

describe('validateAllocation (§3 stat points)', () => {
  const player = makePlayer({ unspentPoints: 3 });

  it('accepts spending all points', () => {
    expect(validateAllocation(player, { strength: 3 })).toBeNull();
    expect(validateAllocation(player, { strength: 1, agility: 1, flexibility: 1 })).toBeNull();
  });

  it('accepts a partial allocation (≥ 1 point)', () => {
    expect(validateAllocation(player, { vitality: 1 })).toBeNull();
    expect(validateAllocation(player, { vitality: 1, strength: 0 })).toBeNull();
  });

  it('rejects allocating nothing', () => {
    expect(validateAllocation(player, {})).toEqual(expect.any(String));
    expect(validateAllocation(player, { strength: 0 })).toEqual(expect.any(String));
  });

  it('rejects more points than unspent', () => {
    expect(validateAllocation(player, { strength: 4 })).toEqual(expect.any(String));
    expect(validateAllocation(player, { strength: 2, agility: 2 })).toEqual(expect.any(String));
    expect(validateAllocation(makePlayer({ unspentPoints: 0 }), { strength: 1 })).toEqual(expect.any(String));
  });

  it('rejects negative values even if the total is positive', () => {
    expect(validateAllocation(player, { strength: -1, agility: 2 })).toEqual(expect.any(String));
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-integer value %p', (value) => {
    expect(validateAllocation(player, { strength: value })).toEqual(expect.any(String));
  });

  it('rejects an unknown stat key', () => {
    const bad = { luck: 1 } as unknown as Partial<Stats>;
    expect(validateAllocation(player, bad)).toEqual(expect.any(String));
  });

  it('respects the 999 cap', () => {
    const nearCap = makePlayer({ stats: stats({ strength: 998 }), unspentPoints: 3 });
    expect(validateAllocation(nearCap, { strength: 1 })).toBeNull();
    expect(validateAllocation(nearCap, { strength: 2 })).toEqual(expect.any(String));
    const atCap = makePlayer({ stats: stats({ strength: 999 }), unspentPoints: 3 });
    expect(validateAllocation(atCap, { strength: 1 })).toEqual(expect.any(String));
    expect(validateAllocation(atCap, { agility: 1 })).toBeNull();
  });
});

describe('allocateStatPoints', () => {
  it('adds the points and keeps the remainder unspent', () => {
    const player = makePlayer({ unspentPoints: 5 });
    const next = allocateStatPoints(player, { strength: 2, vitality: 1 });
    expect(next.stats).toEqual(stats({ strength: 12, vitality: 11 }));
    expect(next.unspentPoints).toBe(2);
  });

  it('spends all points', () => {
    const next = allocateStatPoints(makePlayer({ unspentPoints: 3 }), { flexibility: 3 });
    expect(next.stats.flexibility).toBe(13);
    expect(next.unspentPoints).toBe(0);
  });

  it('changes nothing else', () => {
    const player = makePlayer({ unspentPoints: 3 });
    const next = allocateStatPoints(player, { agility: 1 });
    expect({ ...next, stats: player.stats, unspentPoints: player.unspentPoints }).toEqual(player);
  });

  it.each([
    [{ strength: 4 }],
    [{}],
    [{ strength: -1 }],
    [{ strength: 0.5 }],
    [{ luck: 1 } as unknown as Partial<Stats>],
  ])('throws GameRuleError(invalid_allocation) for %p', (allocation) => {
    const player = makePlayer({ unspentPoints: 3 });
    try {
      allocateStatPoints(player, allocation);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRuleError);
      expect((error as GameRuleError).code).toBe('invalid_allocation');
    }
  });

  it('throws when the allocation would exceed 999', () => {
    const player = makePlayer({ stats: stats({ endurance: 999 }), unspentPoints: 3 });
    expect(() => allocateStatPoints(player, { endurance: 1 })).toThrow(GameRuleError);
  });

  it('does not mutate the input player', () => {
    const player = deepFreeze(makePlayer({ unspentPoints: 3 }));
    const copy = structuredClone(player);
    allocateStatPoints(player, { strength: 3 });
    expect(player).toEqual(copy);
  });
});

describe('weakestStat', () => {
  it('returns the unique minimum', () => {
    expect(weakestStat(stats({ flexibility: 3 }))).toBe('flexibility');
    expect(weakestStat(stats({ agility: 9 }))).toBe('agility');
    // spec example stats → flexibility (7)
    expect(weakestStat({ strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 })).toBe(
      'flexibility',
    );
  });

  it('breaks ties by STAT_KEYS order', () => {
    expect(weakestStat(emptyStats(10))).toBe('strength');
    expect(weakestStat(stats({ endurance: 5, vitality: 5 }))).toBe('endurance');
    expect(weakestStat(stats({ vitality: 2, flexibility: 2 }))).toBe('vitality');
    expect(weakestStat(stats({ strength: 4, flexibility: 4 }))).toBe('strength');
  });
});

describe('helpers', () => {
  it('emptyStats fills every key', () => {
    expect(emptyStats()).toEqual({ strength: 0, endurance: 0, agility: 0, vitality: 0, flexibility: 0 });
    expect(emptyStats(7)).toEqual({ strength: 7, endurance: 7, agility: 7, vitality: 7, flexibility: 7 });
  });

  it('sumStats adds the five stats', () => {
    expect(sumStats({ strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 })).toBe(53);
  });
});
