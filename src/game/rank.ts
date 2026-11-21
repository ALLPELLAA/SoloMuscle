import { addDays, compareDayKeys } from './date';
import { RANKS, type BaselineTest, type DayKey, type GameState, type Rank } from './types';

export type ExamRank = Exclude<Rank, 'E'>;

export interface RankRequirement {
  minLevel: number;
  thresholds: BaselineTest;
}

export const RANK_REQUIREMENTS: Record<ExamRank, RankRequirement> = {
  D: { minLevel: 5, thresholds: { pushups: 20, situps: 25, squats: 30, plankSeconds: 60 } },
  C: { minLevel: 12, thresholds: { pushups: 35, situps: 40, squats: 50, plankSeconds: 90 } },
  B: { minLevel: 22, thresholds: { pushups: 50, situps: 55, squats: 75, plankSeconds: 150 } },
  A: { minLevel: 35, thresholds: { pushups: 70, situps: 75, squats: 100, plankSeconds: 210 } },
  S: { minLevel: 50, thresholds: { pushups: 100, situps: 100, squats: 150, plankSeconds: 300 } },
};

export const EXAM_METRICS: readonly { key: keyof BaselineTest; label: string; unit: string }[] = [
  { key: 'pushups', label: 'Şınav', unit: 'tekrar' },
  { key: 'situps', label: 'Mekik', unit: 'tekrar' },
  { key: 'squats', label: 'Squat', unit: 'tekrar' },
  { key: 'plankSeconds', label: 'Plank', unit: 'sn' },
];

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

export function nextRank(rank: Rank): ExamRank | null {
  const index = rankIndex(rank);
  return index >= 0 && index < RANKS.length - 1 ? (RANKS[index + 1] as ExamRank) : null;
}

export function rankUpRewardXp(target: ExamRank): number {
  return 250 * rankIndex(target);
}

export type ExamBlockReason = 'max_rank' | 'penalty' | 'level' | 'cooldown';

export interface ExamEligibility {
  allowed: boolean;
  reason: ExamBlockReason | null;
  target: ExamRank | null;
  requiredLevel: number | null;
  cooldownUntil: DayKey | null;
}

export const EXAM_BLOCK_MESSAGES: Record<ExamBlockReason, string> = {
  max_rank: 'En yüksek ranka ulaştın. Sistem seni S rank olarak tanıyor.',
  penalty: 'Ceza görevi aktifken rank sınavına giremezsin.',
  level: 'Bu sınav için level yetersiz.',
  cooldown: 'Başarısız denemeden sonra sınav ertesi gün tekrar açılır.',
};

export function getExamEligibility(state: GameState, today: DayKey): ExamEligibility {
  const { player } = state;
  const target = nextRank(player.rank);
  if (!target) {
    return { allowed: false, reason: 'max_rank', target: null, requiredLevel: null, cooldownUntil: null };
  }
  const requiredLevel = RANK_REQUIREMENTS[target].minLevel;
  const base = { target, requiredLevel, cooldownUntil: player.rankExamCooldownUntil };
  if (state.penaltyQuest?.status === 'active') {
    return { ...base, allowed: false, reason: 'penalty' };
  }
  if (player.level < requiredLevel) {
    return { ...base, allowed: false, reason: 'level' };
  }
  if (player.rankExamCooldownUntil && compareDayKeys(today, player.rankExamCooldownUntil) < 0) {
    return { ...base, allowed: false, reason: 'cooldown' };
  }
  return { ...base, allowed: true, reason: null };
}

export interface ExamCheck {
  key: keyof BaselineTest;
  label: string;
  unit: string;
  required: number;
  actual: number;
  passed: boolean;
}

export interface ExamEvaluation {
  target: ExamRank;
  passed: boolean;
  checks: ExamCheck[];
}

/** Pass only if every threshold is met. */
export function evaluateRankExam(target: ExamRank, results: BaselineTest): ExamEvaluation {
  const { thresholds } = RANK_REQUIREMENTS[target];
  const checks = EXAM_METRICS.map(({ key, label, unit }) => {
    const actual = results[key];
    const required = thresholds[key];
    return { key, label, unit, required, actual, passed: actual >= required };
  });
  return { target, passed: checks.every((c) => c.passed), checks };
}

export function examCooldownAfterFailure(today: DayKey): DayKey {
  return addDays(today, 1);
}
