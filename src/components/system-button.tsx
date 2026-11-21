import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

import { SystemText } from './system-text';

export interface SystemButtonProps {
  label: string;
  onPress?: () => void;
  /** `solid` = filled neon, `outline` = bordered, `ghost` = text only. */
  variant?: 'solid' | 'outline' | 'ghost';
  tone?: Tone;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function SystemButton({
  label,
  onPress,
  variant = 'outline',
  tone = 'neon',
  disabled = false,
  loading = false,
  icon,
  size = 'md',
  style,
  accessibilityHint,
}: SystemButtonProps) {
  const t = toneColors[tone];
  const inactive = disabled || loading;
  const solid = variant === 'solid';

  const handlePress = () => {
    if (inactive || !onPress) return;
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={handlePress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        variant !== 'ghost' && { borderColor: t.main, borderWidth: 1 },
        solid && { backgroundColor: t.main, boxShadow: t.glow },
        variant === 'outline' && { backgroundColor: pressed ? t.dim : t.faint },
        variant === 'ghost' && pressed && { backgroundColor: t.faint },
        solid && pressed && styles.solidPressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={solid ? colors.background : t.main} /> : icon}
        <SystemText
          variant={size === 'sm' ? 'label' : 'heading'}
          style={{ color: solid ? colors.background : t.main }}
          numberOfLines={1}
        >
          {label.toLocaleUpperCase('tr-TR')}
        </SystemText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: 52, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  sm: { minHeight: 40, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  solidPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
});
