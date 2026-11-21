/// <reference types="jest" />
/**
 * Workout helpers and rest timer — docs/GAME_DESIGN.md §4, §9.
 */
import type { ExerciseEntry } from './types';
import {
  DEFAULT_REST_SECONDS,
  REST_PRESETS_SECONDS,
  adjustRestTimer,
  formatClock,
  isRestFinished,
  previewSessionXp,
  restRemainingMs,
  startRestTimer,
  summarizeSets,
} from './workout';

const T0 = new Date(2026, 0, 15, 18, 0, 0).getTime();

describe('rest presets', () => {
  it('match the spec (30 / 60 / 90 / 120 / 180 s)', () => {
    expect([...REST_PRESETS_SECONDS]).toEqual([30, 60, 90, 120, 180]);
    expect(REST_PRESETS_SECONDS).toContain(DEFAULT_REST_SECONDS);
  });
});

describe('rest timer', () => {
  it('starts with the full duration', () => {
    const timer = startRestTimer(T0, 60);
    expect(timer).toEqual({ startedAt: T0, durationMs: 60_000 });
    expect(restRemainingMs(timer, T0)).toBe(60_000);
    expect(isRestFinished(timer, T0)).toBe(false);
  });

  it('remaining = max(0, startedAt + duration − now)', () => {
    const timer = startRestTimer(T0, 90);
    expect(restRemainingMs(timer, T0 + 30_000)).toBe(60_000);
    expect(restRemainingMs(timer, T0 + 89_999)).toBe(1);
    expect(restRemainingMs(timer, T0 + 90_000)).toBe(0);
    expect(restRemainingMs(timer, T0 + 600_000)).toBe(0);
  });

  it('stays correct after a long gap (app in background)', () => {
    const timer = startRestTimer(T0, 180);
    expect(restRemainingMs(timer, T0 + 120_000)).toBe(60_000);
  });

  it('finishes exactly at the end, not one ms before', () => {
    const timer = startRestTimer(T0, 30);
    expect(isRestFinished(timer, T0 + 29_999)).toBe(false);
    expect(isRestFinished(timer, T0 + 30_000)).toBe(true);
    expect(isRestFinished(timer, T0 + 31_000)).toBe(true);
  });

  it('a non-positive duration is finished immediately', () => {
    expect(startRestTimer(T0, -10).durationMs).toBe(0);
    expect(isRestFinished(startRestTimer(T0, 0), T0)).toBe(true);
  });

  it('adjust adds seconds to what is left', () => {
    const timer = startRestTimer(T0, 60);
    const now = T0 + 20_000; // 40 s left
    const longer = adjustRestTimer(timer, 30, now);
    expect(restRemainingMs(longer, now)).toBe(70_000);
    expect(restRemainingMs(longer, now + 70_000)).toBe(0);
  });

  it('adjust subtracts seconds but never below zero', () => {
    const timer = startRestTimer(T0, 60);
    const now = T0 + 20_000; // 40 s left
    expect(restRemainingMs(adjustRestTimer(timer, -15, now), now)).toBe(25_000);
    const gone = adjustRestTimer(timer, -60, now);
    expect(restRemainingMs(gone, now)).toBe(0);
    expect(gone.durationMs).toBe(0);
    expect(isRestFinished(gone, now)).toBe(true);
  });

  it('adjust on a finished timer starts from zero', () => {
    const timer = startRestTimer(T0, 30);
    const now = T0 + 100_000;
    expect(restRemainingMs(adjustRestTimer(timer, 30, now), now)).toBe(30_000);
  });

  it('does not mutate the timer', () => {
    const timer = Object.freeze(startRestTimer(T0, 60));
    expect(() => adjustRestTimer(timer, 30, T0 + 1000)).not.toThrow();
    expect(timer).toEqual({ startedAt: T0, durationMs: 60_000 });
  });
});

describe('formatClock (mm:ss, rounded up to whole seconds)', () => {
  it.each([
    [0, '00:00'],
    [1, '00:01'],
    [999, '00:01'],
    [1000, '00:01'],
    [1001, '00:02'],
    [59_000, '00:59'],
    [59_001, '01:00'],
    [60_000, '01:00'],
    [61_500, '01:02'],
    [90_000, '01:30'],
    [180_000, '03:00'],
    [599_000, '09:59'],
    [3_600_000, '60:00'],
    [-500, '00:00'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});

describe('summarizeSets', () => {
  it('totals sets and amounts per exercise in first-appearance order', () => {
    const entries: ExerciseEntry[] = [
      { exerciseId: 'squat', amount: 20 },
      { exerciseId: 'pushup', amount: 10 },
      { exerciseId: 'squat', amount: 15 },
      { exerciseId: 'plank', amount: 45 },
      { exerciseId: 'pushup', amount: 12 },
    ];
    expect(summarizeSets(entries)).toEqual([
      { exerciseId: 'squat', sets: 2, amount: 35 },
      { exerciseId: 'pushup', sets: 2, amount: 22 },
      { exerciseId: 'plank', sets: 1, amount: 45 },
    ]);
  });

  it('empty list → []', () => {
    expect(summarizeSets([])).toEqual([]);
  });

  it('does not mutate the entries', () => {
    const entries = Object.freeze([
      Object.freeze({ exerciseId: 'run' as const, amount: 10 }),
      Object.freeze({ exerciseId: 'run' as const, amount: 5 }),
    ]);
    expect(summarizeSets(entries as unknown as ExerciseEntry[])).toEqual([{ exerciseId: 'run', sets: 2, amount: 15 }]);
    expect(entries[0].amount).toBe(10);
  });
});

describe('previewSessionXp (Σ round(amount · xpPerUnit) per set)', () => {
  it('sums per-set rounded XP', () => {
    // pushup 10 → 10 ; situp 15 → 12 ; plank 45 → 22.5 → 23 ; run 10 → 80
    expect(
      previewSessionXp([
        { exerciseId: 'pushup', amount: 10 },
        { exerciseId: 'situp', amount: 15 },
        { exerciseId: 'plank', amount: 45 },
        { exerciseId: 'run', amount: 10 },
      ]),
    ).toBe(125);
  });

  it('rounds each set separately (2 × situp 3 = 2 + 2, not round(4.8))', () => {
    expect(
      previewSessionXp([
        { exerciseId: 'situp', amount: 3 },
        { exerciseId: 'situp', amount: 3 },
      ]),
    ).toBe(4);
  });

  it.each([
    ['pullup', 5, 15],
    ['burpee', 7, 14],
    ['jump_rope', 3, 18],
    ['walk', 20, 60],
    ['stretch', 5, 20],
    ['yoga', 10, 50],
    ['squat', 25, 20],
    ['lunge', 12, 10], // 9.6 → 10
  ] as const)('%s × %i → %i XP', (exerciseId, amount, xp) => {
    expect(previewSessionXp([{ exerciseId, amount }])).toBe(xp);
  });

  it('empty session → 0', () => {
    expect(previewSessionXp([])).toBe(0);
  });
});
