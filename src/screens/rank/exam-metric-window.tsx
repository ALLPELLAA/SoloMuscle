import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NumberStepper } from '@/components/number-stepper';
import { StopwatchPanel } from '@/components/stopwatch-panel';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { BASELINE_LIMITS, type ExamCheck } from '@/game';
import { colors, radii, spacing } from '@/theme';

import { METRIC_HINTS, METRIC_ICONS } from './rank-copy';

export interface ExamMetricWindowProps {
  index: number;
  total: number;
  /** Live preview check for the current input (presentation only). */
  check: ExamCheck;
  onChange: (value: number) => void;
  error?: string;
}

/** One exam movement: hint, threshold, stepper and live ✓/✗; plank adds a stopwatch. */
export function ExamMetricWindow({ index, total, check, onChange, error }: ExamMetricWindowProps) {
  const { key, label, unit, required, actual, passed } = check;
  const isPlank = key === 'plankSeconds';
  const [timerOpen, setTimerOpen] = useState(isPlank);
  const [measured, setMeasured] = useState<number | null>(null);
  const limits = BASELINE_LIMITS[key];

  const entered = actual > 0;
  const tone = error ? 'danger' : passed ? 'success' : 'neon';
  const statusColor = passed ? colors.success : entered ? colors.danger : colors.textMuted;

  const onMeasured = (seconds: number) => {
    setMeasured(seconds);
    onChange(seconds);
  };

  return (
    <SystemWindow
      title={`${index + 1}/${total} · ${label}`}
      tone={tone}
      headerRight={
        <View style={styles.headerRight}>
          <Ionicons name={passed ? 'checkmark-circle' : entered ? 'close-circle' : METRIC_ICONS[key]} size={18} color={passed ? colors.success : entered ? colors.danger : colors.neon} />
        </View>
      }
    >
      <SystemText variant="caption" tone="secondary">
        {METRIC_HINTS[key]}
      </SystemText>
      <View style={styles.thresholdRow}>
        <SystemText variant="label" tone="secondary">
          EŞİK
        </SystemText>
        <SystemText variant="mono" tone="neon">{`≥ ${required} ${unit}`}</SystemText>
      </View>

      <NumberStepper
        value={actual}
        onChange={onChange}
        min={limits.min}
        max={limits.max}
        step={isPlank ? 5 : 1}
        unit={unit}
        accessibilityLabel={`${label} sonucu`}
      />

      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        <SystemText variant="label" style={{ color: statusColor }}>
          {passed ? '✓ EŞİK KARŞILANDI' : entered ? `✗ ${required - actual} ${unit} EKSİK` : '— SONUCU GİR'}
        </SystemText>
      </View>
      {error ? (
        <SystemText variant="caption" tone="danger">
          {error}
        </SystemText>
      ) : null}

      {isPlank ? (
        <View style={styles.timerSection}>
          <SystemButton
            size="sm"
            variant={timerOpen ? 'ghost' : 'outline'}
            label={timerOpen ? 'Kronometreyi gizle' : 'Kronometre ile ölç'}
            icon={<Ionicons name="stopwatch-outline" size={16} color={colors.neon} />}
            onPress={() => setTimerOpen((open) => !open)}
          />
          {timerOpen ? (
            <View style={styles.timerBox}>
              <StopwatchPanel hint="Pozisyona geç ve başlat. Bıraktığın an durdur; süre otomatik girilir." onStop={onMeasured} />
              {measured !== null ? (
                <SystemText variant="caption" tone="success" align="center">
                  {`✓ Ölçüm aktarıldı: ${measured} ${unit}`}
                </SystemText>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { alignItems: 'center' },
  timerSection: { gap: spacing.md },
  timerBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundAlt,
  },
});
