/** Perceived exertion (RPE 1–10) and adaptive quest targets (docs/GAME_DESIGN.md §11). */
import { GameRuleError, type ExerciseId, type Player } from './types';

export const RPE_MIN = 1;
export const RPE_MAX = 10;
/** Target effort zone used by the quest generator. */
export const RPE_TARGET = 7;

export const RPE_LABELS: Record<number, string> = {
  1: 'Çok kolay',
  2: 'Kolay',
  3: 'Rahat',
  4: 'Orta-hafif',
  5: 'Orta',
  6: 'Biraz zor',
  7: 'Zor',
  8: 'Çok zor',
  9: 'Neredeyse limit',
  10: 'Maksimum efor',
};

export function isValidRpe(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= RPE_MIN && value <= RPE_MAX;
}

export function assertValidRpe(value: number | undefined): void {
  if (value === undefined) return;
  if (!isValidRpe(value)) throw new GameRuleError('invalid_rpe', 'RPE 1–10 arasında bir tam sayı olmalı.');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Exponential moving average: first value as-is, then 0.7·old + 0.3·new (2 decimals). */
export function updateRpeAverage(previous: number | undefined, rpe: number): number {
  return previous === undefined ? rpe : round2(0.7 * previous + 0.3 * rpe);
}

/** clamp(1 + (7 − R)·0.05, 0.8, 1.2); 1 when there is no RPE data. */
export function rpeFactor(average: number | undefined): number {
  if (average === undefined) return 1;
  return Math.min(1.2, Math.max(0.8, 1 + (RPE_TARGET - average) * 0.05));
}

export function playerRpe(player: Pick<Player, 'rpe'>, exerciseId: ExerciseId): number | undefined {
  return player.rpe?.[exerciseId];
}
