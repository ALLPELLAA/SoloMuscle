/// <reference types="jest" />
/**
 * Exercise catalogue and amount validation — docs/GAME_DESIGN.md §4.
 */
import {
  AMOUNT_LIMITS,
  EXERCISES,
  EXERCISE_IDS,
  UNIT_LABELS,
  assertValidAmount,
  formatAmount,
  getExercise,
  isExerciseId,
  primaryStat,
  validateExerciseAmount,
} from './exercises';
import { GameRuleError, STAT_KEYS, type ExerciseId, type ExerciseUnit, type StatKey } from './types';

/** Spec table §4, transcribed by hand. */
const SPEC: Record<
  ExerciseId,
  { name: string; unit: ExerciseUnit; xpPerUnit: number; weights: Partial<Record<StatKey, number>>; primary: StatKey }
> = {
  pushup: { name: 'Şınav', unit: 'reps', xpPerUnit: 1, weights: { strength: 0.7, endurance: 0.3 }, primary: 'strength' },
  situp: { name: 'Mekik', unit: 'reps', xpPerUnit: 0.8, weights: { endurance: 0.6, strength: 0.4 }, primary: 'endurance' },
  squat: { name: 'Squat', unit: 'reps', xpPerUnit: 0.8, weights: { strength: 0.6, agility: 0.4 }, primary: 'strength' },
  plank: { name: 'Plank', unit: 'seconds', xpPerUnit: 0.5, weights: { endurance: 0.7, vitality: 0.3 }, primary: 'endurance' },
  pullup: { name: 'Barfiks', unit: 'reps', xpPerUnit: 3, weights: { strength: 0.8, endurance: 0.2 }, primary: 'strength' },
  // .5 / .5 tie → STAT_KEYS order → strength
  lunge: { name: 'Lunge', unit: 'reps', xpPerUnit: 0.8, weights: { strength: 0.5, agility: 0.5 }, primary: 'strength' },
  burpee: {
    name: 'Burpee',
    unit: 'reps',
    xpPerUnit: 2,
    weights: { agility: 0.5, endurance: 0.3, strength: 0.2 },
    primary: 'agility',
  },
  jumping_jack: {
    name: 'Jumping Jack',
    unit: 'reps',
    xpPerUnit: 0.3,
    weights: { agility: 0.6, vitality: 0.4 },
    primary: 'agility',
  },
  jump_rope: {
    name: 'İp Atlama',
    unit: 'minutes',
    xpPerUnit: 6,
    weights: { agility: 0.7, endurance: 0.3 },
    primary: 'agility',
  },
  // .5 / .5 tie → endurance comes before vitality
  run: { name: 'Koşu', unit: 'minutes', xpPerUnit: 8, weights: { endurance: 0.5, vitality: 0.5 }, primary: 'endurance' },
  walk: { name: 'Yürüyüş', unit: 'minutes', xpPerUnit: 3, weights: { vitality: 0.8, endurance: 0.2 }, primary: 'vitality' },
  stretch: { name: 'Esneme', unit: 'minutes', xpPerUnit: 4, weights: { flexibility: 1 }, primary: 'flexibility' },
  yoga: { name: 'Yoga', unit: 'minutes', xpPerUnit: 5, weights: { flexibility: 0.7, vitality: 0.3 }, primary: 'flexibility' },
};

const ALL_IDS = Object.keys(SPEC) as ExerciseId[];

describe('exercise catalogue (§4 table)', () => {
  it('contains exactly the 13 spec exercises', () => {
    expect(Object.keys(EXERCISES).sort()).toEqual([...ALL_IDS].sort());
    expect([...EXERCISE_IDS].sort()).toEqual([...ALL_IDS].sort());
    expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length);
  });

  it.each(ALL_IDS)('%s matches the spec (name, unit, XP/unit, weights)', (id) => {
    const def = EXERCISES[id];
    const spec = SPEC[id];
    expect(def.id).toBe(id);
    expect(def.name).toBe(spec.name);
    expect(def.unit).toBe(spec.unit);
    expect(def.xpPerUnit).toBe(spec.xpPerUnit);
    // Compare weights over all stats so a missing/extra key is caught.
    for (const key of STAT_KEYS) {
      expect(def.weights[key] ?? 0).toBeCloseTo(spec.weights[key] ?? 0, 10);
    }
  });

  it.each(ALL_IDS)('%s weights sum to 1', (id) => {
    const sum = STAT_KEYS.reduce((acc, key) => acc + (EXERCISES[id].weights[key] ?? 0), 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it.each(ALL_IDS)('%s weights are all positive', (id) => {
    for (const w of Object.values(EXERCISES[id].weights)) expect(w).toBeGreaterThan(0);
  });
});

describe('primaryStat', () => {
  it.each(ALL_IDS)('%s → highest weight (ties by STAT_KEYS order)', (id) => {
    expect(primaryStat(id)).toBe(SPEC[id].primary);
  });

  it('throws for an unknown exercise', () => {
    expect(() => primaryStat('deadlift' as ExerciseId)).toThrow(GameRuleError);
  });
});

describe('isExerciseId / getExercise', () => {
  it('recognises catalogue ids', () => {
    for (const id of ALL_IDS) expect(isExerciseId(id)).toBe(true);
  });

  it('rejects unknown ids, including Object.prototype keys', () => {
    for (const id of ['', 'Pushup', 'deadlift', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(isExerciseId(id)).toBe(false);
    }
  });

  it('returns the definition', () => {
    expect(getExercise('plank')).toBe(EXERCISES.plank);
  });

  it('throws GameRuleError(unknown_exercise) for an unknown id', () => {
    try {
      getExercise('toString' as ExerciseId);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRuleError);
      expect((error as GameRuleError).code).toBe('unknown_exercise');
    }
  });
});

describe('validateExerciseAmount (§4 limits)', () => {
  it('declares the spec limits per unit', () => {
    expect(AMOUNT_LIMITS).toEqual({
      reps: { min: 1, max: 1000 },
      seconds: { min: 1, max: 7200 },
      minutes: { min: 1, max: 600 },
    });
  });

  it.each([
    ['pushup', 1000],
    ['pullup', 1000],
    ['plank', 7200],
    ['run', 600],
    ['stretch', 600],
  ] as const)('%s: accepts 1 and the max %i, rejects 0 and max+1', (id, max) => {
    expect(validateExerciseAmount(id, 1)).toBeNull();
    expect(validateExerciseAmount(id, max)).toBeNull();
    expect(validateExerciseAmount(id, 0)).toEqual(expect.any(String));
    expect(validateExerciseAmount(id, max + 1)).toEqual(expect.any(String));
  });

  it('applies the unit of the exercise (1001 reps invalid, 1001 seconds valid)', () => {
    expect(validateExerciseAmount('squat', 1001)).toEqual(expect.any(String));
    expect(validateExerciseAmount('plank', 1001)).toBeNull();
    expect(validateExerciseAmount('walk', 601)).toEqual(expect.any(String));
    expect(validateExerciseAmount('plank', 601)).toBeNull();
  });

  it.each([-5, 2.5, 0.999, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects %p',
    (amount) => {
      expect(validateExerciseAmount('pushup', amount)).toEqual(expect.any(String));
    },
  );

  it('rejects a non-number amount', () => {
    expect(validateExerciseAmount('pushup', '10' as unknown as number)).toEqual(expect.any(String));
  });

  it('rejects an unknown exercise', () => {
    expect(validateExerciseAmount('deadlift' as ExerciseId, 10)).toEqual(expect.any(String));
  });

  it('assertValidAmount throws GameRuleError(invalid_amount)', () => {
    expect(() => assertValidAmount('pushup', 10)).not.toThrow();
    try {
      assertValidAmount('pushup', 0);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GameRuleError);
      expect((error as GameRuleError).code).toBe('invalid_amount');
    }
  });
});

describe('formatAmount / UNIT_LABELS', () => {
  it('uses Turkish unit labels', () => {
    expect(UNIT_LABELS.reps.short).toBe('tekrar');
    expect(UNIT_LABELS.seconds.short).toBe('sn');
    expect(UNIT_LABELS.minutes.short).toBe('dk');
  });

  it('formats amounts', () => {
    expect(formatAmount('pushup', 12)).toBe('12 tekrar');
    expect(formatAmount('plank', 45)).toBe('45 sn');
    expect(formatAmount('run', 10)).toBe('10 dk');
  });
});
