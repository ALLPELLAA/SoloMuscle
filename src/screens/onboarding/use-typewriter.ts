import { useEffect, useState } from 'react';

export interface TypewriterOptions {
  /** Milliseconds per typed character. */
  charMs?: number;
  /** Pause after each line, in ticks (characters). */
  linePauseTicks?: number;
  /** Ticks to wait before typing starts (lets the window animate in). */
  startDelayTicks?: number;
  /** Show everything immediately (reduced motion). */
  instant?: boolean;
}

export interface Typewriter {
  /** Visible character count for each line. */
  visible: number[];
  /** Line that shows the cursor, or -1 when typing is finished. */
  cursorLine: number;
  done: boolean;
  skip(): void;
}

function totalTicks(lines: readonly string[], pause: number): number {
  return lines.reduce((acc, line) => acc + line.length + pause, 0) - pause;
}

/** Reveals `lines` character by character, line after line. */
export function useTypewriter(
  lines: readonly string[],
  { charMs = 18, linePauseTicks = 10, startDelayTicks = 18, instant = false }: TypewriterOptions = {},
): Typewriter {
  const [tick, setTick] = useState(-startDelayTicks);
  const [skipped, setSkipped] = useState(false);
  const done = instant || skipped || tick >= totalTicks(lines, linePauseTicks);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setTick((t) => t + 1), charMs);
    return () => clearInterval(id);
  }, [charMs, done]);

  if (done) {
    return { visible: lines.map((l) => l.length), cursorLine: -1, done, skip: () => undefined };
  }

  const visible: number[] = [];
  let cursorLine = 0;
  let remaining = tick;
  lines.forEach((line, i) => {
    const shown = remaining <= 0 ? 0 : Math.min(line.length, remaining);
    visible.push(shown);
    if (shown > 0) cursorLine = i;
    remaining -= line.length + linePauseTicks;
  });

  return { visible, cursorLine, done, skip: () => setSkipped(true) };
}
