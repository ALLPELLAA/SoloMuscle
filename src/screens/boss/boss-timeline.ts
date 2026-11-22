/**
 * Keyframes (ms) of the "BOSS YENİLDİ" sequence. A single shared clock runs from 0 to
 * `TOTAL_MS`; every animated part interpolates its own window of that clock, so skipping
 * simply jumps the clock to the end. Presentation-only values, no game rules.
 */

/** HP bar hits: at `at` ms the bar drops to `to` (fraction of full HP). */
const HITS: readonly { at: number; to: number }[] = [
  { at: 480, to: 0.7 },
  { at: 720, to: 0.44 },
  { at: 960, to: 0.18 },
  { at: 1200, to: 0 },
];

/** Moment the boss breaks: flash, cracks, window turns gold. */
export const DEFEAT_AT = 1480;

export const TOTAL_MS = DEFEAT_AT + 1250;

export interface Frames {
  input: number[];
  output: number[];
}

function hpFrames(dropMs: number, delayMs: number): Frames {
  const input = [0];
  const output = [1];
  let level = 1;
  for (const hit of HITS) {
    input.push(hit.at + delayMs, hit.at + delayMs + dropMs);
    output.push(level, hit.to);
    level = hit.to;
  }
  return { input, output };
}

/** Main red HP fill. */
export const HP_FRAMES = hpFrames(80, 0);
/** Pale "damage" trail that follows the main fill a moment later. */
export const HP_TRAIL_FRAMES = hpFrames(200, 140);

function shakeFrames(): Frames {
  const input: number[] = [];
  const output: number[] = [];
  const add = (start: number, offsets: number[]) => {
    offsets.forEach((offset, i) => {
      input.push(start + i * 40);
      output.push(offset);
    });
  };
  // Entrance: strong, quickly decaying shake.
  add(0, [0, -14, 12, -10, 8, -6, 4, -2, 0]);
  // A small jolt on every HP hit.
  for (const hit of HITS) add(hit.at, [0, 5, -4, 0]);
  // The final blow.
  add(DEFEAT_AT, [0, -11, 9, -6, 3, 0]);
  return { input, output };
}

function hitPulseFrames(): Frames {
  const input = [0];
  const output = [1];
  for (const hit of HITS) {
    input.push(hit.at, hit.at + 40, hit.at + 150);
    output.push(1, 0.84, 1);
  }
  return { input, output };
}

/** Boss emblem squash on every hit (scale). */
export const HIT_PULSE_FRAMES = hitPulseFrames();

/** Horizontal window offset in px (multiplied by 0 when reduced motion is on). */
export const SHAKE_FRAMES = shakeFrames();

/** Shared keyframe windows: `[start, end]` pairs or longer frame lists. */
export const KEYS = {
  enter: [0, 180, 260],
  redFlash: [0, 60, 460],
  fightTitleOut: [DEFEAT_AT - 80, DEFEAT_AT + 60],
  goldFlash: [DEFEAT_AT, DEFEAT_AT + 70, DEFEAT_AT + 620],
  crack: [DEFEAT_AT, DEFEAT_AT + 160],
  split: [DEFEAT_AT + 40, DEFEAT_AT + 440],
  title: [DEFEAT_AT + 80, DEFEAT_AT + 300, DEFEAT_AT + 420],
  details: [DEFEAT_AT + 360, DEFEAT_AT + 660],
  reward: [DEFEAT_AT + 620, DEFEAT_AT + 860, DEFEAT_AT + 1000],
  button: [DEFEAT_AT + 900, DEFEAT_AT + 1200],
} as const;
