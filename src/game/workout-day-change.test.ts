/// <reference types="jest" />
/**
 * docs/GAME_DESIGN.md §9: an open workout's sets count for the day they were added.
 * Dates are built with local constructors so the tests pass in any timezone.
 */
import { addDays } from './date';
import { applyExerciseLogs, createInitialState, rolloverDay } from './engine';
import type { ExerciseEntry, GameState } from './types';
import { splitSetsAtDayChange } from './workout';

const DAY0 = '2026-03-02';
const DAY1 = addDays(DAY0, 1);
const DAY2 = addDays(DAY0, 2);

interface Set extends ExerciseEntry {
  at: number;
}

function at(day: number, hour: number, minute = 0, second = 0, ms = 0): number {
  // 2026-03-02 + day, local time
  return new Date(2026, 2, 2 + day, hour, minute, second, ms).getTime();
}

describe('splitSetsAtDayChange', () => {
  test('sets up to 23:59:59.999 belong to the closing day, 00:00 to the next', () => {
    const sets: Set[] = [
      { exerciseId: 'pushup', amount: 10, at: at(1, 23, 40) },
      { exerciseId: 'squat', amount: 20, at: at(1, 23, 59, 59, 999) },
      { exerciseId: 'situp', amount: 15, at: at(2, 0, 0) },
      { exerciseId: 'plank', amount: 60, at: at(2, 0, 5) },
    ];
    const { closing, remaining } = splitSetsAtDayChange(sets, DAY1);
    expect(closing.map((s) => s.exerciseId)).toEqual(['pushup', 'squat']);
    expect(remaining.map((s) => s.exerciseId)).toEqual(['situp', 'plank']);
  });

  test('older days are closed too (app was closed for several days)', () => {
    const sets: Set[] = [
      { exerciseId: 'pushup', amount: 10, at: at(0, 21) },
      { exerciseId: 'squat', amount: 20, at: at(1, 9) },
    ];
    expect(splitSetsAtDayChange(sets, DAY1).closing).toHaveLength(2);
  });

  test('keeps order, handles empty input and does not mutate', () => {
    expect(splitSetsAtDayChange([], DAY1)).toEqual({ closing: [], remaining: [] });
    const sets: Set[] = [
      { exerciseId: 'run', amount: 5, at: at(2, 1) },
      { exerciseId: 'walk', amount: 5, at: at(1, 22) },
      { exerciseId: 'yoga', amount: 5, at: at(2, 2) },
    ];
    const copy = structuredClone(sets);
    const { closing, remaining } = splitSetsAtDayChange(sets, DAY1);
    expect(closing.map((s) => s.exerciseId)).toEqual(['walk']);
    expect(remaining.map((s) => s.exerciseId)).toEqual(['run', 'yoga']);
    expect(sets).toEqual(copy);
  });
});

describe('day change with an open workout (§9 + §6)', () => {
  function dayOneState(): GameState {
    // Day 0 is the onboarding grace day; roll over to day 1 so a missed quest counts.
    return rolloverDay(
      createInitialState('Test', { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 }, DAY0),
      DAY1,
    ).state;
  }

  function questEntries(state: GameState): Set[] {
    return state.dailyQuest!.objectives.map((o, i) => ({
      exerciseId: o.exerciseId,
      amount: o.target,
      at: at(1, 23, 30 + i),
    }));
  }

  test('saving the closing-day sets before the rollover completes that day: no penalty, streak +1', () => {
    const state = dayOneState();
    const sets = questEntries(state);
    const { closing } = splitSetsAtDayChange(sets, state.lastRolloverDay);
    const logged = applyExerciseLogs(state, closing, closing[closing.length - 1].at);
    expect(logged.state.dailyQuest?.status).toBe('completed');

    const next = rolloverDay(logged.state, DAY2);
    expect(next.state.penaltyQuest).toBeNull();
    expect(next.state.player.streak.current).toBe(1);
  });

  test('without the split (sets applied after the rollover) the same workout would cause a penalty', () => {
    const state = dayOneState();
    const sets = questEntries(state);
    const rolled = rolloverDay(state, DAY2);
    expect(rolled.state.penaltyQuest?.status).toBe('active');
    const late = applyExerciseLogs(rolled.state, sets, at(2, 0, 1));
    expect(late.xpLocked).toBe(true);
    expect(late.totalXp).toBe(0);
  });
});
