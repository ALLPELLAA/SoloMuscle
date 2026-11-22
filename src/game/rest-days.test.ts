/// <reference types="jest" />
/**
 * Rest / sick days, the streak and their effect on rollover and reminders
 * (docs/GAME_DESIGN.md §13, §6, §8). Expected values derived by hand from the spec.
 */
import { applyExerciseLogs, createInitialState, rolloverDay, type RolloverEvent } from './engine';
import { buildReminderPlan, REMINDER_TEXT } from './reminders';
import {
  breakStreak,
  emptyStreak,
  extendStreak,
  findRestDay,
  getRestDayEligibility,
  isRestDay,
  markRestDay,
  restDaysInWindow,
  unmarkRestDay,
} from './rest-days';
import {
  GameRuleError,
  type BaselineTest,
  type DayKey,
  type GameState,
  type Quest,
  type QuestKind,
  type QuestStatus,
  type RestDay,
  type Streak,
} from './types';

const CREATED: DayKey = '2026-11-01';
const D_MINUS_7: DayKey = '2026-11-14';
const D_MINUS_6: DayKey = '2026-11-15';
const D_MINUS_5: DayKey = '2026-11-16';
const D_MINUS_3: DayKey = '2026-11-18';
const TWO_DAYS_AGO: DayKey = '2026-11-19';
const YESTERDAY: DayKey = '2026-11-20';
const TODAY: DayKey = '2026-11-21';
const TOMORROW: DayKey = '2026-11-22';
const NOW = new Date(2026, 10, 21, 18, 0).getTime();

const BASELINE: BaselineTest = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 };

function quest(kind: QuestKind, dayKey: DayKey, status: QuestStatus = 'active'): Quest {
  return {
    id: `${kind}-${dayKey}`,
    kind,
    dayKey,
    title: kind === 'daily' ? 'Günlük Görev' : 'CEZA GÖREVİ: Hayatta Kalma',
    objectives: [{ exerciseId: kind === 'daily' ? 'pushup' : 'burpee', target: 10, progress: 0, note: '' }],
    rewardXp: kind === 'daily' ? 75 : 0,
    awardedXp: 0,
    status,
    completedAt: status === 'completed' ? NOW - 1000 : null,
  };
}

function makeState(
  overrides: Partial<GameState> & { streak?: Streak; today?: DayKey } = {},
): GameState {
  const { streak, today = TODAY, ...rest } = overrides;
  const base = createInitialState('Avcı', BASELINE, CREATED);
  return {
    ...base,
    player: { ...base.player, streak: streak ?? base.player.streak },
    dailyQuest: quest('daily', today),
    penaltyQuest: null,
    lastRolloverDay: today,
    restDays: [],
    ...rest,
  };
}

function rest(dayKey: DayKey, kind: RestDay['kind'] = 'rest'): RestDay {
  return { dayKey, kind };
}

function types(events: RolloverEvent[]): string[] {
  return events.map((e) => e.type);
}

// ---------------------------------------------------------------------------
// Lookup & window
// ---------------------------------------------------------------------------

describe('isRestDay / findRestDay', () => {
  const days = [rest(YESTERDAY), rest(TODAY, 'sick')];

  it('finds marks by day', () => {
    expect(isRestDay(days, TODAY)).toBe(true);
    expect(isRestDay(days, TWO_DAYS_AGO)).toBe(false);
    expect(findRestDay(days, TODAY)).toEqual({ dayKey: TODAY, kind: 'sick' });
    expect(findRestDay(days, TOMORROW)).toBeUndefined();
  });
});

describe('restDaysInWindow (rolling 7 days incl. today)', () => {
  it('counts [today − 6, today]', () => {
    expect(restDaysInWindow([rest(D_MINUS_6), rest(D_MINUS_3), rest(TODAY)], TODAY)).toBe(3);
  });

  it('today − 7 is outside the window', () => {
    expect(restDaysInWindow([rest(D_MINUS_7), rest(D_MINUS_5)], TODAY)).toBe(1);
  });

  it('window rolls forward', () => {
    const days = [rest(D_MINUS_6), rest(YESTERDAY), rest(TODAY)];
    expect(restDaysInWindow(days, TODAY)).toBe(3);
    // Tomorrow's window starts at today − 5 → D_MINUS_6 drops out.
    expect(restDaysInWindow(days, TOMORROW)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

describe('getRestDayEligibility', () => {
  it('fresh state → allowed', () => {
    expect(getRestDayEligibility(makeState(), TODAY)).toEqual({ allowed: true, reason: null, usedInWindow: 0 });
  });

  it('already_marked is checked first (before quest_completed and limit)', () => {
    const state = makeState({
      dailyQuest: quest('daily', TODAY, 'completed'),
      restDays: [rest(D_MINUS_6), rest(D_MINUS_3), rest(TODAY)],
    });
    expect(getRestDayEligibility(state, TODAY)).toMatchObject({ allowed: false, reason: 'already_marked' });
  });

  it('quest_completed is checked before limit', () => {
    const state = makeState({
      dailyQuest: quest('daily', TODAY, 'completed'),
      restDays: [rest(D_MINUS_6), rest(D_MINUS_3), rest(YESTERDAY)],
    });
    expect(getRestDayEligibility(state, TODAY)).toMatchObject({ allowed: false, reason: 'quest_completed' });
  });

  it('limit: 3 marked days already in the last 7 days', () => {
    const state = makeState({ restDays: [rest(D_MINUS_6), rest(D_MINUS_3), rest(YESTERDAY)] });
    expect(getRestDayEligibility(state, TODAY)).toEqual({ allowed: false, reason: 'limit', usedInWindow: 3 });
  });

  it('2 marks in the window → today may become the 3rd', () => {
    const state = makeState({ restDays: [rest(D_MINUS_7), rest(D_MINUS_6), rest(YESTERDAY)] });
    expect(getRestDayEligibility(state, TODAY)).toEqual({ allowed: true, reason: null, usedInWindow: 2 });
    const marked = markRestDay(state, TODAY, 'sick');
    expect(restDaysInWindow(marked.restDays, TODAY)).toBe(3);
  });

  it('an active, failed or excused daily quest does not block', () => {
    for (const status of ['active', 'failed', 'excused'] as const) {
      const state = makeState({ dailyQuest: quest('daily', TODAY, status) });
      expect(getRestDayEligibility(state, TODAY).allowed).toBe(true);
    }
  });

  it('an active penalty quest does not block marking', () => {
    const state = makeState({ penaltyQuest: quest('penalty', YESTERDAY) });
    expect(getRestDayEligibility(state, TODAY).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mark / unmark
// ---------------------------------------------------------------------------

describe('markRestDay / unmarkRestDay', () => {
  it('marks today with the given kind', () => {
    expect(markRestDay(makeState(), TODAY, 'rest').restDays).toEqual([rest(TODAY, 'rest')]);
    expect(markRestDay(makeState(), TODAY, 'sick').restDays).toEqual([rest(TODAY, 'sick')]);
  });

  it('throws rest_day_not_allowed when not eligible', () => {
    const blocked = [
      makeState({ restDays: [rest(TODAY)] }),
      makeState({ dailyQuest: quest('daily', TODAY, 'completed') }),
      makeState({ restDays: [rest(D_MINUS_6), rest(D_MINUS_3), rest(YESTERDAY)] }),
    ];
    for (const state of blocked) {
      try {
        markRestDay(state, TODAY, 'rest');
        throw new Error('expected throw');
      } catch (error) {
        expect(error).toBeInstanceOf(GameRuleError);
        expect((error as GameRuleError).code).toBe('rest_day_not_allowed');
      }
    }
  });

  it("unmark removes only today's mark; past marks stay", () => {
    const state = makeState({ restDays: [rest(TWO_DAYS_AGO), rest(YESTERDAY, 'sick'), rest(TODAY)] });
    expect(unmarkRestDay(state, TODAY).restDays).toEqual([rest(TWO_DAYS_AGO), rest(YESTERDAY, 'sick')]);
  });

  it('unmark when today is not marked changes nothing (past days cannot be unmarked)', () => {
    const state = makeState({ restDays: [rest(YESTERDAY)] });
    expect(unmarkRestDay(state, TODAY)).toEqual(state);
  });

  it('can re-mark the same day after unmarking', () => {
    const marked = markRestDay(makeState(), TODAY, 'rest');
    const unmarked = unmarkRestDay(marked, TODAY);
    expect(unmarked.restDays).toEqual([]);
    expect(markRestDay(unmarked, TODAY, 'sick').restDays).toEqual([rest(TODAY, 'sick')]);
  });

  it('does not mutate the input state', () => {
    const state = makeState({ restDays: [rest(YESTERDAY)] });
    const snapshot = structuredClone(state);
    markRestDay(state, TODAY, 'rest');
    unmarkRestDay({ ...state, restDays: [...state.restDays, rest(TODAY)] }, TODAY);
    expect(state).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

describe('streak helpers', () => {
  it('empty streak', () => {
    expect(emptyStreak()).toEqual({ current: 0, best: 0, lastCompletedDay: null });
  });

  it('extend: current + 1, best = max(best, current)', () => {
    expect(extendStreak({ current: 2, best: 9, lastCompletedDay: YESTERDAY }, TODAY)).toEqual({
      current: 3,
      best: 9,
      lastCompletedDay: TODAY,
    });
    expect(extendStreak({ current: 5, best: 5, lastCompletedDay: YESTERDAY }, TODAY)).toEqual({
      current: 6,
      best: 6,
      lastCompletedDay: TODAY,
    });
  });

  it('extend is at most +1 per day', () => {
    const once = extendStreak({ current: 1, best: 1, lastCompletedDay: YESTERDAY }, TODAY);
    expect(extendStreak(once, TODAY)).toEqual({ current: 2, best: 2, lastCompletedDay: TODAY });
  });

  it('break: current = 0, best kept', () => {
    expect(breakStreak({ current: 4, best: 7, lastCompletedDay: YESTERDAY })).toMatchObject({ current: 0, best: 7 });
  });
});

// ---------------------------------------------------------------------------
// Rollover with rest days (§6, §13)
// ---------------------------------------------------------------------------

describe('rolloverDay with rest days', () => {
  const STREAK: Streak = { current: 4, best: 7, lastCompletedDay: TWO_DAYS_AGO };

  it.each(['rest', 'sick'] as const)(
    'active quest on a %s day → excused, no penalty, streak unchanged',
    (kind) => {
      const state = makeState({ today: YESTERDAY, streak: STREAK, restDays: [rest(YESTERDAY, kind)] });
      const result = rolloverDay(state, TODAY);
      expect(result.archived).toEqual([{ ...quest('daily', YESTERDAY), status: 'excused' }]);
      expect(types(result.events)).toContain('daily_excused');
      expect(types(result.events)).not.toContain('daily_failed');
      expect(types(result.events)).not.toContain('penalty_started');
      expect(types(result.events)).not.toContain('streak_broken');
      expect(result.state.penaltyQuest).toBeNull();
      expect(result.state.player.streak).toEqual(STREAK);
      expect(result.state.dailyQuest?.dayKey).toBe(TODAY);
      expect(result.state.dailyQuest?.status).toBe('active');
      expect(result.state.lastRolloverDay).toBe(TODAY);
    },
  );

  it('active quest on an unmarked day → failed, penalty opened, streak reset (best kept)', () => {
    const state = makeState({ today: YESTERDAY, streak: STREAK });
    const result = rolloverDay(state, TODAY);
    expect(result.archived).toEqual([{ ...quest('daily', YESTERDAY), status: 'failed' }]);
    expect(types(result.events)).toEqual(expect.arrayContaining(['daily_failed', 'penalty_started', 'streak_broken']));
    expect(result.events.find((e) => e.type === 'streak_broken')).toEqual({ type: 'streak_broken', previous: 4 });
    expect(result.state.penaltyQuest?.kind).toBe('penalty');
    expect(result.state.penaltyQuest?.dayKey).toBe(TODAY);
    expect(result.state.player.streak).toMatchObject({ current: 0, best: 7 });
  });

  it("marking today does not excuse yesterday's quest", () => {
    const state = makeState({ today: YESTERDAY, restDays: [rest(TODAY)] });
    const result = rolloverDay(state, TODAY);
    expect(result.archived[0].status).toBe('failed');
    expect(result.state.penaltyQuest).not.toBeNull();
  });

  it('a rest day does not remove an already active penalty quest', () => {
    const penalty = quest('penalty', TWO_DAYS_AGO);
    const state = makeState({ today: YESTERDAY, penaltyQuest: penalty, restDays: [rest(YESTERDAY)] });
    const result = rolloverDay(state, TODAY);
    expect(result.state.penaltyQuest).toEqual(penalty);
    expect(result.archived).not.toContainEqual(penalty);
    expect(types(result.events)).not.toContain('penalty_started');
  });

  it('rest day followed by a whole unopened day → still missed (rule 2): penalty + streak reset', () => {
    const state = makeState({ today: TWO_DAYS_AGO, streak: STREAK, restDays: [rest(TWO_DAYS_AGO)] });
    const result = rolloverDay(state, TODAY);
    expect(result.archived[0]).toMatchObject({ dayKey: TWO_DAYS_AGO, status: 'excused' });
    expect(types(result.events)).toEqual(expect.arrayContaining(['days_skipped', 'penalty_started']));
    expect(result.state.penaltyQuest).not.toBeNull();
    expect(result.state.player.streak).toMatchObject({ current: 0, best: 7 });
  });

  it('quest completed on a marked day stays completed', () => {
    const state = makeState({
      today: YESTERDAY,
      streak: { current: 5, best: 7, lastCompletedDay: YESTERDAY },
      dailyQuest: quest('daily', YESTERDAY, 'completed'),
      restDays: [rest(YESTERDAY)],
    });
    const result = rolloverDay(state, TODAY);
    expect(result.archived).toEqual([quest('daily', YESTERDAY, 'completed')]);
    expect(result.state.player.streak).toEqual({ current: 5, best: 7, lastCompletedDay: YESTERDAY });
  });
});

describe('streak at rollover (§6.5, §13)', () => {
  it('previous quest completed, consecutive day → streak unchanged', () => {
    const streak: Streak = { current: 3, best: 3, lastCompletedDay: YESTERDAY };
    const state = makeState({ today: YESTERDAY, streak, dailyQuest: quest('daily', YESTERDAY, 'completed') });
    const result = rolloverDay(state, TODAY);
    expect(result.state.player.streak).toEqual(streak);
    expect(result.state.penaltyQuest).toBeNull();
  });

  it('previous quest completed but a whole day skipped → streak reset', () => {
    const streak: Streak = { current: 3, best: 6, lastCompletedDay: TWO_DAYS_AGO };
    const state = makeState({ today: TWO_DAYS_AGO, streak, dailyQuest: quest('daily', TWO_DAYS_AGO, 'completed') });
    const result = rolloverDay(state, TODAY);
    expect(result.state.player.streak).toMatchObject({ current: 0, best: 6 });
  });

  it('clock moved backwards → streak untouched', () => {
    const streak: Streak = { current: 3, best: 6, lastCompletedDay: YESTERDAY };
    const state = makeState({ streak });
    expect(rolloverDay(state, YESTERDAY).state.player.streak).toEqual(streak);
  });

  it('rollover does not mutate its input', () => {
    const state = makeState({ today: YESTERDAY, streak: { current: 2, best: 2, lastCompletedDay: TWO_DAYS_AGO } });
    const snapshot = structuredClone(state);
    rolloverDay(state, TODAY);
    expect(state).toEqual(snapshot);
  });
});

describe('exercise on a rest day (§13: XP rules unchanged)', () => {
  it('logging on a marked day grants the normal XP', () => {
    const plain = makeState({ dailyQuest: null });
    const marked = makeState({ dailyQuest: null, restDays: [rest(TODAY)] });
    const a = applyExerciseLogs(plain, [{ exerciseId: 'run', amount: 10 }], NOW);
    const b = applyExerciseLogs(marked, [{ exerciseId: 'run', amount: 10 }], NOW);
    expect(b.exerciseXp).toBe(80); // 10 · 8
    expect(b.totalXp).toBe(a.totalXp);
    expect(b.state.player.xp).toBe(a.state.player.xp);
  });
});

// ---------------------------------------------------------------------------
// Reminders (§8)
// ---------------------------------------------------------------------------

describe('reminders on a rest day (§8)', () => {
  const MORNING = new Date(2026, 10, 21, 10, 0).getTime();
  const SETTINGS = { enabled: true, hour: 19, minute: 0 };
  const TODAY_19 = new Date(2026, 10, 21, 19, 0).getTime();

  it('no reminder today even when a penalty is active; the next 6 days are normal', () => {
    const plan = buildReminderPlan({
      now: MORNING,
      settings: SETTINGS,
      todayQuestDone: false,
      penaltyActive: true,
      todayRest: true,
    });
    expect(plan).toHaveLength(6);
    expect(plan.map((r) => r.at)).toEqual([1, 2, 3, 4, 5, 6].map((i) => new Date(2026, 10, 21 + i, 19, 0).getTime()));
    for (const r of plan) {
      expect(r.title).toBe(REMINDER_TEXT.normal.title);
      expect(r.body).toBe(REMINDER_TEXT.normal.body);
    }
  });

  it('no reminder today on a rest day without penalty', () => {
    const plan = buildReminderPlan({
      now: MORNING,
      settings: SETTINGS,
      todayQuestDone: false,
      penaltyActive: false,
      todayRest: true,
    });
    expect(plan.map((r) => r.at)).not.toContain(TODAY_19);
    expect(plan).toHaveLength(6);
  });

  it('without a rest day, the penalty warning is scheduled today', () => {
    const plan = buildReminderPlan({ now: MORNING, settings: SETTINGS, todayQuestDone: false, penaltyActive: true });
    expect(plan).toHaveLength(7);
    expect(plan[0]).toEqual({ at: TODAY_19, ...REMINDER_TEXT.penalty });
    expect(plan[1].title).toBe('[SİSTEM] Günlük Görev');
  });
});
