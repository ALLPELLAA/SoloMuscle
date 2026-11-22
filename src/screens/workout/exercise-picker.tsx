import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { EXERCISES, EXERCISE_IDS, UNIT_LABELS, type ExerciseId } from '@/game';
import { colors, glow, radii, spacing } from '@/theme';

export interface ExercisePickerProps {
  selected: ExerciseId;
  onSelect: (id: ExerciseId) => void;
  /** Exercises with an unfinished daily quest objective. */
  questIds: readonly ExerciseId[];
  /** Exercises with an unfinished penalty quest objective. */
  penaltyIds: readonly ExerciseId[];
}

/** Grid of exercise chips; quest targets are flagged. */
export function ExercisePicker({ selected, onSelect, questIds, penaltyIds }: ExercisePickerProps) {
  return (
    <SystemWindow title="Egzersiz Seç" headerRight={<Legend hasPenalty={penaltyIds.length > 0} />}>
      <View style={styles.grid}>
        {EXERCISE_IDS.map((id) => {
          const def = EXERCISES[id];
          const active = id === selected;
          const penalty = penaltyIds.includes(id);
          const quest = !penalty && questIds.includes(id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${def.name}, ${UNIT_LABELS[def.unit].long}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(id)}
              style={({ pressed }) => [
                styles.chip,
                penalty && styles.chipPenalty,
                active && (penalty ? styles.chipActivePenalty : styles.chipActive),
                pressed && styles.chipPressed,
              ]}
            >
              {penalty || quest ? (
                <Ionicons
                  name={penalty ? 'skull-outline' : 'flag'}
                  size={11}
                  color={penalty ? colors.danger : colors.gold}
                />
              ) : null}
              <SystemText
                variant="label"
                tone={active ? (penalty ? 'danger' : 'neon') : 'default'}
                glow={active}
                style={styles.chipName}
              >
                {def.name}
              </SystemText>
              <SystemText variant="caption" tone="muted" style={styles.unit}>
                {UNIT_LABELS[def.unit].short}
              </SystemText>
            </Pressable>
          );
        })}
      </View>
    </SystemWindow>
  );
}

function Legend({ hasPenalty }: { hasPenalty: boolean }) {
  return (
    <View style={styles.legend}>
      <Ionicons name={hasPenalty ? 'skull-outline' : 'flag'} size={11} color={hasPenalty ? colors.danger : colors.gold} />
      <SystemText variant="caption" tone={hasPenalty ? 'danger' : 'gold'}>
        {hasPenalty ? 'ceza hedefi' : 'görev hedefi'}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.panelSolid,
  },
  chipPenalty: { borderColor: colors.dangerDim },
  chipActive: { borderColor: colors.neon, backgroundColor: colors.neonFaint, boxShadow: glow.neonSoft },
  chipActivePenalty: { borderColor: colors.danger, backgroundColor: colors.dangerFaint, boxShadow: glow.danger },
  chipPressed: { opacity: 0.75 },
  chipName: { fontSize: 13, letterSpacing: 0.5 },
  unit: { fontSize: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
