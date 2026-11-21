import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, textGlow, typography, type Tone } from '@/theme';

export type TextVariant = keyof typeof typography;

export interface SystemTextProps extends TextProps {
  variant?: TextVariant;
  /** Colors the text with a tone (and adds glow when `glow` is set). */
  tone?: Tone | 'default' | 'secondary' | 'muted';
  glow?: boolean;
  align?: TextStyle['textAlign'];
  uppercase?: boolean;
}

const toneTextColor: Record<NonNullable<SystemTextProps['tone']>, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  neon: colors.neon,
  danger: colors.danger,
  success: colors.success,
  gold: colors.gold,
};

const glowFor: Partial<Record<NonNullable<SystemTextProps['tone']>, TextStyle>> = {
  neon: textGlow.neon,
  danger: textGlow.danger,
  gold: textGlow.gold,
};

/** Themed text. Defaults to `body` / default color. */
export function SystemText({
  variant = 'body',
  tone = 'default',
  glow = false,
  align,
  uppercase = false,
  style,
  ...rest
}: SystemTextProps) {
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: toneTextColor[tone] },
        glow && glowFor[tone],
        align && { textAlign: align },
        uppercase && styles.uppercase,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
});
