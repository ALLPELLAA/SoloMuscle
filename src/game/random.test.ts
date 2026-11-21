/// <reference types="jest" />
/**
 * Deterministic randomness — docs/GAME_DESIGN.md §5 (FNV-1a 32-bit seed + mulberry32).
 */
import { hashString, mulberry32, pickIndex } from './random';

// Independent BigInt reference of mulberry32 (no shared code with src/game).
const U32 = 0xffffffffn;
function refMulberry32(seed: number): () => number {
  let a = BigInt(seed >>> 0);
  const mul = (x: bigint, y: bigint) => (x * y) & U32;
  return () => {
    a = (a + 0x6d2b79f5n) & U32;
    let t = a;
    t = mul(t ^ (t >> 15n), t | 1n);
    t = t ^ ((t + mul(t ^ (t >> 7n), t | 61n)) & U32);
    return Number((t ^ (t >> 14n)) & U32) / 4294967296;
  };
}

function take(rng: () => number, n: number): number[] {
  return Array.from({ length: n }, () => rng());
}

describe('hashString (FNV-1a 32-bit)', () => {
  it.each([
    ['', 0x811c9dc5],
    ['a', 0xe40c292c],
    ['b', 0xe70c2de5],
    ['foobar', 0xbf9cf968],
  ])('matches the published test vector for %p', (input, expected) => {
    expect(hashString(input)).toBe(expected);
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['2026-01-10|2026-01-11|daily', 'x'.repeat(500), 'Şınav ğüçö']) {
      const h = hashString(input);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('is deterministic and input-sensitive', () => {
    expect(hashString('2026-01-10|2026-01-11|daily')).toBe(hashString('2026-01-10|2026-01-11|daily'));
    expect(hashString('2026-01-10|2026-01-11|daily')).not.toBe(hashString('2026-01-10|2026-01-12|daily'));
  });
});

describe('mulberry32', () => {
  it.each([0, 1, 42, 0x811c9dc5, 0xffffffff])('matches the reference sequence for seed %i', (seed) => {
    expect(take(mulberry32(seed), 20)).toEqual(take(refMulberry32(seed), 20));
  });

  it('same seed → same sequence', () => {
    expect(take(mulberry32(12345), 50)).toEqual(take(mulberry32(12345), 50));
  });

  it('different seeds → different sequences', () => {
    expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5));
  });

  it('generators are independent of each other', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    a();
    a();
    expect(b()).toBe(mulberry32(7)());
  });

  it('yields floats in [0, 1)', () => {
    const rng = mulberry32(987654321);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const rng = mulberry32(2026);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(rng() * 4)] += 1;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});

describe('pickIndex = floor(rng() · length)', () => {
  it('maps the rng value onto an index', () => {
    expect(pickIndex(() => 0, 3)).toBe(0);
    expect(pickIndex(() => 0.3333, 3)).toBe(0);
    expect(pickIndex(() => 0.34, 3)).toBe(1);
    expect(pickIndex(() => 0.5, 2)).toBe(1);
    expect(pickIndex(() => 0.9999999, 3)).toBe(2);
  });

  it('never returns length, even if rng() returned 1', () => {
    expect(pickIndex(() => 1, 3)).toBe(2);
  });

  it('a pool of one always gives 0', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 20; i++) expect(pickIndex(rng, 1)).toBe(0);
  });

  it('stays within [0, length) for a real generator', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 1000; i++) {
      const idx = pickIndex(rng, 3);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });
});
