/// <reference types="jest" />
/**
 * Activity heatmap & raw daily XP (docs/GAME_DESIGN.md §14).
 * Dates are checked with plain JS Date math, independent of the game's date helpers.
 */
import { buildHeatmap, HEATMAP_WEEKS, quantile, rawXpByDay, weekdayIndex, type HeatCell } from './activity';
import type { DayKey } from './types';

/** Local calendar day `offset` days after `dayKey` (noon avoids DST issues). */
function shift(dayKey: DayKey, offset: number): DayKey {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + offset, 12);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function jsWeekday(dayKey: DayKey): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay(); // 0 = Sunday … 6 = Saturday
}

function cellOf(weeks: HeatCell[][], dayKey: DayKey): HeatCell {
  for (const column of weeks) {
    const found = column.find((c) => c.dayKey === dayKey);
    if (found) return found;
  }
  throw new Error(`cell ${dayKey} not in heatmap`);
}

// 2026-11-19 is a Thursday; its week is Mon 2026-11-16 … Sun 2026-11-22.
const THURSDAY: DayKey = '2026-11-19';
const SUNDAY: DayKey = '2026-11-22';
const MONDAY: DayKey = '2026-11-16';

describe('fixtures sanity', () => {
  it('weekday facts used below', () => {
    expect(jsWeekday(MONDAY)).toBe(1);
    expect(jsWeekday(THURSDAY)).toBe(4);
    expect(jsWeekday(SUNDAY)).toBe(0);
    expect(jsWeekday('2026-07-06')).toBe(1);
  });
});

describe('rawXpByDay (Σ round(amount · xpPerUnit), lock-independent)', () => {
  it('sums rounded XP of every row per day', () => {
    const totals = rawXpByDay([
      { dayKey: '2026-11-20', exerciseId: 'pushup', amount: 10 }, // 10
      { dayKey: '2026-11-20', exerciseId: 'situp', amount: 3 }, // round(2.4) = 2
      { dayKey: '2026-11-20', exerciseId: 'situp', amount: 3 }, // round(2.4) = 2
      { dayKey: '2026-11-21', exerciseId: 'plank', amount: 45 }, // round(22.5) = 23
      { dayKey: '2026-11-21', exerciseId: 'jumping_jack', amount: 5 }, // round(1.5) = 2
      { dayKey: '2026-11-21', exerciseId: 'run', amount: 12 }, // 96
    ]);
    expect(totals).toEqual({ '2026-11-20': 14, '2026-11-21': 121 });
  });

  it('ignores unknown exercises', () => {
    expect(
      rawXpByDay([
        { dayKey: '2026-11-20', exerciseId: 'teleport', amount: 100 },
        { dayKey: '2026-11-20', exerciseId: 'pullup', amount: 4 }, // 12
      ]),
    ).toEqual({ '2026-11-20': 12 });
  });

  it('empty input → empty map', () => {
    expect(rawXpByDay([])).toEqual({});
  });
});

describe('weekdayIndex (Monday-first)', () => {
  it.each([
    ['2026-11-16', 0],
    ['2026-11-17', 1],
    ['2026-11-19', 3],
    ['2026-11-21', 5],
    ['2026-11-22', 6],
  ])('%s → %i', (dayKey, index) => {
    expect(weekdayIndex(dayKey)).toBe(index);
  });
});

describe('quantile q(p) = v[floor(p·(n−1))]', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8]; // n − 1 = 7
  it.each([
    [0.25, 2], // floor(1.75) = 1
    [0.5, 4], // floor(3.5) = 3
    [0.75, 6], // floor(5.25) = 5
    [0, 1],
    [1, 8],
  ])('p=%p → %p', (p, expected) => {
    expect(quantile(v, p)).toBe(expected);
  });

  it('single value', () => {
    expect(quantile([42], 0.25)).toBe(42);
    expect(quantile([42], 0.75)).toBe(42);
  });
});

describe('buildHeatmap — layout', () => {
  it(`default: ${HEATMAP_WEEKS} weeks of 7 cells, Monday-first, last column holds endDay`, () => {
    expect(HEATMAP_WEEKS).toBe(20);
    const map = buildHeatmap({ endDay: THURSDAY, values: {} });
    expect(map.weeks).toHaveLength(20);
    for (const column of map.weeks) {
      expect(column).toHaveLength(7);
      expect(jsWeekday(column[0].dayKey)).toBe(1); // Monday
      expect(jsWeekday(column[6].dayKey)).toBe(0); // Sunday
    }
    // first Monday = 2026-11-16 − 19·7 days = 2026-07-06
    expect(map.weeks[0][0].dayKey).toBe('2026-07-06');
    expect(map.weeks[19].map((c) => c.dayKey)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    // consecutive days, oldest first
    const all = map.weeks.flat().map((c) => c.dayKey);
    all.forEach((dayKey, i) => expect(dayKey).toBe(shift('2026-07-06', i)));
  });

  it('custom number of weeks', () => {
    const map = buildHeatmap({ endDay: THURSDAY, weeks: 4, values: {} });
    expect(map.weeks).toHaveLength(4);
    expect(map.weeks[0][0].dayKey).toBe('2026-10-26'); // 2026-11-16 − 21
  });

  it('cells after endDay are future and empty (values ignored)', () => {
    const map = buildHeatmap({
      endDay: THURSDAY,
      values: { '2026-11-20': 999, '2026-11-19': 10 },
      restDays: ['2026-11-21'],
      questDays: ['2026-11-22'],
    });
    const last = map.weeks[19];
    expect(last.map((c) => c.future)).toEqual([false, false, false, false, true, true, true]);
    for (const cell of last.slice(4)) {
      expect(cell.value).toBe(0);
      expect(cell.level).toBe(0);
    }
    expect(map.weeks.slice(0, 19).flat().every((c) => !c.future)).toBe(true);
  });

  it('endDay on a Sunday → no future cells', () => {
    const map = buildHeatmap({ endDay: SUNDAY, values: {} });
    expect(map.weeks.flat().some((c) => c.future)).toBe(false);
    expect(map.weeks[19][6].dayKey).toBe(SUNDAY);
  });

  it('endDay on a Monday → 6 future cells', () => {
    const map = buildHeatmap({ endDay: MONDAY, values: {} });
    expect(map.weeks.flat().filter((c) => c.future)).toHaveLength(6);
  });
});

describe('buildHeatmap — levels (quartiles of positive in-range values, ≤ boundaries)', () => {
  it('n = 5: Q1 = v[1], Q2 = v[2], Q3 = v[3]', () => {
    const map = buildHeatmap({
      endDay: THURSDAY,
      values: {
        '2026-11-16': 10,
        '2026-11-17': 20,
        '2026-11-18': 30,
        '2026-11-19': 40,
        '2026-11-02': 50,
        '2026-11-03': 0,
      },
    });
    expect(map.thresholds).toEqual([20, 30, 40]);
    expect(cellOf(map.weeks, '2026-11-16').level).toBe(1); // 10 ≤ Q1
    expect(cellOf(map.weeks, '2026-11-17').level).toBe(1); // 20 = Q1 → 1 (≤)
    expect(cellOf(map.weeks, '2026-11-18').level).toBe(2); // 30 = Q2
    expect(cellOf(map.weeks, '2026-11-19').level).toBe(3); // 40 = Q3
    expect(cellOf(map.weeks, '2026-11-02').level).toBe(4); // 50 > Q3
    expect(cellOf(map.weeks, '2026-11-03').level).toBe(0); // 0 → 0
    expect(cellOf(map.weeks, '2026-11-04').level).toBe(0); // missing → 0
  });

  it('n = 4: Q1 = v[0], Q2 = v[1], Q3 = v[2]', () => {
    const map = buildHeatmap({
      endDay: THURSDAY,
      values: { '2026-11-16': 5, '2026-11-17': 15, '2026-11-18': 25, '2026-11-19': 100 },
    });
    expect(map.thresholds).toEqual([5, 15, 25]);
    expect(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].map((d) => cellOf(map.weeks, d).level)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('values outside the range (before the first cell or in the future) do not affect quartiles', () => {
    const map = buildHeatmap({
      endDay: THURSDAY,
      values: {
        '2026-07-05': 1000, // day before the first cell
        '2026-11-21': 2000, // future
        '2026-11-16': 5,
        '2026-11-17': 15,
        '2026-11-18': 25,
        '2026-11-19': 100,
      },
    });
    expect(map.thresholds).toEqual([5, 15, 25]);
    expect(cellOf(map.weeks, '2026-11-17').level).toBe(2);
  });

  it('single active day → level 1; duplicates share thresholds', () => {
    const one = buildHeatmap({ endDay: THURSDAY, values: { '2026-11-18': 42 } });
    expect(cellOf(one.weeks, '2026-11-18').level).toBe(1);

    const dup = buildHeatmap({
      endDay: THURSDAY,
      values: { '2026-11-12': 10, '2026-11-13': 10, '2026-11-14': 10, '2026-11-15': 10, '2026-11-16': 50 },
    });
    expect(dup.thresholds).toEqual([10, 10, 10]);
    expect(cellOf(dup.weeks, '2026-11-12').level).toBe(1);
    expect(cellOf(dup.weeks, '2026-11-16').level).toBe(4);
  });

  it('no activity → every cell level 0', () => {
    const map = buildHeatmap({ endDay: THURSDAY, values: {} });
    expect(map.weeks.flat().every((c) => c.level === 0 && c.value === 0)).toBe(true);
  });

  it('cell value is the raw day value', () => {
    const map = buildHeatmap({ endDay: THURSDAY, values: { '2026-11-18': 137 } });
    expect(cellOf(map.weeks, '2026-11-18').value).toBe(137);
  });
});

describe('buildHeatmap — rest and quest flags', () => {
  it('marks rest days and days with a completed daily quest independently of XP', () => {
    const map = buildHeatmap({
      endDay: THURSDAY,
      values: { '2026-11-16': 30 },
      restDays: ['2026-11-17', '2026-11-18'],
      questDays: ['2026-11-16', '2026-11-18'],
    });
    const flags = (d: DayKey) => {
      const c = cellOf(map.weeks, d);
      return [c.rest, c.questDone];
    };
    expect(flags('2026-11-16')).toEqual([false, true]);
    expect(flags('2026-11-17')).toEqual([true, false]);
    expect(flags('2026-11-18')).toEqual([true, true]);
    expect(flags('2026-11-19')).toEqual([false, false]);
    expect(cellOf(map.weeks, '2026-11-17').level).toBe(0); // rest day without sets
  });

  it('does not mutate its inputs', () => {
    const input = {
      endDay: THURSDAY,
      values: { '2026-11-16': 30, '2026-11-17': 10 },
      restDays: ['2026-11-17'],
      questDays: ['2026-11-16'],
    };
    const snapshot = structuredClone(input);
    buildHeatmap(input);
    expect(input).toEqual(snapshot);
  });
});
