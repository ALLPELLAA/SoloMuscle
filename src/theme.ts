/**
 * Visual tokens for the RPG "system window" theme: dark background, blue neon panels,
 * red neon for penalty states. Screens must use these instead of hard-coded values.
 */
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  background: '#03060D',
  backgroundAlt: '#060B16',
  panel: 'rgba(8, 20, 40, 0.92)',
  panelSolid: '#081428',
  panelRaised: '#0C1D38',
  grid: 'rgba(58, 180, 255, 0.06)',

  neon: '#3AB4FF',
  neonBright: '#8FD8FF',
  neonDim: 'rgba(58, 180, 255, 0.35)',
  neonFaint: 'rgba(58, 180, 255, 0.12)',
  cyan: '#00E5FF',

  text: '#E6F4FF',
  textSecondary: '#8AA9C7',
  textMuted: '#4F6A86',

  danger: '#FF3B5C',
  dangerDim: 'rgba(255, 59, 92, 0.35)',
  dangerFaint: 'rgba(255, 59, 92, 0.12)',
  success: '#3DFFA8',
  successDim: 'rgba(61, 255, 168, 0.3)',
  warning: '#FFC145',
  gold: '#FFD66B',
  purple: '#B57BFF',

  overlay: 'rgba(1, 4, 10, 0.86)',
} as const;

/** Accent per stat (bars, icons). */
export const statColors = {
  strength: '#FF6B6B',
  endurance: '#3AB4FF',
  agility: '#3DFFA8',
  vitality: '#FFD66B',
  flexibility: '#B57BFF',
} as const;

/** Accent per rank badge. */
export const rankColors = {
  E: '#8AA9C7',
  D: '#3DFFA8',
  C: '#3AB4FF',
  B: '#B57BFF',
  A: '#FF9F43',
  S: '#FFD66B',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  condensed: Platform.select({ ios: 'System', android: 'sans-serif-condensed', default: 'System' }),
} as const;

export const typography = {
  display: { fontFamily: fonts.condensed, fontSize: 40, fontWeight: '800', letterSpacing: 4 },
  title: { fontFamily: fonts.condensed, fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  heading: { fontFamily: fonts.condensed, fontSize: 17, fontWeight: '700', letterSpacing: 1.5 },
  body: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  label: { fontFamily: fonts.condensed, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  caption: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '400', lineHeight: 16 },
  mono: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '600' },
  monoLarge: { fontFamily: fonts.mono, fontSize: 28, fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

/** Neon glow (RN `boxShadow`, works on Android with the New Architecture). */
export const glow = {
  neon: '0 0 14px rgba(58, 180, 255, 0.55)',
  neonStrong: '0 0 24px rgba(58, 180, 255, 0.85)',
  neonSoft: '0 0 8px rgba(58, 180, 255, 0.35)',
  danger: '0 0 16px rgba(255, 59, 92, 0.6)',
  success: '0 0 14px rgba(61, 255, 168, 0.5)',
  gold: '0 0 22px rgba(255, 214, 107, 0.7)',
} as const;

export const textGlow = {
  neon: { textShadowColor: 'rgba(58, 180, 255, 0.9)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  danger: { textShadowColor: 'rgba(255, 59, 92, 0.9)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  gold: { textShadowColor: 'rgba(255, 214, 107, 0.9)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
} as const satisfies Record<string, TextStyle>;

export type Tone = 'neon' | 'danger' | 'success' | 'gold';

export const toneColors: Record<Tone, { main: string; dim: string; faint: string; glow: string }> = {
  neon: { main: colors.neon, dim: colors.neonDim, faint: colors.neonFaint, glow: glow.neon },
  danger: { main: colors.danger, dim: colors.dangerDim, faint: colors.dangerFaint, glow: glow.danger },
  success: { main: colors.success, dim: colors.successDim, faint: 'rgba(61, 255, 168, 0.1)', glow: glow.success },
  gold: { main: colors.gold, dim: 'rgba(255, 214, 107, 0.35)', faint: 'rgba(255, 214, 107, 0.1)', glow: glow.gold },
};
