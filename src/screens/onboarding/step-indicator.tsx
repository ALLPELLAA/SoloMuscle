import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { colors, glow, radii, spacing } from '@/theme';

import type { OnboardingStepDef } from './steps';

export interface StepIndicatorProps {
  steps: readonly OnboardingStepDef[];
  current: number;
}

/** Segmented "protocol progress" bar shown above every onboarding step. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  const active = steps[current];
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Adım ${current + 1} / ${steps.length}: ${active?.label ?? ''}`}
      accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}
    >
      <View style={styles.header}>
        <SystemText variant="label" tone="muted">
          {`UYANIŞ PROTOKOLÜ · ADIM ${current + 1}/${steps.length}`}
        </SystemText>
        <SystemText variant="label" tone="neon" glow>
          {(active?.label ?? '').toLocaleUpperCase('tr-TR')}
        </SystemText>
      </View>
      <View style={styles.segments}>
        {steps.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <View key={step.key} style={styles.segment}>
              <View style={[styles.bar, barStyles[state]]} />
              <SystemText
                variant="caption"
                tone={state === 'todo' ? 'muted' : state === 'current' ? 'neon' : 'secondary'}
                numberOfLines={1}
              >
                {`${i < current ? '✓ ' : ''}${step.label}`}
              </SystemText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  segments: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, gap: spacing.xs },
  bar: { height: 3, borderRadius: radii.pill },
});

const barStyles = StyleSheet.create({
  done: { backgroundColor: colors.neon },
  current: { backgroundColor: colors.neonBright, boxShadow: glow.neon },
  todo: { backgroundColor: colors.neonFaint },
});
