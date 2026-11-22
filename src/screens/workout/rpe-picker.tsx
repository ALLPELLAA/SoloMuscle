import { Pressable, StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { RPE_LABELS, RPE_MAX, RPE_MIN } from '@/game';
import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

import { rpeTone } from './workout-format';

export interface RpePickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

const VALUES = Array.from({ length: RPE_MAX - RPE_MIN + 1 }, (_, i) => RPE_MIN + i);

/** Optional effort rating 1–10 (§11); "—" skips it. */
export function RpePicker({ value, onChange }: RpePickerProps) {
  const caption = value === null ? 'Belirtilmedi (isteğe bağlı)' : `${value} · ${RPE_LABELS[value]}`;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SystemText variant="label" tone="secondary">
          ZORLUK (RPE)
        </SystemText>
        <SystemText variant="caption" tone={value === null ? 'muted' : rpeTone(value)}>
          {caption}
        </SystemText>
      </View>
      <View style={styles.row}>
        <Chip label="—" selected={value === null} tone="neon" onPress={() => onChange(null)} a11y="RPE belirtme" />
        {VALUES.map((v) => (
          <Chip
            key={v}
            label={String(v)}
            selected={value === v}
            tone={rpeTone(v)}
            onPress={() => onChange(v)}
            a11y={`RPE ${v}, ${RPE_LABELS[v]}`}
          />
        ))}
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  tone,
  onPress,
  a11y,
}: {
  label: string;
  selected: boolean;
  tone: Tone;
  onPress: () => void;
  a11y: string;
}) {
  const t = toneColors[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? t.main : t.faint },
        selected && { backgroundColor: t.dim, boxShadow: t.glow },
        pressed && styles.pressed,
      ]}
    >
      <SystemText variant="mono" style={{ color: selected ? colors.text : t.main }}>
        {label}
      </SystemText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSolid,
  },
  pressed: { opacity: 0.7 },
});
