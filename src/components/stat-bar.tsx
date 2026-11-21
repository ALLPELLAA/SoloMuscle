import { StyleSheet, View } from 'react-native';

import { STAT_LABELS, statXpToNextPoint, type StatKey } from '@/game';
import { spacing, statColors } from '@/theme';

import { ProgressBar } from './progress-bar';
import { SystemText } from './system-text';

export interface StatBarProps {
  stat: StatKey;
  value: number;
  /** Training XP towards the next point; when given, a progress bar is shown. */
  statXp?: number;
  /** Highlight a pending change, e.g. `+2` on the allocation screen. */
  delta?: number;
}

export function StatBar({ stat, value, statXp, delta }: StatBarProps) {
  const color = statColors[stat];
  const need = statXpToNextPoint(value);
  return (
    <View style={styles.root} accessible accessibilityLabel={`${STAT_LABELS[stat]} ${value}`}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color, boxShadow: `0 0 6px ${color}` }]} />
        <SystemText variant="heading" style={styles.label}>
          {STAT_LABELS[stat].toLocaleUpperCase('tr-TR')}
        </SystemText>
        {delta ? (
          <SystemText variant="mono" tone="success" glow>
            {`+${delta}`}
          </SystemText>
        ) : null}
        <SystemText variant="monoLarge" style={{ color }}>
          {String(value + (delta ?? 0))}
        </SystemText>
      </View>
      {statXp !== undefined ? (
        <View style={styles.xpRow}>
          <ProgressBar progress={statXp / need} color={color} height={4} style={styles.bar} />
          <SystemText variant="caption" tone="muted">{`${statXp}/${need}`}</SystemText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { flex: 1 },
});
