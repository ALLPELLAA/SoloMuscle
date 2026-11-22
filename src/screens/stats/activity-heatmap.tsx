import * as Haptics from 'expo-haptics';
import { memo, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { REST_KIND_LABELS, type DayKey, type HeatCell, type Heatmap, type RestDayKind } from '@/game';
import { colors, radii, spacing } from '@/theme';

import { WEEKDAYS_SHORT, formatLongDay, formatNumber, monthOf, MONTHS_SHORT, withAlpha } from './stats-format';

export interface ActivityHeatmapProps {
  /** null while loading. */
  heatmap: Heatmap | null;
  weeks: number;
  today: DayKey;
  /** Kind of each marked rest/sick day (for the info line). */
  restKinds: Record<DayKey, RestDayKind>;
}

const DAY_LABEL_WIDTH = 26;
const MONTH_ROW_HEIGHT = 16;
const MIN_CELL = 11;
const MAX_CELL = 18;

/** Fill per intensity level: neon blue with increasing opacity. */
const LEVEL_FILL: readonly string[] = [
  colors.neonFaint,
  withAlpha(colors.neon, 0.3),
  withAlpha(colors.neon, 0.52),
  withAlpha(colors.neon, 0.76),
  colors.neonBright,
];
const REST_FILL = withAlpha(colors.purple, 0.16);

interface Geometry {
  cell: number;
  gap: number;
  scroll: boolean;
}

function computeGeometry(width: number, weeks: number): Geometry {
  const gap = width < 320 ? 2 : 3;
  const available = width - DAY_LABEL_WIDTH - gap * (weeks - 1);
  const fit = Math.floor((available / weeks) * 2) / 2;
  if (fit < MIN_CELL) return { cell: MIN_CELL, gap, scroll: true };
  return { cell: Math.min(MAX_CELL, fit), gap, scroll: false };
}

/** GitHub-style activity map of the last weeks (docs §14). */
export function ActivityHeatmap({ heatmap, weeks, today, restKinds }: ActivityHeatmapProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<DayKey | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  const onSelect = useCallback((dayKey: DayKey) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSelected((prev) => (prev === dayKey ? null : dayKey));
  }, []);

  const geometry = width > 0 ? computeGeometry(width, weeks) : null;
  const selectedCell = heatmap && selected ? findCell(heatmap, selected) : null;

  return (
    <SystemWindow
      title="Aktivite"
      headerRight={
        <SystemText variant="label" tone="muted">
          {`SON ${weeks} HAFTA`}
        </SystemText>
      }
    >
      <View onLayout={onLayout} style={styles.measure}>
        {heatmap && geometry ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            scrollEnabled={geometry.scroll}
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => {
              if (geometry.scroll) scrollRef.current?.scrollToEnd({ animated: false });
            }}
          >
            <HeatGrid
              heatmap={heatmap}
              cell={geometry.cell}
              gap={geometry.gap}
              today={today}
              selected={selected}
              onSelect={onSelect}
            />
          </ScrollView>
        ) : (
          <View style={styles.loading}>
            <SystemText variant="label" tone="muted">
              VERİ YÜKLENİYOR...
            </SystemText>
          </View>
        )}
      </View>

      <InfoLine cell={selectedCell} restKind={selected ? restKinds[selected] : undefined} />
      <Legend />

      {heatmap ? (
        <View style={styles.totals}>
          <Total label="AKTİF GÜN" value={String(heatmap.activeDays)} />
          <View style={styles.totalDivider} />
          <Total label="TOPLAM XP" value={formatNumber(heatmap.totalValue)} gold />
        </View>
      ) : null}
    </SystemWindow>
  );
}

function findCell(heatmap: Heatmap, dayKey: DayKey): HeatCell | null {
  for (const week of heatmap.weeks) {
    for (const cell of week) if (cell.dayKey === dayKey) return cell;
  }
  return null;
}

interface HeatGridProps {
  heatmap: Heatmap;
  cell: number;
  gap: number;
  today: DayKey;
  selected: DayKey | null;
  onSelect: (dayKey: DayKey) => void;
}

function HeatGrid({ heatmap, cell, gap, today, selected, onSelect }: HeatGridProps) {
  const step = cell + gap;
  const gridWidth = DAY_LABEL_WIDTH + heatmap.weeks.length * step - gap;
  const showAllDays = cell >= 14;
  const months = monthLabels(heatmap.weeks);

  return (
    <View>
      <View style={[styles.monthRow, { width: gridWidth }]}>
        {months.map((m) => (
          <SystemText
            key={m.week}
            variant="caption"
            tone="secondary"
            style={[styles.monthLabel, { left: DAY_LABEL_WIDTH + m.week * step }]}
            numberOfLines={1}
          >
            {m.label}
          </SystemText>
        ))}
      </View>
      <View style={styles.gridRow}>
        <View style={[styles.dayLabels, { gap }]}>
          {WEEKDAYS_SHORT.map((label, index) => (
            <View key={label} style={[styles.dayLabelCell, { height: cell }]}>
              {showAllDays || index % 2 === 0 ? (
                <SystemText variant="caption" tone="muted" style={styles.dayLabel} numberOfLines={1}>
                  {label}
                </SystemText>
              ) : null}
            </View>
          ))}
        </View>
        <View style={[styles.columns, { gap }]}>
          {heatmap.weeks.map((week) => (
            <View key={week[0].dayKey} style={{ gap }}>
              {week.map((c) => (
                <HeatCellView
                  key={c.dayKey}
                  cell={c}
                  size={cell}
                  isToday={c.dayKey === today}
                  isSelected={c.dayKey === selected}
                  onSelect={onSelect}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Month label above the first week whose Monday starts a new month (skips a cramped first label). */
function monthLabels(weeks: readonly HeatCell[][]): { week: number; label: string }[] {
  const labels: { week: number; label: string }[] = [];
  let previous = -1;
  weeks.forEach((week, index) => {
    const month = monthOf(week[0].dayKey);
    if (month !== previous) labels.push({ week: index, label: MONTHS_SHORT[month] });
    previous = month;
  });
  if (labels.length > 1 && labels[0].week === 0 && labels[1].week < 3) labels.shift();
  return labels;
}

interface HeatCellViewProps {
  cell: HeatCell;
  size: number;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (dayKey: DayKey) => void;
}

const HeatCellView = memo(function HeatCellView({ cell, size, isToday, isSelected, onSelect }: HeatCellViewProps) {
  if (cell.future) {
    return <View style={[styles.cell, styles.futureCell, { width: size, height: size }]} />;
  }
  const fill = cell.level === 0 && cell.rest ? REST_FILL : LEVEL_FILL[cell.level];
  const dot = Math.max(3, Math.round(size * 0.34));
  return (
    <Pressable
      onPress={() => onSelect(cell.dayKey)}
      hitSlop={1}
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDay(cell.dayKey)}, ${cell.value} XP`}
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.cell,
        { width: size, height: size, backgroundColor: fill },
        cell.level === 4 && styles.topCell,
        cell.rest && styles.restCell,
        isToday && !cell.rest && styles.todayCell,
        isSelected && styles.selectedCell,
      ]}
    >
      {cell.questDone ? <View style={[styles.questDot, { width: dot, height: dot, borderRadius: dot / 2 }]} /> : null}
    </Pressable>
  );
});

function InfoLine({ cell, restKind }: { cell: HeatCell | null; restKind: RestDayKind | undefined }) {
  if (!cell) {
    return (
      <View style={styles.info}>
        <SystemText variant="caption" tone="muted">
          › Detay için bir güne dokun.
        </SystemText>
      </View>
    );
  }
  return (
    <View style={[styles.info, styles.infoActive]} accessibilityLiveRegion="polite">
      <SystemText variant="bodyStrong" numberOfLines={1}>
        {formatLongDay(cell.dayKey)}
      </SystemText>
      <View style={styles.infoTags}>
        <SystemText variant="mono" tone={cell.value > 0 ? 'neon' : 'muted'}>
          {`${formatNumber(cell.value)} XP`}
        </SystemText>
        {cell.questDone ? (
          <SystemText variant="label" tone="gold">
            · GÜNLÜK GÖREV ✓
          </SystemText>
        ) : null}
        {cell.rest ? (
          <SystemText variant="label" style={styles.restText}>
            {`· ${REST_KIND_LABELS[restKind ?? 'rest'].toLocaleUpperCase('tr-TR')}`}
          </SystemText>
        ) : null}
        {!cell.questDone && !cell.rest && cell.value === 0 ? (
          <SystemText variant="label" tone="muted">
            · KAYIT YOK
          </SystemText>
        ) : null}
      </View>
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendGroup}>
        <SystemText variant="caption" tone="muted">
          Az
        </SystemText>
        {LEVEL_FILL.map((fill, level) => (
          <View key={`level-${level}`} style={[styles.legendCell, { backgroundColor: fill }, level === 4 && styles.topCell]} />
        ))}
        <SystemText variant="caption" tone="muted">
          Çok
        </SystemText>
      </View>
      <View style={styles.legendGroup}>
        <View style={[styles.legendCell, { backgroundColor: REST_FILL }, styles.restCell]} />
        <SystemText variant="caption" tone="muted">
          Dinlenme
        </SystemText>
        <View style={[styles.legendCell, styles.legendQuestCell, { backgroundColor: LEVEL_FILL[0] }]}>
          <View style={[styles.questDot, styles.legendDot]} />
        </View>
        <SystemText variant="caption" tone="muted">
          Görev
        </SystemText>
      </View>
    </View>
  );
}

function Total({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.total}>
      <SystemText variant="label" tone="muted">
        {label}
      </SystemText>
      <SystemText variant="mono" tone={gold ? 'gold' : 'neon'}>
        {value}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { width: '100%' },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  monthRow: { height: MONTH_ROW_HEIGHT, position: 'relative' },
  monthLabel: { position: 'absolute', top: 0, fontSize: 10, lineHeight: 12, letterSpacing: 0.5 },
  gridRow: { flexDirection: 'row' },
  dayLabels: { width: DAY_LABEL_WIDTH },
  dayLabelCell: { justifyContent: 'center' },
  dayLabel: { fontSize: 9, lineHeight: 11 },
  columns: { flexDirection: 'row' },
  cell: {
    borderRadius: radii.sm / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  futureCell: { borderWidth: 1, borderColor: colors.neonFaint, borderStyle: 'dashed', opacity: 0.4 },
  topCell: { boxShadow: `0 0 6px ${colors.neon}` },
  restCell: { borderWidth: 1.5, borderColor: colors.purple },
  todayCell: { borderWidth: 1, borderColor: colors.neonBright },
  selectedCell: { borderWidth: 2, borderColor: colors.text, boxShadow: `0 0 8px ${colors.neonBright}` },
  questDot: { backgroundColor: colors.gold, boxShadow: `0 0 4px ${colors.gold}` },
  info: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.backgroundAlt,
    gap: spacing.xxs,
  },
  infoActive: { borderColor: colors.neonDim },
  infoTags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs },
  restText: { color: colors.purple },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, columnGap: spacing.md },
  legendGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendCell: { width: 11, height: 11, borderRadius: radii.sm / 2 },
  legendQuestCell: { marginLeft: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  legendDot: { width: 4, height: 4, borderRadius: 2 },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.neonFaint,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  total: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  totalDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.neonFaint },
});
