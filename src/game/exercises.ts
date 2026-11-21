import {
  GameRuleError,
  STAT_KEYS,
  type ExerciseDef,
  type ExerciseId,
  type ExerciseUnit,
  type StatKey,
} from './types';

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  pushup: { id: 'pushup', name: 'Şınav', unit: 'reps', xpPerUnit: 1, weights: { strength: 0.7, endurance: 0.3 } },
  situp: { id: 'situp', name: 'Mekik', unit: 'reps', xpPerUnit: 0.8, weights: { endurance: 0.6, strength: 0.4 } },
  squat: { id: 'squat', name: 'Squat', unit: 'reps', xpPerUnit: 0.8, weights: { strength: 0.6, agility: 0.4 } },
  plank: { id: 'plank', name: 'Plank', unit: 'seconds', xpPerUnit: 0.5, weights: { endurance: 0.7, vitality: 0.3 } },
  pullup: { id: 'pullup', name: 'Barfiks', unit: 'reps', xpPerUnit: 3, weights: { strength: 0.8, endurance: 0.2 } },
  lunge: { id: 'lunge', name: 'Lunge', unit: 'reps', xpPerUnit: 0.8, weights: { strength: 0.5, agility: 0.5 } },
  burpee: {
    id: 'burpee',
    name: 'Burpee',
    unit: 'reps',
    xpPerUnit: 2,
    weights: { agility: 0.5, endurance: 0.3, strength: 0.2 },
  },
  jumping_jack: {
    id: 'jumping_jack',
    name: 'Jumping Jack',
    unit: 'reps',
    xpPerUnit: 0.3,
    weights: { agility: 0.6, vitality: 0.4 },
  },
  jump_rope: {
    id: 'jump_rope',
    name: 'İp Atlama',
    unit: 'minutes',
    xpPerUnit: 6,
    weights: { agility: 0.7, endurance: 0.3 },
  },
  run: { id: 'run', name: 'Koşu', unit: 'minutes', xpPerUnit: 8, weights: { endurance: 0.5, vitality: 0.5 } },
  walk: { id: 'walk', name: 'Yürüyüş', unit: 'minutes', xpPerUnit: 3, weights: { vitality: 0.8, endurance: 0.2 } },
  stretch: { id: 'stretch', name: 'Esneme', unit: 'minutes', xpPerUnit: 4, weights: { flexibility: 1 } },
  yoga: { id: 'yoga', name: 'Yoga', unit: 'minutes', xpPerUnit: 5, weights: { flexibility: 0.7, vitality: 0.3 } },
};

/** Display order for pickers. */
export const EXERCISE_IDS: readonly ExerciseId[] = [
  'pushup',
  'situp',
  'squat',
  'plank',
  'pullup',
  'lunge',
  'burpee',
  'jumping_jack',
  'jump_rope',
  'run',
  'walk',
  'stretch',
  'yoga',
];

export const UNIT_LABELS: Record<ExerciseUnit, { short: string; long: string }> = {
  reps: { short: 'tekrar', long: 'Tekrar' },
  seconds: { short: 'sn', long: 'Saniye' },
  minutes: { short: 'dk', long: 'Dakika' },
};

export const AMOUNT_LIMITS: Record<ExerciseUnit, { min: number; max: number }> = {
  reps: { min: 1, max: 1000 },
  seconds: { min: 1, max: 7200 },
  minutes: { min: 1, max: 600 },
};

export function isExerciseId(value: string): value is ExerciseId {
  return Object.prototype.hasOwnProperty.call(EXERCISES, value);
}

export function getExercise(id: ExerciseId): ExerciseDef {
  if (!isExerciseId(id)) {
    throw new GameRuleError('unknown_exercise', `Bilinmeyen egzersiz: ${String(id)}`);
  }
  return EXERCISES[id];
}

/** Highest-weighted stat of an exercise (ties broken by STAT_KEYS order). */
export function primaryStat(id: ExerciseId): StatKey {
  const { weights } = getExercise(id);
  let best: StatKey = STAT_KEYS[0];
  let bestWeight = -1;
  for (const key of STAT_KEYS) {
    const w = weights[key] ?? 0;
    if (w > bestWeight) {
      best = key;
      bestWeight = w;
    }
  }
  return best;
}

/** Returns a Turkish error message, or `null` when the amount is valid. */
export function validateExerciseAmount(id: ExerciseId, amount: number): string | null {
  if (!isExerciseId(id)) return 'Bilinmeyen egzersiz.';
  const { unit } = EXERCISES[id];
  const { min, max } = AMOUNT_LIMITS[unit];
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount)) {
    return 'Geçerli bir tam sayı gir.';
  }
  if (amount < min || amount > max) {
    return `${UNIT_LABELS[unit].long} ${min}–${max} arasında olmalı.`;
  }
  return null;
}

export function assertValidAmount(id: ExerciseId, amount: number): void {
  const error = validateExerciseAmount(id, amount);
  if (error) throw new GameRuleError('invalid_amount', error);
}

/** `12 tekrar`, `45 sn`, `10 dk` */
export function formatAmount(id: ExerciseId, amount: number): string {
  return `${amount} ${UNIT_LABELS[getExercise(id).unit].short}`;
}
