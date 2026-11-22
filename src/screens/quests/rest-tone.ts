/** Calm purple accent for rest/sick-day UI, derived from the theme's `colors.purple`. */
import type { TextStyle } from 'react-native';

import { colors } from '@/theme';

function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const restTone = {
  main: colors.purple,
  dim: withAlpha(colors.purple, 0.4),
  faint: withAlpha(colors.purple, 0.1),
  glow: `0 0 14px ${withAlpha(colors.purple, 0.45)}`,
} as const;

export const restTextGlow: TextStyle = {
  textShadowColor: withAlpha(colors.purple, 0.9),
  textShadowRadius: 10,
  textShadowOffset: { width: 0, height: 0 },
};
