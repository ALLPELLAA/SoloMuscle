import { GameRuleError, type Player } from './types';

export const STAT_POINTS_PER_LEVEL = 3;

/** XP needed to go from `level` to `level + 1`: round(100 · level^1.5). */
export function xpToNextLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new GameRuleError('invalid_xp', `Geçersiz level: ${level}`);
  }
  return Math.round(100 * Math.pow(level, 1.5));
}

/** Total XP needed to reach `level` from level 1 with 0 XP. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNextLevel(l);
  return total;
}

/** 0..1 progress inside the current level. */
export function levelProgress(player: Pick<Player, 'level' | 'xp'>): number {
  const need = xpToNextLevel(player.level);
  return Math.min(1, Math.max(0, player.xp / need));
}

export interface XpGainResult {
  player: Player;
  levelsGained: number;
  pointsGained: number;
}

/** Adds XP, levelling up as many times as needed (+3 stat points per level). */
export function applyXp(player: Player, amount: number): XpGainResult {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new GameRuleError('invalid_xp', `Geçersiz XP: ${amount}`);
  }
  const gain = Math.round(amount);
  let { level, xp } = player;
  xp += gain;
  let levelsGained = 0;
  let need = xpToNextLevel(level);
  while (xp >= need) {
    xp -= need;
    level += 1;
    levelsGained += 1;
    need = xpToNextLevel(level);
  }
  const pointsGained = levelsGained * STAT_POINTS_PER_LEVEL;
  return {
    player: {
      ...player,
      level,
      xp,
      totalXp: player.totalXp + gain,
      unspentPoints: player.unspentPoints + pointsGained,
    },
    levelsGained,
    pointsGained,
  };
}
