/// <reference types="jest" />
/**
 * RPE & adaptive targets (docs/GAME_DESIGN.md §11, §5 rpeFactor) and the
 * objective notes (§12). Expected values are derived by hand from the spec.
 */
import { applyExerciseLogs, createInitialState, rolloverDay } from './engine';
import { dailyTarget, generateDailyQuest, generatePenaltyQuest } from './quests';
import { assertValidRpe, isValidRpe, rpeFactor, updateRpeAverage } from './rpe';
import {
  GameRuleError,
  type BaselineTest,
  type DayKey,
  type ExerciseId,
  type GameState,
  type Player,
  type Quest,
  type Stats,
} from './types';

const CREATED: DayKey = '2026-11-01';
const TODAY: DayKey = '2026-11-21';
const TOMORROW: DayKey = '2026-11-22';
const NOW = new Date(2026, 10, 21, 18, 0).getTime();

const BASELINE: BaselineTest = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };

function stats(values: Partial<Stats> & { all?: number }): Stats {
  const v = values.all ?? 20;
  return {
    strength: values.strength ?? v,
    endurance: values.endurance ?? v,
    agility: values.agility ?? v,
    vitality: values.vitality ?? v,
    flexibility: values.flexibility ?? v,
  };
}

/** Seeded player: Güç 12, Dayanıklılık 13, Çeviklik 11, Vitalite 10, Esneklik 7, level 1. */
function seededPlayer(overrides: Partial<Player> = {}): Player {
  return { ...createInitialState('Avcı', BASELINE, CREATED).player, ...overrides };
}

function objective(quest: Quest, exerciseId: ExerciseId) {
  const found = quest.objectives.find((o) => o.exerciseId === exerciseId);
  if (!found) throw new Error(`no objective for ${exerciseId}`);
  return found;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('isValidRpe / assertValidRpe (§11: optional integer 1–10)', () => {
  it.each([1, 2, 5, 7, 9, 10])('%p is valid', (value) => {
    expect(isValidRpe(value)).toBe(true);
    expect(() => assertValidRpe(value)).not.toThrow();
  });

  it.each([0, 11, -1, 7.5, 0.5, NaN, Infinity, -Infinity])('%p is invalid', (value) => {
    expect(isValidRpe(value)).toBe(false);
    expect(() => assertValidRpe(value)).toThrow(GameRuleError);
  });

  it.each(['7', null, undefined, {}, true])('non-number %p is invalid for isValidRpe', (value) => {
    expect(isValidRpe(value)).toBe(false);
  });

  it('missing RPE (undefined) is allowed', () => {
    expect(() => assertValidRpe(undefined)).not.toThrow();
  });

  it('throws with code invalid_rpe', () => {
    try {
      assertValidRpe(11);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRuleError);
      expect((error as GameRuleError).code).toBe('invalid_rpe');
    }
  });
});

// ---------------------------------------------------------------------------
// Moving average
// ---------------------------------------------------------------------------

describe('updateRpeAverage (R_new = R ? round2(0.7·R + 0.3·rpe) : rpe)', () => {
  it('first value is taken as-is', () => {
    expect(updateRpeAverage(undefined, 9)).toBe(9);
    expect(updateRpeAverage(undefined, 1)).toBe(1);
  });

  it.each([
    [8, 6, 7.4], // 5.6 + 1.8
    [7, 10, 7.9], // 4.9 + 3.0
    [7.3, 8, 7.51], // 5.11 + 2.4
    [5, 10, 6.5], // 3.5 + 3.0
    [7.4, 3, 6.08], // 5.18 + 0.9
    [6.67, 9, 7.37], // 4.669 + 2.7 = 7.369 → 7.37
    [7.33, 9, 7.83], // 5.131 + 2.7 = 7.831 → 7.83
    [10, 1, 7.3], // 7 + 0.3
  ])('R=%p, rpe=%p → %p', (previous, rpe, expected) => {
    expect(updateRpeAverage(previous, rpe)).toBe(expected);
  });

  it('result always has at most 2 decimals', () => {
    let r: number | undefined;
    for (const rpe of [3, 9, 4, 8, 10, 2, 7, 6, 5, 9]) {
      r = updateRpeAverage(r, rpe);
      expect(Math.round(r * 100) / 100).toBe(r);
    }
  });
});

describe('rpeFactor = clamp(1 + (7 − R)·0.05, 0.8, 1.2)', () => {
  it('no RPE data → 1', () => {
    expect(rpeFactor(undefined)).toBe(1);
  });

  it.each([
    [7, 1],
    [8.4, 0.93], // 1 − 1.4·0.05
    [10, 0.85], // 1 − 3·0.05
    [5, 1.1], // 1 + 2·0.05
    [5.4, 1.08], // 1 + 1.6·0.05
    [3, 1.2], // 1 + 4·0.05 (exactly the cap)
    [2, 1.2], // 1.25 → clamped
    [1, 1.2], // 1.30 → clamped
    [11, 0.8], // 0.80 (exactly the floor)
    [13, 0.8], // 0.70 → clamped
  ])('R=%p → %p', (average, expected) => {
    expect(rpeFactor(average)).toBeCloseTo(expected, 10);
  });
});

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

describe('rpeFactor in daily targets (§5)', () => {
  // pushup, level 1, Güç 12 → statFactor 1.08; raw = 10 · 1 · 1.08 · rf
  it.each([
    [undefined, 11], // 10.8 → 11
    [7, 11], // 10.8 → 11
    [10, 9], // 10.8 · 0.85 = 9.18 → 9
    [1, 13], // 10.8 · 1.2 = 12.96 → 13
    [3, 13], // 10.8 · 1.2 = 12.96 → 13
  ])('pushup with R=%p → %p', (average, expected) => {
    const player = seededPlayer({ rpe: average === undefined ? {} : { pushup: average } });
    expect(dailyTarget('pushup', player)).toBe(expected);
  });

  it('RPE of one exercise does not affect other exercises', () => {
    const player = seededPlayer({ rpe: { pushup: 1 } });
    // situp: 10 · 1 · (0.6 + 13/25 = 1.12) = 11.2 → 11
    expect(dailyTarget('situp', player)).toBe(11);
    // squat: 15 · 1.08 = 16.2 → 16
    expect(dailyTarget('squat', player)).toBe(16);
  });

  it('penalty quests ignore RPE entirely', () => {
    const withRpe = { ...seededPlayer({ level: 3 }), rpe: { burpee: 1, squat: 10, plank: 1, run: 10 } };
    const plain = generatePenaltyQuest({ level: 3 }, TODAY);
    const adjusted = generatePenaltyQuest(withRpe, TODAY);
    // base · levelFactor(3)=1.16: burpee 23.2→25, squat 58→60, plank 139.2→140, run 17.4→17
    expect(adjusted.objectives.map((o) => o.target)).toEqual([25, 60, 140, 17]);
    expect(adjusted.objectives).toEqual(plain.objectives);
    for (const o of adjusted.objectives) expect(o.note).not.toContain('RPE');
  });
});

describe('RPE only affects the NEXT generated daily quest (§11)', () => {
  function stateWithTodayQuest(): GameState {
    const base = createInitialState('Avcı', BASELINE, CREATED);
    return {
      ...base,
      lastRolloverDay: TODAY,
      dailyQuest: generateDailyQuest(base.player, TODAY),
    };
  }

  it("logging RPE keeps today's quest targets; the next day's quest uses the new average", () => {
    const state = stateWithTodayQuest();
    expect(objective(state.dailyQuest!, 'pushup').target).toBe(11);

    // 1 pushup @ RPE 10: +1 XP, strength statXp +1 (round 0.7) — stats stay the same.
    const logged = applyExerciseLogs(state, [{ exerciseId: 'pushup', amount: 1, rpe: 10 }], NOW).state;
    expect(logged.player.rpe.pushup).toBe(10);
    expect(logged.player.stats).toEqual(state.player.stats);
    expect(objective(logged.dailyQuest!, 'pushup').target).toBe(11);

    // Same-day rollover must not regenerate today's quest.
    const same = rolloverDay(logged, TODAY);
    expect(same.changed).toBe(false);
    expect(objective(same.state.dailyQuest!, 'pushup').target).toBe(11);

    // Next day: 10 · 1 · 1.08 · 0.85 = 9.18 → 9
    const next = rolloverDay(logged, TOMORROW).state;
    expect(next.player.level).toBe(1);
    expect(objective(next.dailyQuest!, 'pushup').target).toBe(9);
    // A penalty opened by this rollover is not RPE-adjusted.
    if (next.penaltyQuest) {
      expect(next.penaltyQuest.objectives.map((o) => o.target)).toEqual([20, 50, 120, 15]);
    }
  });
});

// ---------------------------------------------------------------------------
// §12 notes
// ---------------------------------------------------------------------------

describe('daily objective notes (§12)', () => {
  it('matches the spec example exactly (decimal comma, RPE part)', () => {
    const player = seededPlayer({
      level: 3,
      stats: stats({ all: 20, strength: 14, flexibility: 10 }),
      rpe: { pushup: 8.4 },
    });
    const quest = generateDailyQuest(player, TODAY);
    const pushup = objective(quest, 'pushup');
    expect(pushup.target).toBe(13);
    expect(pushup.note).toBe('Taban 10 · Lv 3 ×1,16 · Güç 14 ×1,16 · RPE 8,4 ×0,93 → 13');
  });

  it('omits the RPE part when there is no RPE data', () => {
    const player = seededPlayer({ level: 3, stats: stats({ all: 20, strength: 14, flexibility: 10 }), rpe: {} });
    const quest = generateDailyQuest(player, TODAY);
    // situp: Dayanıklılık 20 → 0.6 + 0.8 = 1.40; 10 · 1.16 · 1.4 = 16.24 → 16
    expect(objective(quest, 'situp').note).toBe('Taban 10 · Lv 3 ×1,16 · Dayanıklılık 20 ×1,40 → 16');
    // squat: 15 · 1.16 · 1.16 = 20.184 → ≥ 20 → nearest 5 → 20
    expect(objective(quest, 'squat').note).toBe('Taban 15 · Lv 3 ×1,16 · Güç 14 ×1,16 → 20');
    // pushup without RPE: 10 · 1.16 · 1.16 = 13.456 → 13
    expect(objective(quest, 'pushup').note).toBe('Taban 10 · Lv 3 ×1,16 · Güç 14 ×1,16 → 13');
  });

  it('RPE below the target zone raises the target', () => {
    const player = seededPlayer({ rpe: { situp: 5.4 } });
    const quest = generateDailyQuest(player, TODAY);
    // 10 · 1 · 1.12 · 1.08 = 12.096 → 12
    expect(objective(quest, 'situp').note).toBe('Taban 10 · Lv 1 ×1,00 · Dayanıklılık 13 ×1,12 · RPE 5,4 ×1,08 → 12');
  });

  it('integer RPE average is written with the factor ×0,85', () => {
    const player = seededPlayer({ rpe: { pushup: 10 } });
    const note = objective(generateDailyQuest(player, TODAY), 'pushup').note;
    // RPE 10 → 0.85; 10 · 1.08 · 0.85 = 9.18 → 9. Value formatting ("10" vs "10,0") is not fixed by the spec.
    expect(note).toMatch(/^Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 · RPE 10(,0)? ×0,85 → 9$/);
  });

  it('seeded player notes (level 1)', () => {
    const quest = generateDailyQuest(seededPlayer(), TODAY);
    expect(quest.objectives.slice(0, 3).map((o) => o.note)).toEqual([
      'Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 → 11', // 10.8 → 11
      'Taban 10 · Lv 1 ×1,00 · Dayanıklılık 13 ×1,12 → 11', // 11.2 → 11
      'Taban 15 · Lv 1 ×1,00 · Güç 12 ×1,08 → 16', // 16.2 → 16
    ]);
    const focus = quest.objectives[3];
    // Weakest: Esneklik 7 → statFactor 0.6 + 0.28 = 0.88; pool stretch (5 dk) / yoga (10 dk)
    const expected: Partial<Record<ExerciseId, string>> = {
      stretch: 'Odak: en zayıf statın Esneklik (7). Taban 5 · Lv 1 ×1,00 · Esneklik 7 ×0,88 → 4', // 4.4 → 4
      yoga: 'Odak: en zayıf statın Esneklik (7). Taban 10 · Lv 1 ×1,00 · Esneklik 7 ×0,88 → 9', // 8.8 → 9
    };
    expect(Object.keys(expected)).toContain(focus.exerciseId);
    expect(focus.note).toBe(expected[focus.exerciseId]);
  });

  it('focus prefix + cap suffix " (üst sınır)"', () => {
    // All stats 75 → tie → weakest is Güç (STAT_KEYS order) → focus pool [lunge].
    // levelFactor(60) = 1 + 0.08·59 = 5.72; statFactor(75) = 3.6 → clamped 3.00
    const player = seededPlayer({ level: 60, stats: stats({ all: 75 }), rpe: {} });
    const quest = generateDailyQuest(player, TODAY);
    expect(quest.objectives.map((o) => o.note)).toEqual([
      'Taban 10 · Lv 60 ×5,72 · Güç 75 ×3,00 → 150 (üst sınır)', // 171.6 → 170 → max 150
      'Taban 10 · Lv 60 ×5,72 · Dayanıklılık 75 ×3,00 → 150 (üst sınır)', // 171.6 → max 150
      'Taban 15 · Lv 60 ×5,72 · Güç 75 ×3,00 → 200 (üst sınır)', // 257.4 → 255 → max 200
      'Odak: en zayıf statın Güç (75). Taban 12 · Lv 60 ×5,72 · Güç 75 ×3,00 → 150 (üst sınır)', // 205.92 → max 150
    ]);
    expect(quest.objectives.map((o) => o.target)).toEqual([150, 150, 200, 150]);
  });

  it('no cap suffix when the target is below max', () => {
    const quest = generateDailyQuest(seededPlayer({ level: 10 }), TODAY);
    for (const o of quest.objectives) expect(o.note).not.toContain('üst sınır');
  });
});

describe('penalty objective notes (§12)', () => {
  it('level 3 — spec example and the other three objectives', () => {
    const quest = generatePenaltyQuest(seededPlayer({ level: 3 }), TODAY);
    expect(quest.objectives.map((o) => o.note)).toEqual([
      'Ceza: taban 20 · Lv 3 ×1,16 → 25', // 23.2 → 25
      'Ceza: taban 50 · Lv 3 ×1,16 → 60', // 58 → 60
      'Ceza: taban 120 · Lv 3 ×1,16 → 140', // 139.2 → 140
      'Ceza: taban 15 · Lv 3 ×1,16 → 17', // 17.4 → 17
    ]);
  });

  it('level 1', () => {
    const quest = generatePenaltyQuest(seededPlayer(), TODAY);
    expect(quest.objectives.map((o) => o.note)).toEqual([
      'Ceza: taban 20 · Lv 1 ×1,00 → 20',
      'Ceza: taban 50 · Lv 1 ×1,00 → 50',
      'Ceza: taban 120 · Lv 1 ×1,00 → 120',
      'Ceza: taban 15 · Lv 1 ×1,00 → 15',
    ]);
  });
});

describe('purity', () => {
  it('quest generation does not mutate the player', () => {
    const player = seededPlayer({ rpe: { pushup: 8.4, situp: 5 } });
    const snapshot = structuredClone(player);
    generateDailyQuest(player, TODAY);
    generatePenaltyQuest(player, TODAY);
    dailyTarget('pushup', player);
    expect(player).toEqual(snapshot);
  });
});
