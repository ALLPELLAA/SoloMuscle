import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatBar } from '@/components/stat-bar';
import { SystemText } from '@/components/system-text';
import { STAT_LABELS, type StatKey } from '@/game';
import { colors, radii, spacing, statColors } from '@/theme';

import { STAT_DESCRIPTIONS } from './stat-descriptions';

export interface StatAllocationRowProps {
  stat: StatKey;
  value: number;
  delta: number;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

/** One stat: bar with pending delta, description and −/+ controls. */
export function StatAllocationRow({
  stat,
  value,
  delta,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
  disabled = false,
}: StatAllocationRowProps) {
  const label = STAT_LABELS[stat];
  return (
    <View style={[styles.root, delta > 0 && { borderLeftColor: statColors[stat] }]}>
      <View style={styles.info}>
        <StatBar stat={stat} value={value} delta={delta} />
        <SystemText variant="caption" tone="muted">
          {STAT_DESCRIPTIONS[stat]}
        </SystemText>
      </View>
      <View style={styles.controls}>
        <StepButton
          icon="remove"
          label={`${label} azalt`}
          color={colors.neon}
          disabled={disabled || !canRemove}
          onPress={onRemove}
        />
        <StepButton
          icon="add"
          label={`${label} artır`}
          color={statColors[stat]}
          disabled={disabled || !canAdd}
          onPress={onAdd}
        />
      </View>
    </View>
  );
}

interface StepButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}

function StepButton({ icon, label, color, disabled, onPress }: StepButtonProps) {
  const handlePress = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.step,
        { borderColor: color },
        pressed && styles.stepPressed,
        disabled && styles.stepDisabled,
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  info: { flex: 1, gap: spacing.xs },
  controls: { flexDirection: 'row', gap: spacing.sm },
  step: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    backgroundColor: colors.neonFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { backgroundColor: colors.neonDim, transform: [{ scale: 0.95 }] },
  stepDisabled: { opacity: 0.3 },
});
