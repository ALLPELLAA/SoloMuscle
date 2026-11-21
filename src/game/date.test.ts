/// <reference types="jest" />
/**
 * Local-calendar DayKey helpers — CLAUDE.md rule 5, docs/GAME_DESIGN.md §6.
 * Dates are built with local constructors so the tests pass in any timezone.
 */
import {
  addDays,
  compareDayKeys,
  dayKeyToDate,
  diffDays,
  isDayKey,
  msUntilNextMidnight,
  toDayKey,
} from './date';

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe('toDayKey', () => {
  it('formats local dates as YYYY-MM-DD with zero padding', () => {
    expect(toDayKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
    expect(toDayKey(new Date(2026, 10, 21, 9, 30))).toBe('2026-11-21');
    expect(toDayKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('uses local time: 00:00 and 23:59 belong to the same day', () => {
    expect(toDayKey(new Date(2026, 2, 10, 0, 0, 0, 0))).toBe('2026-03-10');
    expect(toDayKey(new Date(2026, 2, 10, 23, 59, 59, 999))).toBe('2026-03-10');
    expect(toDayKey(new Date(2026, 2, 11, 0, 0, 0, 0))).toBe('2026-03-11');
  });

  it('accepts epoch milliseconds', () => {
    const d = new Date(2026, 6, 4, 18, 45);
    expect(toDayKey(d.getTime())).toBe('2026-07-04');
  });

  it('handles month and year boundaries', () => {
    expect(toDayKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(toDayKey(new Date(2026, 0, 32, 0, 1))).toBe('2026-02-01');
    expect(toDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(toDayKey(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });
});

describe('isDayKey', () => {
  it.each(['2026-01-01', '2026-12-31', '2024-02-29', '2000-02-29'])('accepts %s', (key) => {
    expect(isDayKey(key)).toBe(true);
  });

  it.each([
    '2026-02-29', // 2026 is not a leap year
    '1900-02-29', // 1900 is not a leap year
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-1-01',
    '2026-01-1',
    '26-01-01',
    '2026/01/01',
    '2026-01-01T00:00',
    ' 2026-01-01',
    '',
    'abc',
  ])('rejects %p', (key) => {
    expect(isDayKey(key)).toBe(false);
  });
});

describe('dayKeyToDate', () => {
  it('returns local midnight of the day', () => {
    const d = dayKeyToDate('2026-03-10');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('round-trips with toDayKey', () => {
    for (const key of ['2024-02-29', '2026-01-01', '2026-12-31', '2026-07-15']) {
      expect(toDayKey(dayKeyToDate(key))).toBe(key);
    }
  });

  it('throws on a malformed key', () => {
    expect(() => dayKeyToDate('2026/03/10')).toThrow();
    expect(() => dayKeyToDate('')).toThrow();
  });
});

describe('addDays', () => {
  it.each([
    ['2026-03-10', 0, '2026-03-10'],
    ['2026-03-10', 1, '2026-03-11'],
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2024-02-29', 1, '2024-03-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-01-01', 365, '2027-01-01'],
    ['2024-01-01', 366, '2025-01-01'],
    ['2026-01-25', 10, '2026-02-04'],
    ['2026-03-28', 2, '2026-03-30'], // across EU DST change
    ['2026-03-07', 2, '2026-03-09'], // across US DST change
    ['2026-10-24', 2, '2026-10-26'], // across EU DST end
  ])('%s + %i = %s', (from, days, to) => {
    expect(addDays(from, days)).toBe(to);
  });

  it('throws on a malformed key', () => {
    expect(() => addDays('not-a-day', 1)).toThrow();
  });
});

describe('diffDays', () => {
  it.each([
    ['2026-03-10', '2026-03-10', 0],
    ['2026-03-10', '2026-03-11', 1],
    ['2026-03-11', '2026-03-10', -1],
    ['2026-03-10', '2026-03-12', 2],
    ['2026-01-31', '2026-02-01', 1],
    ['2026-12-31', '2027-01-01', 1],
    ['2027-01-01', '2026-12-31', -1],
    ['2024-02-28', '2024-03-01', 2],
    ['2026-02-28', '2026-03-01', 1],
    ['2026-01-01', '2027-01-01', 365],
    ['2024-01-01', '2025-01-01', 366],
    ['2026-03-28', '2026-03-30', 2], // DST
    ['2026-10-24', '2026-10-26', 2], // DST
  ])('%s → %s = %i', (from, to, expected) => {
    expect(diffDays(from, to)).toBe(expected);
  });

  it('is the inverse of addDays', () => {
    for (const n of [-400, -31, -1, 0, 1, 2, 28, 59, 365, 1000]) {
      expect(diffDays('2026-01-15', addDays('2026-01-15', n))).toBe(n);
    }
  });
});

describe('compareDayKeys', () => {
  it('orders day keys chronologically', () => {
    expect(compareDayKeys('2026-03-10', '2026-03-11')).toBeLessThan(0);
    expect(compareDayKeys('2026-03-11', '2026-03-10')).toBeGreaterThan(0);
    expect(compareDayKeys('2026-03-10', '2026-03-10')).toBe(0);
    expect(compareDayKeys('2026-12-31', '2027-01-01')).toBeLessThan(0);
    expect(compareDayKeys('2027-01-01', '2026-12-31')).toBeGreaterThan(0);
  });
});

describe('msUntilNextMidnight', () => {
  it('one minute before midnight → 60 000 ms', () => {
    expect(msUntilNextMidnight(new Date(2026, 0, 15, 23, 59, 0, 0))).toBe(MINUTE);
  });

  it('one millisecond before midnight → 1 ms', () => {
    expect(msUntilNextMidnight(new Date(2026, 0, 15, 23, 59, 59, 999))).toBe(1);
  });

  it('noon → 12 hours', () => {
    expect(msUntilNextMidnight(new Date(2026, 0, 15, 12, 0))).toBe(12 * HOUR);
    expect(msUntilNextMidnight(new Date(2026, 6, 15, 12, 0))).toBe(12 * HOUR);
  });

  it('exactly midnight → a full day until the next one (never 0)', () => {
    expect(msUntilNextMidnight(new Date(2026, 0, 15, 0, 0, 0, 0))).toBe(24 * HOUR);
  });

  it('crosses month and year boundaries', () => {
    expect(msUntilNextMidnight(new Date(2026, 0, 31, 23, 0))).toBe(HOUR);
    expect(msUntilNextMidnight(new Date(2026, 1, 28, 22, 30))).toBe(90 * MINUTE);
    expect(msUntilNextMidnight(new Date(2026, 11, 31, 23, 30))).toBe(30 * MINUTE);
  });

  it('accepts epoch milliseconds and lands exactly on the next local midnight', () => {
    const now = new Date(2026, 4, 20, 8, 15, 30).getTime();
    const ms = msUntilNextMidnight(now);
    const next = new Date(now + ms);
    expect(toDayKey(next)).toBe('2026-05-21');
    expect([next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });

  it('is always positive', () => {
    for (let h = 0; h < 24; h++) {
      expect(msUntilNextMidnight(new Date(2026, 8, 9, h, 30))).toBeGreaterThan(0);
    }
  });
});
