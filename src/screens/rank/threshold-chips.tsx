import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { EXAM_METRICS, type BaselineTest } from '@/game';
import { colors, radii, spacing, toneColors } from '@/theme';

import { formatMetric, type ExamMetricKey } from './rank-copy';

export interface ThresholdChipsProps {
  values: BaselineTest;
  /** true = met (green), false = missed (red), missing = neutral. */
  passed?: Partial<Record<ExamMetricKey, boolean>>;
  dimmed?: boolean;
}

/** Four compact cells: Şınav / Mekik / Squat / Plank with their values. */
export function ThresholdChips({ values, passed, dimmed = false }: ThresholdChipsProps) {
  return (
    <View style={[styles.row, dimmed && styles.dimmed]}>
      {EXAM_METRICS.map(({ key, label }) => {
        const state = passed?.[key];
        const tone = state === true ? toneColors.success : state === false ? toneColors.danger : null;
        return (
          <View
            key={key}
            style={[styles.chip, tone && { borderColor: tone.dim, backgroundColor: tone.faint }]}
            accessible
            accessibilityLabel={`${label} ${formatMetric(key, values[key])}${state === true ? ', karşılandı' : state === false ? ', karşılanmadı' : ''}`}
          >
            <SystemText variant="label" tone="muted" style={styles.label} numberOfLines={1}>
              {label.toLocaleUpperCase('tr-TR')}
            </SystemText>
            <SystemText
              variant="mono"
              tone={state === true ? 'success' : state === false ? 'danger' : 'default'}
              numberOfLines={1}
            >
              {`${state === true ? '✓ ' : state === false ? '✗ ' : ''}${formatMetric(key, values[key])}`}
            </SystemText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  dimmed: { opacity: 0.45 },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundAlt,
  },
  label: { fontSize: 10, letterSpacing: 1 },
});
