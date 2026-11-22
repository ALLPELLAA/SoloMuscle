import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import type { ExamCheck } from '@/game';
import { colors, radii, spacing, toneColors } from '@/theme';

import { formatMetric, type ExamMetricKey } from './rank-copy';

export interface ExamCheckTableProps {
  checks: readonly ExamCheck[];
  /** Metrics whose personal record was raised by this exam. */
  newRecords?: ReadonlySet<ExamMetricKey>;
}

/** Result table: movement | threshold | result | ✓/✗. */
export function ExamCheckTable({ checks, newRecords }: ExamCheckTableProps) {
  return (
    <View style={styles.table} accessibilityRole="summary">
      <View style={[styles.row, styles.headRow]}>
        <SystemText variant="label" tone="muted" style={styles.nameCol}>
          HAREKET
        </SystemText>
        <SystemText variant="label" tone="muted" style={styles.numCol} align="right">
          EŞİK
        </SystemText>
        <SystemText variant="label" tone="muted" style={styles.numCol} align="right">
          SONUÇ
        </SystemText>
        <View style={styles.iconCol} />
      </View>
      {checks.map((check) => {
        const tone = check.passed ? toneColors.success : toneColors.danger;
        const record = newRecords?.has(check.key) ?? false;
        return (
          <View
            key={check.key}
            style={[styles.row, { backgroundColor: tone.faint }]}
            accessible
            accessibilityLabel={`${check.label}: eşik ${check.required}, sonuç ${check.actual}, ${check.passed ? 'geçti' : 'kaldı'}`}
          >
            <View style={styles.nameCol}>
              <SystemText variant="bodyStrong">{check.label}</SystemText>
              {record ? (
                <SystemText variant="label" tone="gold" style={styles.recordTag}>
                  ★ YENİ REKOR
                </SystemText>
              ) : null}
            </View>
            <SystemText variant="mono" tone="secondary" style={styles.numCol} align="right">
              {formatMetric(check.key, check.required)}
            </SystemText>
            <SystemText variant="mono" tone={check.passed ? 'success' : 'danger'} style={styles.numCol} align="right">
              {formatMetric(check.key, check.actual)}
            </SystemText>
            <View style={styles.iconCol}>
              <Ionicons name={check.passed ? 'checkmark-circle' : 'close-circle'} size={20} color={tone.main} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    overflow: 'hidden',
    gap: 1,
    backgroundColor: colors.neonFaint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panelSolid,
  },
  headRow: { paddingVertical: spacing.xs },
  nameCol: { flex: 1.4 },
  numCol: { flex: 1 },
  iconCol: { width: 22, alignItems: 'flex-end' },
  recordTag: { fontSize: 10, letterSpacing: 1 },
});
