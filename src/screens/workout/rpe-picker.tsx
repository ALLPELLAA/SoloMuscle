import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SystemText } from '@/components/system-text';
import { RPE_LABELS, RPE_MAX, RPE_MIN } from '@/game';
import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

import { rpeTone } from './workout-format';

export interface RpePickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

const VALUES = Array.from({ length: RPE_MAX - RPE_MIN + 1 }, (_, i) => RPE_MIN + i);
const PER_ROW = 5;
/** 1–5 and 6–10: two rows keep every chip a full-size touch target on narrow phones. */
const ROWS = Array.from({ length: Math.ceil(VALUES.length / PER_ROW) }, (_, i) =>
  VALUES.slice(i * PER_ROW, (i + 1) * PER_ROW),
);

/** Optional effort rating 1–10 (§11); "Belirtme" skips it. */
export function RpePicker({ value, onChange }: RpePickerProps) {
  const caption = value === null ? 'Belirtilmedi (isteğe bağlı)' : `${value} · ${RPE_LABELS[value]}`;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <SystemText variant="label" tone="secondary">
            ZORLUK (RPE)
          </SystemText>
          <SystemText variant="caption" tone={value === null ? 'muted' : rpeTone(value)}>
            {caption}
          </SystemText>
        </View>
        <Chip
          label="Belirtme"
          selected={value === null}
          tone="neon"
          onPress={() => onChange(null)}
          a11y="RPE belirtme"
          style={styles.skipChip}
        />
      </View>
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((v) => (
            <Chip
              key={v}
              label={String(v)}
              selected={value === v}
              tone={rpeTone(v)}
              onPress={() => onChange(v)}
              a11y={`RPE ${v}, ${RPE_LABELS[v]}`}
              style={styles.valueChip}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Chip({
  label,
  selected,
  tone,
  onPress,
  a11y,
  style,
}: {
  label: string;
  selected: boolean;
  tone: Tone;
  onPress: () => void;
  a11y: string;
  style: StyleProp<ViewStyle>;
}) {
  const t = toneColors[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        style,
        { borderColor: selected ? t.main : t.faint },
        selected && { backgroundColor: t.dim, boxShadow: t.glow },
        pressed && styles.pressed,
      ]}
    >
      <SystemText variant="mono" numberOfLines={1} style={{ color: selected ? colors.text : t.main }}>
        {label}
      </SystemText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: spacing.xxs },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSolid,
  },
  valueChip: { flex: 1, minWidth: 44 },
  skipChip: { minWidth: 96, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.7 },
});
