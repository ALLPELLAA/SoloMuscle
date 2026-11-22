import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import { SystemText } from './system-text';

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unit shown under the value, e.g. `tekrar`, `sn`. */
  unit?: string;
  label?: string;
  accessibilityLabel?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Integer input with −/+ buttons and direct typing. Always emits a clamped integer. */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  label,
  accessibilityLabel,
}: NumberStepperProps) {
  const [text, setText] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // Keep the text in sync when the value changes from outside (derived state pattern).
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(String(value));
  }

  const commitText = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    setText(digits);
    if (digits.length === 0) return;
    const next = clamp(parseInt(digits, 10), min, max);
    if (next !== value) onChange(next);
  };

  const onBlur = () => {
    const parsed = parseInt(text, 10);
    const next = clamp(Number.isFinite(parsed) ? parsed : min, min, max);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const bump = (delta: number) => onChange(clamp(value + delta, min, max));

  return (
    <View style={styles.root}>
      {label ? (
        <SystemText variant="label" tone="secondary">
          {label.toLocaleUpperCase('tr-TR')}
        </SystemText>
      ) : null}
      <View style={styles.row}>
        <StepButton symbol="−" onPress={() => bump(-step)} disabled={value <= min} label="Azalt" />
        <View style={styles.valueBox}>
          <TextInput
            value={text}
            onChangeText={commitText}
            onBlur={onBlur}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={String(max).length}
            selectTextOnFocus
            accessibilityLabel={accessibilityLabel ?? label}
            style={styles.input}
            placeholderTextColor={colors.textMuted}
          />
          {unit ? (
            <SystemText variant="caption" tone="muted">
              {unit}
            </SystemText>
          ) : null}
        </View>
        <StepButton symbol="+" onPress={() => bump(step)} disabled={value >= max} label="Artır" />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  onPress,
  disabled,
  label,
}: {
  symbol: string;
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed, disabled && styles.stepDisabled]}
    >
      <SystemText variant="title" tone="neon">
        {symbol}
      </SystemText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  valueBox: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neonDim,
    borderRadius: radii.sm,
    backgroundColor: colors.panelSolid,
    paddingVertical: spacing.xs,
  },
  input: {
    ...typography.monoLarge,
    color: colors.text,
    textAlign: 'center',
    // Fill the value box (on web an <input> would otherwise keep its intrinsic ~350 px width).
    alignSelf: 'stretch',
    minWidth: 0,
    paddingVertical: 0,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: colors.neonFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { backgroundColor: colors.neonDim },
  stepDisabled: { opacity: 0.35 },
});
