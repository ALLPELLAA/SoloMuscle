/// <reference types="jest" />
/**
 * Local reminder planning — docs/GAME_DESIGN.md §8.
 * `now` is always built with local constructors; the real clock is never used.
 */
import {
  DEFAULT_REMINDER,
  REMINDER_DAYS_AHEAD,
  REMINDER_TEXT,
  buildReminderPlan,
  formatTime,
  isValidReminderTime,
  type ReminderSettings,
} from './reminders';

const NORMAL = {
  title: '[SİSTEM] Günlük Görev',
  body: 'Günlük görevin seni bekliyor. Tamamlanmazsa Ceza Görevi açılacak.',
};
const PENALTY = {
  title: '[SİSTEM] CEZA GÖREVİ AKTİF',
  body: 'Ceza görevini tamamlamadan XP kazanamazsın.',
};

const ON_1900: ReminderSettings = { enabled: true, hour: 19, minute: 0 };

function at(y: number, m: number, d: number, h: number, min = 0): number {
  return new Date(y, m, d, h, min).getTime();
}

describe('defaults and texts', () => {
  it('reminder is on at 19:00 by default, 7 days ahead', () => {
    expect(DEFAULT_REMINDER).toEqual({ enabled: true, hour: 19, minute: 0 });
    expect(REMINDER_DAYS_AHEAD).toBe(7);
  });

  it('uses the spec texts', () => {
    expect(REMINDER_TEXT.normal).toEqual(NORMAL);
    expect(REMINDER_TEXT.penalty).toEqual(PENALTY);
  });
});

describe('buildReminderPlan', () => {
  it('plans 7 daily reminders at 19:00 local starting today when the time has not passed', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 10),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: false,
    });
    expect(plan).toHaveLength(7);
    plan.forEach((reminder, i) => {
      expect(reminder.at).toBe(at(2026, 0, 15 + i, 19));
      expect({ title: reminder.title, body: reminder.body }).toEqual(NORMAL);
    });
  });

  it('every reminder is at hour:minute local time', () => {
    const plan = buildReminderPlan({
      now: at(2026, 5, 1, 6),
      settings: { enabled: true, hour: 7, minute: 45 },
      todayQuestDone: false,
      penaltyActive: false,
    });
    expect(plan).toHaveLength(7);
    for (const r of plan) {
      const d = new Date(r.at);
      expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([7, 45, 0]);
    }
  });

  it('skips today when the reminder time has already passed', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 20),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: false,
    });
    expect(plan).toHaveLength(6);
    expect(plan[0].at).toBe(at(2026, 0, 16, 19));
    expect(plan[5].at).toBe(at(2026, 0, 21, 19));
  });

  it('skips today one millisecond after the reminder time', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 19) + 1,
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: false,
    });
    expect(plan.map((r) => r.at)).not.toContain(at(2026, 0, 15, 19));
  });

  it('keeps today one minute before the reminder time', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 18, 59),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: false,
    });
    expect(plan[0].at).toBe(at(2026, 0, 15, 19));
  });

  it('never schedules a reminder in the past', () => {
    for (const hour of [0, 6, 18, 19, 23]) {
      const now = at(2026, 2, 3, hour, 30);
      const plan = buildReminderPlan({ now, settings: ON_1900, todayQuestDone: false, penaltyActive: false });
      for (const r of plan) expect(r.at).toBeGreaterThan(now);
    }
  });

  it("skips today's reminder when today's daily quest is done and no penalty is active", () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 10),
      settings: ON_1900,
      todayQuestDone: true,
      penaltyActive: false,
    });
    expect(plan).toHaveLength(6);
    expect(plan[0].at).toBe(at(2026, 0, 16, 19));
    for (const r of plan) expect(r.title).toBe(NORMAL.title);
  });

  it('uses the penalty text today when a penalty is active (quest not done)', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 10),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: true,
    });
    expect(plan).toHaveLength(7);
    expect(plan[0]).toEqual({ at: at(2026, 0, 15, 19), ...PENALTY });
    for (const r of plan.slice(1)) expect({ title: r.title, body: r.body }).toEqual(NORMAL);
  });

  it('still reminds about the penalty today even if the daily quest is done', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 10),
      settings: ON_1900,
      todayQuestDone: true,
      penaltyActive: true,
    });
    expect(plan).toHaveLength(7);
    expect(plan[0]).toEqual({ at: at(2026, 0, 15, 19), ...PENALTY });
  });

  it('penalty active but time passed → no penalty reminder today', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 21),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: true,
    });
    expect(plan).toHaveLength(6);
    for (const r of plan) expect(r.title).toBe(NORMAL.title);
  });

  it('crosses month and year boundaries on local calendar days', () => {
    const plan = buildReminderPlan({
      now: at(2026, 11, 29, 8),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: false,
    });
    const days = plan.map((r) => {
      const d = new Date(r.at);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    });
    expect(days).toEqual(['2026-12-29', '2026-12-30', '2026-12-31', '2027-1-1', '2027-1-2', '2027-1-3', '2027-1-4']);
  });

  it('is sorted by time with one reminder per day', () => {
    const plan = buildReminderPlan({
      now: at(2026, 1, 25, 9),
      settings: { enabled: true, hour: 0, minute: 0 },
      todayQuestDone: false,
      penaltyActive: false,
    });
    // 00:00 today has passed → the next 6 midnights
    expect(plan).toHaveLength(6);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at).toBeGreaterThan(plan[i - 1].at);
    expect(new Set(plan.map((r) => new Date(r.at).getDate())).size).toBe(plan.length);
  });

  it('honours a custom number of days', () => {
    const plan = buildReminderPlan({
      now: at(2026, 0, 15, 10),
      settings: ON_1900,
      todayQuestDone: false,
      penaltyActive: false,
      days: 3,
    });
    expect(plan).toHaveLength(3);
  });

  it('disabled → []', () => {
    expect(
      buildReminderPlan({
        now: at(2026, 0, 15, 10),
        settings: { enabled: false, hour: 19, minute: 0 },
        todayQuestDone: false,
        penaltyActive: true,
      }),
    ).toEqual([]);
  });

  it.each([
    [24, 0],
    [-1, 0],
    [19, 60],
    [19, -1],
    [19.5, 0],
    [19, 0.5],
    [Number.NaN, 0],
  ])('invalid time %p:%p → []', (hour, minute) => {
    expect(
      buildReminderPlan({
        now: at(2026, 0, 15, 10),
        settings: { enabled: true, hour, minute },
        todayQuestDone: false,
        penaltyActive: false,
      }),
    ).toEqual([]);
  });
});

describe('isValidReminderTime / formatTime', () => {
  it('accepts 00:00 and 23:59', () => {
    expect(isValidReminderTime(0, 0)).toBe(true);
    expect(isValidReminderTime(23, 59)).toBe(true);
  });

  it('rejects out-of-range or fractional values', () => {
    expect(isValidReminderTime(24, 0)).toBe(false);
    expect(isValidReminderTime(0, 60)).toBe(false);
    expect(isValidReminderTime(-1, 0)).toBe(false);
    expect(isValidReminderTime(12.5, 0)).toBe(false);
  });

  it('formats HH:MM with zero padding', () => {
    expect(formatTime(19, 0)).toBe('19:00');
    expect(formatTime(7, 5)).toBe('07:05');
    expect(formatTime(0, 0)).toBe('00:00');
  });
});
