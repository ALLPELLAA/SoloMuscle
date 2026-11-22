import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { RPE_LABELS, RPE_MAX, RPE_MIN } from '@/game';
import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

export interface RpePickerProps {
  /** Selected RPE, `null` = not given (RPE is optional). */
  value: number | null;
  onChange: (value: number | null) => void;
  tone: Tone;
  disabled?: boolean;
}

const VALUES = Array.from({ length: RPE_MAX - RPE_MIN + 1 }, (_, i) => RPE_MIN + i);

/** Optional perceived-exertion chips 1–10; tapping the selected chip clears it. */
export function RpePicker({ value, onChange, tone, disabled = false }: RpePickerProps) {
  const t = toneColors[tone];

  const select = (next: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onChange(next === value ? null : next);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SystemText variant="label" tone="secondary" style={styles.flex}>
          EFOR (RPE)
        </SystemText>
        <SystemText variant="label" tone={value === null ? 'muted' : tone}>
          {value === null ? 'İSTEĞE BAĞLI' : `${value} · ${RPE_LABELS[value].toLocaleUpperCase('tr-TR')}`}
        </SystemText>
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Efor seviyesi (RPE), isteğe bağlı">
        {VALUES.map((rpe) => {
          const selected = value === rpe;
          const filled = value !== null && rpe < value;
          return (
            <Pressable
              key={rpe}
              accessibilityRole="radio"
              accessibilityLabel={`RPE ${rpe}, ${RPE_LABELS[rpe]}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={() => select(rpe)}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: selected ? t.main : t.dim },
                filled && { backgroundColor: t.faint },
                selected && { backgroundColor: t.main, boxShadow: t.glow },
                pressed && !selected && { backgroundColor: t.dim },
                disabled && styles.disabled,
              ]}
            >
              <SystemText variant="mono" style={{ color: selected ? colors.background : filled ? t.main : colors.textSecondary }}>
                {String(rpe)}
              </SystemText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  disabled: { opacity: 0.4 },
});
