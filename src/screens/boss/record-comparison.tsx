import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { EXERCISES, formatAmount, UNIT_LABELS, type ExerciseId } from '@/game';
import { colors, radii, spacing, toneColors } from '@/theme';

import { BOSS_COPY } from './boss-copy';

export interface RecordComparisonProps {
  exerciseId: ExerciseId;
  previous: number | null;
  amount: number;
}

const gold = toneColors.gold;

/** "Eski rekor → Yeni rekor" panel for the beaten exercise. */
export function RecordComparison({ exerciseId, previous, amount }: RecordComparisonProps) {
  const exercise = EXERCISES[exerciseId];
  const unit = UNIT_LABELS[exercise.unit].short;
  const previousText = previous === null ? '—' : formatAmount(exerciseId, previous);
  const gain = previous === null ? null : amount - previous;
  const summary = `${BOSS_COPY.previousLabel}: ${previousText} → ${BOSS_COPY.newLabel}: ${formatAmount(exerciseId, amount)}`;

  return (
    <View style={styles.root} accessible accessibilityLabel={`${exercise.name}. ${summary}`}>
      <View style={styles.exerciseRow}>
        <Ionicons name="barbell-outline" size={14} color={colors.neon} />
        <SystemText variant="label" tone="neon" numberOfLines={1}>
          {exercise.name.toLocaleUpperCase('tr-TR')}
        </SystemText>
        <View style={styles.rule} />
        {gain !== null && gain > 0 ? (
          <SystemText variant="label" tone="success">
            {`+${formatAmount(exerciseId, gain).toLocaleUpperCase('tr-TR')}`}
          </SystemText>
        ) : null}
      </View>

      <View style={styles.compare}>
        <View style={[styles.box, styles.previousBox]}>
          <SystemText variant="label" tone="muted">
            {BOSS_COPY.previousLabel.toLocaleUpperCase('tr-TR')}
          </SystemText>
          <View style={styles.valueRow}>
            <SystemText variant="title" tone="secondary" style={styles.struck}>
              {previous === null ? '—' : String(previous)}
            </SystemText>
            <SystemText variant="caption" tone="muted">
              {unit}
            </SystemText>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.gold} style={styles.arrow} />

        <View style={[styles.box, styles.newBox]}>
          <SystemText variant="label" tone="gold">
            {BOSS_COPY.newLabel.toLocaleUpperCase('tr-TR')}
          </SystemText>
          <View style={styles.valueRow}>
            <SystemText variant="monoLarge" tone="gold" glow>
              {String(amount)}
            </SystemText>
            <SystemText variant="caption" tone="gold">
              {unit}
            </SystemText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rule: { flex: 1, height: 1, marginHorizontal: spacing.xs, backgroundColor: colors.neonFaint },
  compare: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  box: {
    flex: 1,
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
  },
  previousBox: { borderColor: colors.neonFaint, backgroundColor: colors.backgroundAlt },
  newBox: { borderColor: gold.dim, backgroundColor: gold.faint },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  arrow: { alignSelf: 'center' },
  struck: { textDecorationLine: 'line-through', textDecorationColor: colors.textMuted },
});
