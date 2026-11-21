/// <reference types="jest" />
/**
 * Level / XP rules — docs/GAME_DESIGN.md §3.
 * Expected values are computed by hand from xpToNextLevel(L) = round(100 · L^1.5).
 */
import { GameRuleError, type Player } from './types';
import {
  STAT_POINTS_PER_LEVEL,
  applyXp,
  levelProgress,
  totalXpForLevel,
  xpToNextLevel,
} from './xp';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Test',
    level: 1,
    xp: 0,
    totalXp: 0,
    rank: 'E',
    stats: { strength: 12, endurance: 13, agility: 11, vitality: 10, flexibility: 7 },
    statXp: { strength: 0, endurance: 0, agility: 0, vitality: 0, flexibility: 0 },
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

describe('xpToNextLevel', () => {
  // Spec table §3.
  it.each([
    [1, 100],
    [2, 283],
    [3, 520],
    [4, 800],
    [5, 1118],
    [10, 3162],
  ])('L%i needs %i XP (spec table)', (level, need) => {
    expect(xpToNextLevel(level)).toBe(need);
  });

  it.each([
    // 6^1.5 = 14.6969… → 1470 ; 7^1.5 = 18.5203… → 1852 ; 9^1.5 = 27 → 2700 ; 16^1.5 = 64 → 6400
    [6, 1470],
    [7, 1852],
    [9, 2700],
    [16, 6400],
  ])('L%i needs %i XP (hand computed)', (level, need) => {
    expect(xpToNextLevel(level)).toBe(need);
  });

  it('is strictly increasing', () => {
    for (let l = 1; l < 100; l++) {
      expect(xpToNextLevel(l + 1)).toBeGreaterThan(xpToNextLevel(l));
    }
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid level %p', (level) => {
    expect(() => xpToNextLevel(level)).toThrow(GameRuleError);
  });
});

describe('totalXpForLevel', () => {
  it.each([
    [1, 0],
    [2, 100],
    [3, 383], // 100 + 283
    [4, 903], // + 520
    [5, 1703], // + 800
    [6, 2821], // + 1118
  ])('reaching L%i takes %i XP in total', (level, total) => {
    expect(totalXpForLevel(level)).toBe(total);
  });
});

describe('levelProgress', () => {
  it('is xp / need inside the level', () => {
    expect(levelProgress({ level: 1, xp: 0 })).toBe(0);
    expect(levelProgress({ level: 1, xp: 50 })).toBeCloseTo(0.5);
    expect(levelProgress({ level: 4, xp: 200 })).toBeCloseTo(0.25);
  });

  it('is clamped to [0, 1]', () => {
    expect(levelProgress({ level: 1, xp: 500 })).toBe(1);
    expect(levelProgress({ level: 1, xp: -10 })).toBe(0);
  });
});

describe('applyXp', () => {
  it('grants 3 stat points per level', () => {
    expect(STAT_POINTS_PER_LEVEL).toBe(3);
  });

  it('adding 0 XP changes nothing', () => {
    const player = makePlayer({ xp: 40, totalXp: 40 });
    const result = applyXp(player, 0);
    expect(result.player).toEqual(player);
    expect(result.levelsGained).toBe(0);
    expect(result.pointsGained).toBe(0);
  });

  it('stays on the level one XP below the threshold', () => {
    const result = applyXp(makePlayer(), 99);
    expect(result.player.level).toBe(1);
    expect(result.player.xp).toBe(99);
    expect(result.player.totalXp).toBe(99);
    expect(result.levelsGained).toBe(0);
    expect(result.player.unspentPoints).toBe(0);
  });

  it('levels up exactly at the threshold (xp ≥ need) and carries 0 XP', () => {
    const result = applyXp(makePlayer(), 100);
    expect(result.player.level).toBe(2);
    expect(result.player.xp).toBe(0);
    expect(result.player.totalXp).toBe(100);
    expect(result.levelsGained).toBe(1);
    expect(result.pointsGained).toBe(3);
    expect(result.player.unspentPoints).toBe(3);
  });

  it('carries the overflow XP into the next level', () => {
    const result = applyXp(makePlayer({ xp: 90, totalXp: 90 }), 50);
    expect(result.player.level).toBe(2);
    expect(result.player.xp).toBe(40);
    expect(result.player.totalXp).toBe(140);
  });

  it('can jump several levels at once (L1 → L4 with 903 XP)', () => {
    const result = applyXp(makePlayer(), 903);
    expect(result.player.level).toBe(4);
    expect(result.player.xp).toBe(0);
    expect(result.levelsGained).toBe(3);
    expect(result.pointsGained).toBe(9);
    expect(result.player.unspentPoints).toBe(9);
    expect(result.player.totalXp).toBe(903);
  });

  it('one XP short of a multi-level jump stops one level earlier', () => {
    const result = applyXp(makePlayer(), 902);
    expect(result.player.level).toBe(3);
    expect(result.player.xp).toBe(519);
    expect(result.levelsGained).toBe(2);
    expect(result.player.unspentPoints).toBe(6);
  });

  it('adds to existing xp, totalXp and unspent points', () => {
    const player = makePlayer({ level: 2, xp: 200, totalXp: 300, unspentPoints: 2 });
    const result = applyXp(player, 83 + 520 + 10); // finish L2 (283) and L3 (520), 10 left
    expect(result.player.level).toBe(4);
    expect(result.player.xp).toBe(10);
    expect(result.player.totalXp).toBe(300 + 613);
    expect(result.player.unspentPoints).toBe(2 + 6);
    expect(result.levelsGained).toBe(2);
    expect(result.pointsGained).toBe(6);
  });

  it('jumps from L1 to L11 when given the full sum of L1..L10 requirements', () => {
    let sum = 0;
    for (const need of [100, 283, 520, 800, 1118, 1470, 1852, 2263, 2700, 3162]) sum += need;
    const result = applyXp(makePlayer(), sum);
    expect(result.player.level).toBe(11);
    expect(result.player.xp).toBe(0);
    expect(result.player.unspentPoints).toBe(30);
  });

  it.each([-1, -0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'throws GameRuleError(invalid_xp) for %p',
    (amount) => {
      expect(() => applyXp(makePlayer(), amount)).toThrow(GameRuleError);
      try {
        applyXp(makePlayer(), amount);
      } catch (error) {
        expect((error as GameRuleError).code).toBe('invalid_xp');
      }
    },
  );

  it('does not mutate the input player', () => {
    const player = deepFreeze(makePlayer({ xp: 50, totalXp: 50 }));
    const copy = structuredClone(player);
    const result = applyXp(player, 1000);
    expect(player).toEqual(copy);
    expect(result.player).not.toBe(player);
  });

  it('keeps every non-XP field untouched', () => {
    const player = makePlayer({ rank: 'C', rankExamCooldownUntil: '2026-02-01' });
    const { player: next } = applyXp(player, 5000);
    expect(next.name).toBe(player.name);
    expect(next.rank).toBe('C');
    expect(next.stats).toEqual(player.stats);
    expect(next.statXp).toEqual(player.statXp);
    expect(next.baseline).toEqual(player.baseline);
    expect(next.createdDay).toBe(player.createdDay);
    expect(next.rankExamCooldownUntil).toBe('2026-02-01');
  });

  it('is deterministic', () => {
    const player = makePlayer({ xp: 33 });
    expect(applyXp(player, 777)).toEqual(applyXp(player, 777));
  });
});
