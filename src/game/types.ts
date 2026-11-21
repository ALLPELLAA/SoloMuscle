/**
 * Domain types for SoloMuscle's game logic.
 * Pure TypeScript — must not import React, React Native or Expo modules.
 * Rules and formulas: docs/GAME_DESIGN.md
 */

export type StatKey = 'strength' | 'endurance' | 'agility' | 'vitality' | 'flexibility';

export const STAT_KEYS: readonly StatKey[] = [
  'strength',
  'endurance',
  'agility',
  'vitality',
  'flexibility',
] as const;

export const STAT_LABELS: Record<StatKey, string> = {
  strength: 'Güç',
  endurance: 'Dayanıklılık',
  agility: 'Çeviklik',
  vitality: 'Vitalite',
  flexibility: 'Esneklik',
};

export type Stats = Record<StatKey, number>;

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const RANKS: readonly Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

/** Local calendar day in `YYYY-MM-DD` form. */
export type DayKey = string;

export type ExerciseId =
  | 'pushup'
  | 'situp'
  | 'squat'
  | 'plank'
  | 'pullup'
  | 'lunge'
  | 'burpee'
  | 'jumping_jack'
  | 'jump_rope'
  | 'run'
  | 'walk'
  | 'stretch'
  | 'yoga';

export type ExerciseUnit = 'reps' | 'seconds' | 'minutes';

export interface ExerciseDef {
  id: ExerciseId;
  /** Turkish display name. */
  name: string;
  unit: ExerciseUnit;
  xpPerUnit: number;
  /** Stat weights; they sum to 1. */
  weights: Partial<Record<StatKey, number>>;
}

/** Results of the onboarding test and of rank exams. */
export interface BaselineTest {
  pushups: number;
  situps: number;
  squats: number;
  plankSeconds: number;
}

export type RecordSource = 'baseline' | 'set' | 'exam';

/** Best single-set amount of an exercise (docs/GAME_DESIGN.md §10). */
export interface PersonalRecord {
  amount: number;
  dayKey: DayKey;
  source: RecordSource;
  /** Last day a boss bonus was granted for this exercise (max one per day). */
  bonusDay: DayKey | null;
}

export type PersonalRecords = Partial<Record<ExerciseId, PersonalRecord>>;

/** Consecutive completed daily quests; rest days neither break nor extend it (§13). */
export interface Streak {
  current: number;
  best: number;
  lastCompletedDay: DayKey | null;
}

export type RestDayKind = 'rest' | 'sick';

export interface RestDay {
  dayKey: DayKey;
  kind: RestDayKind;
}

export interface Player {
  name: string;
  level: number;
  /** Progress inside the current level. */
  xp: number;
  totalXp: number;
  rank: Rank;
  stats: Stats;
  /** Training progress towards the next point of each stat. */
  statXp: Stats;
  unspentPoints: number;
  baseline: BaselineTest;
  createdDay: DayKey;
  rankExamCooldownUntil: DayKey | null;
  records: PersonalRecords;
  /** Per-exercise RPE moving average (§11). */
  rpe: Partial<Record<ExerciseId, number>>;
  streak: Streak;
}

export type QuestKind = 'daily' | 'penalty';
/** `excused`: not completed on a rest/sick day — no penalty (§13). */
export type QuestStatus = 'active' | 'completed' | 'failed' | 'excused';

export interface QuestObjective {
  exerciseId: ExerciseId;
  target: number;
  progress: number;
  /** Short system explanation of the target (§12). */
  note: string;
}

export interface Quest {
  id: string;
  kind: QuestKind;
  dayKey: DayKey;
  title: string;
  objectives: QuestObjective[];
  rewardXp: number;
  /** XP actually granted on completion (0 if forfeited because XP was locked). */
  awardedXp: number;
  status: QuestStatus;
  completedAt: number | null;
}

export interface GameState {
  player: Player;
  /** Quest for `lastRolloverDay`. */
  dailyQuest: Quest | null;
  /** Current penalty quest (active, or completed but not yet archived). */
  penaltyQuest: Quest | null;
  lastRolloverDay: DayKey;
  /** Days marked as rest/sick (§13). */
  restDays: RestDay[];
}

/** One logged set. `amount` is in the exercise's unit. */
export interface ExerciseEntry {
  exerciseId: ExerciseId;
  amount: number;
  /** Optional perceived exertion 1–10 (§11). */
  rpe?: number;
}

export type GameErrorCode =
  | 'invalid_amount'
  | 'invalid_baseline'
  | 'invalid_allocation'
  | 'invalid_xp'
  | 'exam_not_allowed'
  | 'unknown_exercise'
  | 'invalid_rpe'
  | 'rest_day_not_allowed';

export class GameRuleError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}
