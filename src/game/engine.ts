/**
 * State transitions of the game. Every function is pure: it takes the current
 * GameState plus explicit time inputs and returns a new state + a description
 * of what happened, which the state layer persists and the UI presents.
 */
import { compareDayKeys, diffDays } from './date';
import { assertValidAmount, getExercise } from './exercises';
import {
  addQuestProgress,
  generateDailyQuest,
  generatePenaltyQuest,
  isQuestComplete,
} from './quests';
import {
  evaluateRankExam,
  examCooldownAfterFailure,
  getExamEligibility,
  rankUpRewardXp,
  EXAM_BLOCK_MESSAGES,
  type ExamEvaluation,
  type ExamRank,
} from './rank';
import { applyRecord, recordsFromExam, type RecordEvent } from './records';
import { breakStreak, extendStreak, isRestDay } from './rest-days';
import { assertValidRpe, updateRpeAverage } from './rpe';
import { applyStatXp, assertValidBaseline, createPlayer } from './stats';
import { applyXp } from './xp';
import {
  GameRuleError,
  STAT_KEYS,
  type BaselineTest,
  type DayKey,
  type ExerciseEntry,
  type GameState,
  type Quest,
  type Stats,
} from './types';

export function createInitialState(name: string, baseline: BaselineTest, today: DayKey): GameState {
  const player = createPlayer(name, baseline, today);
  return {
    player,
    dailyQuest: generateDailyQuest(player, today),
    penaltyQuest: null,
    lastRolloverDay: today,
    restDays: [],
  };
}

/** XP is locked while a penalty quest is active (docs §6). */
export function isXpLocked(state: Pick<GameState, 'penaltyQuest'>): boolean {
  return state.penaltyQuest?.status === 'active';
}

// ---------------------------------------------------------------------------
// Day rollover
// ---------------------------------------------------------------------------

export type RolloverEvent =
  | { type: 'daily_failed'; quest: Quest; forgiven: boolean }
  | { type: 'daily_excused'; quest: Quest }
  | { type: 'streak_broken'; previous: number }
  | { type: 'days_skipped'; days: number }
  | { type: 'penalty_started'; quest: Quest }
  | { type: 'penalty_continues'; quest: Quest }
  | { type: 'new_daily'; quest: Quest };

export interface RolloverResult {
  state: GameState;
  events: RolloverEvent[];
  /** Quests removed from state that must be persisted with their final status. */
  archived: Quest[];
  changed: boolean;
}

export function rolloverDay(state: GameState, today: DayKey): RolloverResult {
  const cmp = compareDayKeys(today, state.lastRolloverDay);

  if (cmp < 0) {
    // Clock moved backwards: change nothing.
    return { state, events: [], archived: [], changed: false };
  }

  if (cmp === 0) {
    if (state.dailyQuest && state.dailyQuest.dayKey === today) {
      return { state, events: [], archived: [], changed: false };
    }
    const quest = generateDailyQuest(state.player, today);
    return {
      state: { ...state, dailyQuest: quest },
      events: [{ type: 'new_daily', quest }],
      archived: [],
      changed: true,
    };
  }

  const events: RolloverEvent[] = [];
  const archived: Quest[] = [];
  let missed = false;
  let breaksStreak = false;

  const previous = state.dailyQuest;
  if (previous) {
    if (previous.status === 'active' && isRestDay(state.restDays, previous.dayKey)) {
      const excused: Quest = { ...previous, status: 'excused' };
      events.push({ type: 'daily_excused', quest: excused });
      archived.push(excused);
    } else if (previous.status === 'active') {
      const failed: Quest = { ...previous, status: 'failed' };
      const forgiven = previous.dayKey === state.player.createdDay;
      if (!forgiven) missed = true;
      breaksStreak = true;
      events.push({ type: 'daily_failed', quest: failed, forgiven });
      archived.push(failed);
    } else {
      archived.push(previous);
    }
  }

  const gap = diffDays(state.lastRolloverDay, today);
  if (gap >= 2) {
    missed = true;
    breaksStreak = true;
    events.push({ type: 'days_skipped', days: gap - 1 });
  }

  let player = state.player;
  if (breaksStreak && player.streak.current > 0) {
    events.push({ type: 'streak_broken', previous: player.streak.current });
    player = { ...player, streak: breakStreak(player.streak) };
  }

  let penaltyQuest = state.penaltyQuest;
  if (penaltyQuest && penaltyQuest.status !== 'active') {
    archived.push(penaltyQuest);
    penaltyQuest = null;
  }

  if (missed) {
    if (penaltyQuest) {
      events.push({ type: 'penalty_continues', quest: penaltyQuest });
    } else {
      penaltyQuest = generatePenaltyQuest(player, today);
      events.push({ type: 'penalty_started', quest: penaltyQuest });
    }
  }

  const dailyQuest = generateDailyQuest(player, today);
  events.push({ type: 'new_daily', quest: dailyQuest });

  return {
    state: { ...state, player, dailyQuest, penaltyQuest, lastRolloverDay: today },
    events,
    archived,
    changed: true,
  };
}

// ---------------------------------------------------------------------------
// Exercise logging
// ---------------------------------------------------------------------------

/** Level XP an entry would grant when XP is not locked. */
export function exerciseXp(entry: ExerciseEntry): number {
  return Math.round(entry.amount * getExercise(entry.exerciseId).xpPerUnit);
}

/** Stat XP shares of an entry: round(baseXp · weight). */
export function exerciseStatXp(entry: ExerciseEntry): Partial<Stats> {
  const { xpPerUnit, weights } = getExercise(entry.exerciseId);
  const baseXp = entry.amount * xpPerUnit;
  const shares: Partial<Stats> = {};
  for (const key of STAT_KEYS) {
    const w = weights[key];
    if (w) shares[key] = Math.round(baseXp * w);
  }
  return shares;
}

export interface LogResult {
  state: GameState;
  /** True when XP was locked by an active penalty quest at the start of processing. */
  xpLocked: boolean;
  /** XP granted per entry incl. its record bonus (same order as the input). */
  entryXp: number[];
  /** Whether each entry set a personal record (first or beaten). */
  entryRecord: boolean[];
  /** Whether each entry beat an existing record (boss defeated; first records are not bosses). */
  entryBoss: boolean[];
  exerciseXp: number;
  questRewardXp: number;
  recordBonusXp: number;
  /** exerciseXp + questRewardXp + recordBonusXp */
  totalXp: number;
  /** Record events in order (first records and defeated bosses). */
  recordEvents: RecordEvent[];
  /** True when the daily quest was completed and the streak grew. */
  streakExtended: boolean;
  statXpGained: Partial<Stats>;
  statIncreases: Partial<Stats>;
  fromLevel: number;
  toLevel: number;
  levelsGained: number;
  pointsGained: number;
  completedQuests: Quest[];
  /** Daily quests completed while XP was locked (reward forfeited). */
  forfeitedQuests: Quest[];
}

function mergeStats(into: Partial<Stats>, add: Partial<Stats>): void {
  for (const key of STAT_KEYS) {
    const v = add[key];
    if (v) into[key] = (into[key] ?? 0) + v;
  }
}

/**
 * Processes logged sets in order (docs §4–§6). The caller must run
 * `rolloverDay` for the current day first so the daily quest is today's.
 */
export function applyExerciseLogs(state: GameState, entries: ExerciseEntry[], now: number): LogResult {
  for (const entry of entries) {
    assertValidAmount(entry.exerciseId, entry.amount);
    assertValidRpe(entry.rpe);
  }

  const today = state.lastRolloverDay;
  let current = state;
  const result: LogResult = {
    state,
    xpLocked: isXpLocked(state),
    entryXp: [],
    entryRecord: [],
    entryBoss: [],
    exerciseXp: 0,
    questRewardXp: 0,
    recordBonusXp: 0,
    totalXp: 0,
    recordEvents: [],
    streakExtended: false,
    statXpGained: {},
    statIncreases: {},
    fromLevel: state.player.level,
    toLevel: state.player.level,
    levelsGained: 0,
    pointsGained: 0,
    completedQuests: [],
    forfeitedQuests: [],
  };

  for (const entry of entries) {
    const lockedAtStart = isXpLocked(current);
    let { player, dailyQuest, penaltyQuest } = current;

    // 1. Penalty quest progress (can lift the XP lock for later rewards).
    if (penaltyQuest && penaltyQuest.status === 'active') {
      const updated = addQuestProgress(penaltyQuest, entry.exerciseId, entry.amount);
      if (updated !== penaltyQuest && isQuestComplete(updated)) {
        penaltyQuest = { ...updated, status: 'completed', completedAt: now };
        result.completedQuests.push(penaltyQuest);
      } else {
        penaltyQuest = updated;
      }
    }
    const lockedAfterPenalty = penaltyQuest?.status === 'active';

    // 2. Daily quest progress and reward.
    let questReward = 0;
    if (dailyQuest && dailyQuest.status === 'active') {
      const updated = addQuestProgress(dailyQuest, entry.exerciseId, entry.amount);
      if (updated !== dailyQuest && isQuestComplete(updated)) {
        const awardedXp = lockedAfterPenalty ? 0 : updated.rewardXp;
        dailyQuest = { ...updated, status: 'completed', completedAt: now, awardedXp };
        questReward = awardedXp;
        result.completedQuests.push(dailyQuest);
        if (lockedAfterPenalty) result.forfeitedQuests.push(dailyQuest);
        player = { ...player, streak: extendStreak(player.streak, dailyQuest.dayKey) };
        result.streakExtended = true;
      } else {
        dailyQuest = updated;
      }
    }

    // 3. Exercise XP and stat training XP.
    const xp = lockedAtStart ? 0 : exerciseXp(entry);
    if (!lockedAtStart) {
      const shares = exerciseStatXp(entry);
      const trained = applyStatXp(player.stats, player.statXp, shares);
      player = { ...player, stats: trained.stats, statXp: trained.statXp };
      mergeStats(result.statXpGained, shares);
      mergeStats(result.statIncreases, trained.increases);
    }

    // 4. Level XP.
    const gained = applyXp(player, xp + questReward);
    player = gained.player;
    result.levelsGained += gained.levelsGained;
    result.pointsGained += gained.pointsGained;

    // 5. RPE moving average (not affected by the XP lock).
    if (entry.rpe !== undefined) {
      const average = updateRpeAverage(player.rpe[entry.exerciseId], entry.rpe);
      player = { ...player, rpe: { ...player.rpe, [entry.exerciseId]: average } };
    }

    // 6. Personal record / boss (§10) — bonus uses the level after this set's XP.
    const record = applyRecord(player.records, entry, today, player.level, lockedAtStart);
    let bonus = 0;
    if (record.event) {
      player = { ...player, records: record.records };
      result.recordEvents.push(record.event);
      bonus = record.event.bonusXp;
      if (bonus > 0) {
        const bonusGain = applyXp(player, bonus);
        player = bonusGain.player;
        result.levelsGained += bonusGain.levelsGained;
        result.pointsGained += bonusGain.pointsGained;
      }
    }

    result.entryXp.push(xp + bonus);
    result.entryRecord.push(record.event !== null);
    result.entryBoss.push(record.event?.boss === true);
    result.exerciseXp += xp;
    result.questRewardXp += questReward;
    result.recordBonusXp += bonus;

    current = { ...current, player, dailyQuest, penaltyQuest };
  }

  result.state = current;
  result.totalXp = result.exerciseXp + result.questRewardXp + result.recordBonusXp;
  result.toLevel = current.player.level;
  return result;
}

export function applyExerciseLog(state: GameState, entry: ExerciseEntry, now: number): LogResult {
  return applyExerciseLogs(state, [entry], now);
}

// ---------------------------------------------------------------------------
// Stat allocation & rank exams
// ---------------------------------------------------------------------------

export interface RankExamResult {
  state: GameState;
  evaluation: ExamEvaluation;
  rewardXp: number;
  fromLevel: number;
  toLevel: number;
  levelsGained: number;
  pointsGained: number;
}

export function submitRankExam(state: GameState, results: BaselineTest, today: DayKey): RankExamResult {
  const eligibility = getExamEligibility(state, today);
  if (!eligibility.allowed || !eligibility.target) {
    const reason = eligibility.reason ?? 'level';
    throw new GameRuleError('exam_not_allowed', EXAM_BLOCK_MESSAGES[reason]);
  }
  assertValidBaseline(results);
  const target: ExamRank = eligibility.target;
  const evaluation = evaluateRankExam(target, results);
  const fromLevel = state.player.level;

  const records = recordsFromExam(state.player.records, results, today);

  if (!evaluation.passed) {
    const player = { ...state.player, records, rankExamCooldownUntil: examCooldownAfterFailure(today) };
    return {
      state: { ...state, player },
      evaluation,
      rewardXp: 0,
      fromLevel,
      toLevel: fromLevel,
      levelsGained: 0,
      pointsGained: 0,
    };
  }

  const rewardXp = rankUpRewardXp(target);
  const ranked = { ...state.player, records, rank: target, rankExamCooldownUntil: null };
  const gained = applyXp(ranked, rewardXp);
  return {
    state: { ...state, player: gained.player },
    evaluation,
    rewardXp,
    fromLevel,
    toLevel: gained.player.level,
    levelsGained: gained.levelsGained,
    pointsGained: gained.pointsGained,
  };
}
