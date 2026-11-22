/// <reference types="jest" />
/**
 * Row ⇄ domain conversions (pure; no expo-sqlite).
 * Round-trips must be lossless and parsing must be defensive against corrupt rows.
 */
import type { Player, Quest } from '@/game';

import {
  parseBaseline,
  parseRank,
  parseStats,
  playerToParams,
  questToParams,
  rowToExerciseLog,
  rowToPlayer,
  rowToQuest,
  rowToRankExam,
  rowToSession,
  type ExerciseLogRow,
  type PlayerRow,
  type QuestRow,
  type RankExamRow,
  type WorkoutSessionRow,
} from './mappers';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Şükrü İğdeli',
    level: 7,
    xp: 412,
    totalXp: 5123,
    rank: 'D',
    stats: { strength: 21, endurance: 18, agility: 14, vitality: 16, flexibility: 9 },
    statXp: { strength: 33, endurance: 0, agility: 12, vitality: 5, flexibility: 44 },
    unspentPoints: 2,
    baseline: { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 },
    createdDay: '2026-01-10',
    rankExamCooldownUntil: '2026-03-11',
    records: {
      pushup: { amount: 22, dayKey: '2026-03-01', source: 'set', bonusDay: '2026-03-01' },
      plank: { amount: 45, dayKey: '2026-01-10', source: 'baseline', bonusDay: null },
    },
    rpe: { pushup: 7.3, squat: 5 },
    streak: { current: 3, best: 9, lastCompletedDay: '2026-03-09' },
    ...overrides,
  };
}

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'daily-2026-03-10',
    kind: 'daily',
    dayKey: '2026-03-10',
    title: 'Günlük Görev: Gelişim Protokolü',
    objectives: [
      { exerciseId: 'pushup', target: 11, progress: 11, note: 'Taban 10 · Lv 1 ×1,00 · Güç 12 ×1,08 → 11' },
      { exerciseId: 'situp', target: 11, progress: 4, note: 'n2' },
      { exerciseId: 'squat', target: 16, progress: 0, note: 'n3' },
      { exerciseId: 'jump_rope', target: 3, progress: 1, note: 'Odak: …' },
    ],
    rewardXp: 75,
    awardedXp: 0,
    status: 'active',
    completedAt: null,
    ...overrides,
  };
}

/** Builds a PlayerRow from playerToParams output using the documented column order. */
function paramsToPlayerRow(params: (string | number | null)[]): PlayerRow {
  const [
    name,
    level,
    xp,
    totalXp,
    rank,
    stats,
    statXp,
    unspent,
    baseline,
    createdDay,
    cooldown,
    lastRollover,
    dailyId,
    penaltyId,
    updatedAt,
    records,
    rpe,
    streak,
  ] = params;
  return {
    id: 1,
    name: name as string,
    level: level as number,
    xp: xp as number,
    total_xp: totalXp as number,
    rank: rank as string,
    stats: stats as string,
    stat_xp: statXp as string,
    unspent_points: unspent as number,
    baseline: baseline as string,
    created_day: createdDay as string,
    rank_exam_cooldown_until: cooldown as string | null,
    last_rollover_day: lastRollover as string,
    daily_quest_id: dailyId as string | null,
    penalty_quest_id: penaltyId as string | null,
    updated_at: updatedAt as number,
    records: records as string,
    rpe: rpe as string,
    streak: streak as string,
  };
}

function paramsToQuestRow(params: (string | number | null)[]): QuestRow {
  const [id, kind, dayKey, title, objectives, rewardXp, awardedXp, status, completedAt] = params;
  return {
    id: id as string,
    kind: kind as string,
    day_key: dayKey as string,
    title: title as string,
    objectives: objectives as string,
    reward_xp: rewardXp as number,
    awarded_xp: awardedXp as number,
    status: status as string,
    completed_at: completedAt as number | null,
  };
}

function playerRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  const extra = { lastRolloverDay: '2026-03-10', dailyQuestId: null, penaltyQuestId: null, updatedAt: 1 };
  return { ...paramsToPlayerRow(playerToParams(makePlayer(), extra)), ...overrides };
}

function questRow(overrides: Partial<QuestRow> = {}): QuestRow {
  return { ...paramsToQuestRow(questToParams(makeQuest())), ...overrides };
}

const UPDATED_AT = new Date(2026, 2, 10, 19, 30).getTime();

describe('player round-trip', () => {
  it('playerToParams → row → rowToPlayer is lossless', () => {
    const player = makePlayer();
    const params = playerToParams(player, {
      lastRolloverDay: '2026-03-10',
      dailyQuestId: 'daily-2026-03-10',
      penaltyQuestId: 'penalty-2026-03-09',
      updatedAt: UPDATED_AT,
    });
    expect(params).toHaveLength(18);
    expect(rowToPlayer(paramsToPlayerRow(params))).toEqual(player);
  });

  it('keeps a null cooldown and every rank', () => {
    for (const rank of ['E', 'D', 'C', 'B', 'A', 'S'] as const) {
      const player = makePlayer({ rank, rankExamCooldownUntil: null });
      const row = paramsToPlayerRow(
        playerToParams(player, { lastRolloverDay: '2026-03-10', dailyQuestId: null, penaltyQuestId: null, updatedAt: 0 }),
      );
      expect(rowToPlayer(row)).toEqual(player);
    }
  });

  it('writes the extra columns in order after the player fields', () => {
    const params = playerToParams(makePlayer(), {
      lastRolloverDay: '2026-03-10',
      dailyQuestId: 'daily-2026-03-10',
      penaltyQuestId: null,
      updatedAt: UPDATED_AT,
    });
    expect(params.slice(0, 5)).toEqual(['Şükrü İğdeli', 7, 412, 5123, 'D']);
    expect(params.slice(9, 15)).toEqual(['2026-01-10', '2026-03-11', '2026-03-10', 'daily-2026-03-10', null, UPDATED_AT]);
    // migration 2 columns (docs §10, §11, §13): records, rpe, streak as JSON
    expect(params.slice(15).map((p) => JSON.parse(p as string))).toEqual([
      makePlayer().records,
      makePlayer().rpe,
      makePlayer().streak,
    ]);
    expect(JSON.parse(params[5] as string)).toEqual(makePlayer().stats);
  });

  it('does not mutate the player', () => {
    const player = Object.freeze(makePlayer());
    const copy = structuredClone(player);
    playerToParams(player, { lastRolloverDay: '2026-03-10', dailyQuestId: null, penaltyQuestId: null, updatedAt: 0 });
    expect(player).toEqual(copy);
  });
});

describe('defensive player parsing', () => {
  it('unknown rank → E', () => {
    expect(rowToPlayer(playerRow({ rank: 'Z' })).rank).toBe('E');
    expect(rowToPlayer(playerRow({ rank: '' })).rank).toBe('E');
    expect(rowToPlayer(playerRow({ rank: 'e' })).rank).toBe('E');
  });

  it('corrupt stats JSON → all zeros', () => {
    const player = rowToPlayer(playerRow({ stats: '{not json', stat_xp: '' }));
    expect(player.stats).toEqual({ strength: 0, endurance: 0, agility: 0, vitality: 0, flexibility: 0 });
    expect(player.statXp).toEqual({ strength: 0, endurance: 0, agility: 0, vitality: 0, flexibility: 0 });
  });

  it('corrupt baseline JSON → zeros', () => {
    expect(rowToPlayer(playerRow({ baseline: '###' })).baseline).toEqual({
      pushups: 0,
      situps: 0,
      squats: 0,
      plankSeconds: 0,
    });
  });
});

describe('parseStats / parseBaseline / parseRank', () => {
  it('reads every stat key', () => {
    expect(parseStats('{"strength":12,"endurance":13,"agility":11,"vitality":10,"flexibility":7}')).toEqual({
      strength: 12,
      endurance: 13,
      agility: 11,
      vitality: 10,
      flexibility: 7,
    });
  });

  it('fills missing keys with 0 and drops unknown keys', () => {
    const stats = parseStats('{"strength":12,"luck":99}');
    expect(stats).toEqual({ strength: 12, endurance: 0, agility: 0, vitality: 0, flexibility: 0 });
    expect(Object.keys(stats)).not.toContain('luck');
  });

  it('non-numeric values become 0', () => {
    expect(parseStats('{"strength":"12","endurance":null,"agility":true,"vitality":[1],"flexibility":{}}')).toEqual({
      strength: 0,
      endurance: 0,
      agility: 0,
      vitality: 0,
      flexibility: 0,
    });
  });

  it.each(['', 'null', '[]', '42', '"text"', '{', 'undefined'])('parseStats(%p) → zeros', (text) => {
    expect(parseStats(text)).toEqual({ strength: 0, endurance: 0, agility: 0, vitality: 0, flexibility: 0 });
  });

  it('parseBaseline reads fields and defaults bad ones to 0', () => {
    expect(parseBaseline('{"pushups":15,"situps":20,"squats":25,"plankSeconds":45}')).toEqual({
      pushups: 15,
      situps: 20,
      squats: 25,
      plankSeconds: 45,
    });
    expect(parseBaseline('{"pushups":"15","plankSeconds":45}')).toEqual({
      pushups: 0,
      situps: 0,
      squats: 0,
      plankSeconds: 45,
    });
    expect(parseBaseline('null')).toEqual({ pushups: 0, situps: 0, squats: 0, plankSeconds: 0 });
  });

  it('parseRank accepts the six ranks only', () => {
    for (const rank of ['E', 'D', 'C', 'B', 'A', 'S']) expect(parseRank(rank)).toBe(rank);
    for (const bad of ['', 'F', 's', 'SS', ' S']) expect(parseRank(bad)).toBe('E');
  });
});

describe('quest round-trip', () => {
  it.each([
    ['active daily', makeQuest()],
    [
      'completed daily',
      makeQuest({ status: 'completed', awardedXp: 75, completedAt: UPDATED_AT }),
    ],
    [
      'penalty',
      makeQuest({
        id: 'penalty-2026-03-10',
        kind: 'penalty',
        title: 'CEZA GÖREVİ: Hayatta Kalma',
        rewardXp: 0,
        objectives: [
          { exerciseId: 'burpee', target: 20, progress: 3, note: 'Ceza: taban 20 · Lv 1 ×1,00 → 20' },
          { exerciseId: 'squat', target: 50, progress: 0, note: '' },
          { exerciseId: 'plank', target: 120, progress: 60, note: '' },
          { exerciseId: 'run', target: 15, progress: 0, note: '' },
        ],
      }),
    ],
    ['failed', makeQuest({ status: 'failed' })],
  ])('%s survives questToParams → row → rowToQuest', (_label, quest) => {
    const params = questToParams(quest);
    expect(params).toHaveLength(9);
    expect(rowToQuest(paramsToQuestRow(params))).toEqual(quest);
  });
});

describe('defensive quest parsing', () => {
  it('unknown kind → daily, unknown status → failed', () => {
    const quest = rowToQuest(questRow({ kind: 'boss', status: 'paused' }));
    expect(quest.kind).toBe('daily');
    expect(quest.status).toBe('failed');
  });

  it.each(['', '{oops', 'null', '{}', '42', '"x"', 'true'])('corrupt objectives %p → []', (objectives) => {
    expect(rowToQuest(questRow({ objectives })).objectives).toEqual([]);
  });

  it('drops objectives with unknown exercises or wrong shape', () => {
    const objectives = JSON.stringify([
      { exerciseId: 'pushup', target: 10, progress: 2 },
      { exerciseId: 'deadlift', target: 5, progress: 0 },
      { exerciseId: 'toString', target: 5, progress: 0 },
      { exerciseId: 12, target: 5, progress: 0 },
      null,
      'squat',
      7,
      { target: 5 },
      { exerciseId: 'plank', target: 60, progress: 15 },
    ]);
    expect(rowToQuest(questRow({ objectives })).objectives).toEqual([
      { exerciseId: 'pushup', target: 10, progress: 2, note: '' },
      { exerciseId: 'plank', target: 60, progress: 15, note: '' },
    ]);
  });

  it('defaults a missing target to 1 and a missing progress to 0', () => {
    const objectives = JSON.stringify([{ exerciseId: 'run' }, { exerciseId: 'walk', target: 'x', progress: null }]);
    expect(rowToQuest(questRow({ objectives })).objectives).toEqual([
      { exerciseId: 'run', target: 1, progress: 0, note: '' },
      { exerciseId: 'walk', target: 1, progress: 0, note: '' },
    ]);
  });
});

describe('exercise logs', () => {
  const row: ExerciseLogRow = {
    id: 5,
    session_id: 2,
    exercise_id: 'plank',
    amount: 45,
    set_index: 1,
    day_key: '2026-03-10',
    created_at: UPDATED_AT,
    xp_awarded: 23,
    rpe: 8,
    is_record: 1,
  };

  it('maps a valid row', () => {
    expect(rowToExerciseLog(row)).toEqual({
      id: 5,
      sessionId: 2,
      exerciseId: 'plank',
      amount: 45,
      setIndex: 1,
      dayKey: '2026-03-10',
      createdAt: UPDATED_AT,
      xpAwarded: 23,
      rpe: 8,
      isRecord: true,
      isBoss: false, // no is_boss column value (pre-migration-3 row) → not a boss
    });
  });

  it('keeps a null session id', () => {
    expect(rowToExerciseLog({ ...row, session_id: null })?.sessionId).toBeNull();
  });

  it.each(['deadlift', '', 'constructor', 'PLANK'])('unknown exercise %p → null', (exerciseId) => {
    expect(rowToExerciseLog({ ...row, exercise_id: exerciseId })).toBeNull();
  });
});

describe('workout sessions', () => {
  const row: WorkoutSessionRow = {
    id: 3,
    day_key: '2026-03-10',
    started_at: UPDATED_AT - 1_800_000,
    ended_at: UPDATED_AT,
    total_xp: 140,
    xp_locked: 0,
    set_count: 6,
  };

  it('maps a valid row', () => {
    expect(rowToSession(row)).toEqual({
      id: 3,
      dayKey: '2026-03-10',
      startedAt: UPDATED_AT - 1_800_000,
      endedAt: UPDATED_AT,
      totalXp: 140,
      xpLocked: false,
      setCount: 6,
    });
  });

  it('xp_locked 1 → true', () => {
    expect(rowToSession({ ...row, xp_locked: 1 }).xpLocked).toBe(true);
  });

  it('missing set_count → 0', () => {
    const { set_count: _ignored, ...withoutCount } = row;
    expect(rowToSession(withoutCount).setCount).toBe(0);
  });
});

describe('rank exams', () => {
  const row: RankExamRow = {
    id: 1,
    target_rank: 'D',
    results: JSON.stringify({ pushups: 20, situps: 25, squats: 30, plankSeconds: 60 }),
    passed: 1,
    day_key: '2026-03-10',
    taken_at: UPDATED_AT,
  };

  it('maps a valid row', () => {
    expect(rowToRankExam(row)).toEqual({
      id: 1,
      targetRank: 'D',
      results: { pushups: 20, situps: 25, squats: 30, plankSeconds: 60 },
      passed: true,
      dayKey: '2026-03-10',
      takenAt: UPDATED_AT,
    });
  });

  it('passed 0 → false', () => {
    expect(rowToRankExam({ ...row, passed: 0 }).passed).toBe(false);
  });

  it('corrupt results → zeros; unknown rank → a valid rank', () => {
    const exam = rowToRankExam({ ...row, results: 'garbage', target_rank: 'X' });
    expect(exam.results).toEqual({ pushups: 0, situps: 0, squats: 0, plankSeconds: 0 });
    expect(['E', 'D', 'C', 'B', 'A', 'S']).toContain(exam.targetRank);
  });
});
