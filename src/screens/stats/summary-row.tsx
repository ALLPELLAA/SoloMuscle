import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, radii, spacing, type Tone } from '@/theme';

import { formatNumber, withAlpha } from './stats-format';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface SummaryRowProps {
  streakCurrent: number;
  streakBest: number;
  level: number;
  totalXp: number;
  /** null while the heatmap is loading. */
  activeDays: number | null;
  heatmapWeeks: number;
  recordCount: number;
}

/** Four compact system windows: streak, level, active days and personal records. */
export function SummaryRow({
  streakCurrent,
  streakBest,
  level,
  totalXp,
  activeDays,
  heatmapWeeks,
  recordCount,
}: SummaryRowProps) {
  return (
    <View style={styles.grid}>
      <SummaryTile
        index={0}
        title="Seri"
        tone="gold"
        icon="flame"
        iconColor={streakCurrent > 0 ? colors.warning : colors.textMuted}
        value={String(streakCurrent)}
        unit="gün"
        caption={`En iyi: ${streakBest} gün`}
        accessibilityLabel={`Seri ${streakCurrent} gün, en iyi ${streakBest} gün`}
      />
      <SummaryTile
        index={1}
        title="Level"
        icon="trending-up"
        iconColor={colors.neon}
        value={String(level)}
        unit="LV"
        caption={`${formatNumber(totalXp)} toplam XP`}
        accessibilityLabel={`Level ${level}, toplam ${totalXp} XP`}
      />
      <SummaryTile
        index={2}
        title="Aktif Gün"
        icon="calendar"
        iconColor={colors.cyan}
        value={activeDays === null ? '–' : String(activeDays)}
        unit="gün"
        caption={`Son ${heatmapWeeks} hafta`}
        accessibilityLabel={`Son ${heatmapWeeks} haftada ${activeDays ?? 0} aktif gün`}
      />
      <SummaryTile
        index={3}
        title="Rekor"
        tone="gold"
        icon="trophy"
        iconColor={recordCount > 0 ? colors.gold : colors.textMuted}
        value={String(recordCount)}
        unit="adet"
        caption="Kişisel rekor"
        accessibilityLabel={`${recordCount} kişisel rekor`}
      />
    </View>
  );
}

interface SummaryTileProps {
  index: number;
  title: string;
  tone?: Tone;
  icon: IconName;
  iconColor: string;
  value: string;
  unit: string;
  caption: string;
  accessibilityLabel: string;
}

function SummaryTile({ index, title, tone = 'neon', icon, iconColor, value, unit, caption, accessibilityLabel }: SummaryTileProps) {
  return (
    <Animated.View entering={FadeInDown.delay(60 * index).duration(380)} style={styles.cell}>
      <SystemWindow title={title} tone={tone} contentStyle={styles.content}>
        <View style={styles.valueRow} accessible accessibilityLabel={accessibilityLabel}>
          <View style={[styles.iconBox, { borderColor: withAlpha(iconColor, 0.45), backgroundColor: withAlpha(iconColor, 0.1) }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <SystemText variant="monoLarge" tone={tone === 'gold' ? 'gold' : 'neon'} glow numberOfLines={1} style={styles.value}>
            {value}
          </SystemText>
          <SystemText variant="label" tone="muted" style={styles.unit}>
            {unit.toLocaleUpperCase('tr-TR')}
          </SystemText>
        </View>
        <SystemText variant="caption" tone="secondary" numberOfLines={1}>
          {caption}
        </SystemText>
      </SystemWindow>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexBasis: '45%', flexGrow: 1 },
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { flexShrink: 1 },
  unit: { alignSelf: 'flex-end', paddingBottom: spacing.xs },
});
