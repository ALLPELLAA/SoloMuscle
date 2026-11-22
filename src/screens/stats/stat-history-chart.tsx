import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { StatSnapshot } from '@/db/mappers';
import { STAT_KEYS, STAT_LABELS, diffDays, type StatKey } from '@/game';
import { colors, radii, spacing, statColors } from '@/theme';

import { formatShortDay, withAlpha } from './stats-format';

export interface StatHistoryChartProps {
  /** Daily snapshots, oldest first. */
  snapshots: readonly StatSnapshot[];
}

const HEIGHT = 184;
const PAD_LEFT = 30;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const INNER = 6;
const X_LABEL_WIDTH = 56;

type Visibility = Record<StatKey, boolean>;

const ALL_VISIBLE: Visibility = { strength: true, endurance: true, agility: true, vitality: true, flexibility: true };

/** Line chart of the daily stat snapshots with per-stat toggle chips (docs §14). */
export function StatHistoryChart({ snapshots }: StatHistoryChartProps) {
  const [visible, setVisible] = useState<Visibility>(ALL_VISIBLE);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  const toggle = (key: StatKey) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const enough = snapshots.length >= 2;
  // Selection is an index into the current list; drop it if the list shrank.
  const selected = selectedIndex !== null && selectedIndex < snapshots.length ? snapshots[selectedIndex] : null;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  return (
    <SystemWindow
      title="Stat Geçmişi"
      headerRight={
        <SystemText variant="label" tone="muted">
          {`${snapshots.length} GÜN`}
        </SystemText>
      }
    >
      {enough ? (
        <>
          {/* Own key: never reuse the empty-state View, or onLayout may never fire (web). */}
          <View key="chart" onLayout={onLayout} style={styles.measure}>
            {width > 0 ? (
              <LineChart
                width={width}
                snapshots={snapshots}
                visible={visible}
                selectedIndex={selected ? selectedIndex : null}
                onSelect={setSelectedIndex}
              />
            ) : (
              <View style={{ height: HEIGHT }} />
            )}
          </View>
          <View style={styles.chips}>
            {STAT_KEYS.map((key) => (
              <StatChip
                key={key}
                stat={key}
                active={visible[key]}
                detail={chipDetail(key, first, last, selected)}
                onPress={() => toggle(key)}
              />
            ))}
          </View>
          <SystemText variant="caption" tone="muted">
            {selected
              ? `› ${formatShortDay(selected.dayKey)} seçili · Lv ${selected.level} — değerler o güne ait.`
              : '› Değişim ilk kayıttan bu yana. Bir güne bakmak için grafiğe dokun.'}
          </SystemText>
        </>
      ) : (
        <View key="empty" style={styles.empty}>
          <Ionicons name="analytics-outline" size={32} color={colors.neonDim} />
          <SystemText variant="bodyStrong" tone="secondary" align="center">
            Grafik için en az 2 günlük veri gerekir
          </SystemText>
          <SystemText variant="caption" tone="muted" align="center">
            Statların her gün kaydedilir. Yarın tekrar uğra, gelişim çizgin burada belirecek.
          </SystemText>
        </View>
      )}
    </SystemWindow>
  );
}

function chipDetail(key: StatKey, first: StatSnapshot | undefined, last: StatSnapshot | undefined, selected: StatSnapshot | null) {
  if (selected) return { text: String(selected.stats[key]), tone: 'default' as const };
  if (!first || !last) return { text: '', tone: 'muted' as const };
  const delta = last.stats[key] - first.stats[key];
  if (delta > 0) return { text: `+${delta}`, tone: 'success' as const };
  if (delta < 0) return { text: String(delta), tone: 'danger' as const };
  return { text: '±0', tone: 'muted' as const };
}

interface LineChartProps {
  width: number;
  snapshots: readonly StatSnapshot[];
  visible: Visibility;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

function LineChart({ width, snapshots, visible, selectedIndex, onSelect }: LineChartProps) {
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const span = Math.max(1, diffDays(first.dayKey, last.dayKey));
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const activeKeys = STAT_KEYS.filter((key) => visible[key]);

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const snapshot of snapshots) {
    for (const key of activeKeys) {
      yMin = Math.min(yMin, snapshot.stats[key]);
      yMax = Math.max(yMax, snapshot.stats[key]);
    }
  }
  if (!Number.isFinite(yMin)) {
    yMin = 0;
    yMax = 1;
  }
  if (yMin === yMax) {
    yMin = Math.max(0, yMin - 1);
    yMax += 1;
  }

  const xOf = (dayKey: string) => PAD_LEFT + (diffDays(first.dayKey, dayKey) / span) * plotW;
  const yOf = (value: number) => PAD_TOP + INNER + (1 - (value - yMin) / (yMax - yMin)) * (plotH - 2 * INNER);
  const showDots = snapshots.length <= 14;

  const midIndex = Math.floor((snapshots.length - 1) / 2);
  const xLabels = [0, snapshots.length - 1];
  if (snapshots.length >= 5 && span >= 6) xLabels.splice(1, 0, midIndex);

  const onPress = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    if (typeof x !== 'number' || !Number.isFinite(x)) return;
    let best = 0;
    let bestDistance = Infinity;
    snapshots.forEach((snapshot, index) => {
      const distance = Math.abs(xOf(snapshot.dayKey) - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    void Haptics.selectionAsync().catch(() => undefined);
    onSelect(best === selectedIndex ? null : best);
  };

  const selected = selectedIndex !== null ? snapshots[selectedIndex] : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Stat geçmişi grafiği"
      accessibilityHint="Bir güne dokunarak o günün stat değerlerini gör"
      style={{ width, height: HEIGHT }}
    >
      <Svg width={width} height={HEIGHT} pointerEvents="none">
        {[0, 0.5, 1].map((f) => {
          const y = PAD_TOP + INNER + f * (plotH - 2 * INNER);
          return (
            <Line
              key={f}
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke={f === 1 ? colors.neonDim : colors.neonFaint}
              strokeWidth={1}
              strokeDasharray={f === 1 ? undefined : '3 4'}
            />
          );
        })}
        <Line x1={PAD_LEFT} x2={PAD_LEFT} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke={colors.neonDim} strokeWidth={1} />

        {selected ? (
          <Line
            x1={xOf(selected.dayKey)}
            x2={xOf(selected.dayKey)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke={colors.neonBright}
            strokeOpacity={0.6}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ) : null}

        {activeKeys.map((key) => {
          const points = snapshots.map((s) => `${xOf(s.dayKey).toFixed(1)},${yOf(s.stats[key]).toFixed(1)}`).join(' ');
          return (
            <Polyline
              key={`glow-${key}`}
              points={points}
              fill="none"
              stroke={statColors[key]}
              strokeOpacity={0.18}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {activeKeys.map((key) => {
          const points = snapshots.map((s) => `${xOf(s.dayKey).toFixed(1)},${yOf(s.stats[key]).toFixed(1)}`).join(' ');
          return (
            <Polyline
              key={`line-${key}`}
              points={points}
              fill="none"
              stroke={statColors[key]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {showDots
          ? activeKeys.flatMap((key) =>
              snapshots.map((s) => (
                <Circle key={`dot-${key}-${s.dayKey}`} cx={xOf(s.dayKey)} cy={yOf(s.stats[key])} r={2.2} fill={statColors[key]} />
              )),
            )
          : null}
        {activeKeys.map((key) => {
          const point = selected ?? last;
          return (
            <Circle
              key={`end-${key}`}
              cx={xOf(point.dayKey)}
              cy={yOf(point.stats[key])}
              r={4}
              fill={statColors[key]}
              stroke={colors.background}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>

      <SystemText variant="caption" tone="secondary" style={[styles.yLabel, { top: PAD_TOP + INNER - 8 }]}>
        {String(yMax)}
      </SystemText>
      <SystemText variant="caption" tone="secondary" style={[styles.yLabel, { top: PAD_TOP + plotH - INNER - 8 }]}>
        {String(yMin)}
      </SystemText>
      {xLabels.map((index, i) => {
        const x = xOf(snapshots[index].dayKey);
        const align = i === 0 ? 'left' : i === xLabels.length - 1 ? 'right' : 'center';
        const left = align === 'left' ? x - 4 : align === 'right' ? x - X_LABEL_WIDTH + 4 : x - X_LABEL_WIDTH / 2;
        return (
          <SystemText
            key={snapshots[index].dayKey}
            variant="caption"
            tone="muted"
            align={align}
            numberOfLines={1}
            style={[styles.xLabel, { left, top: HEIGHT - PAD_BOTTOM + 6 }]}
          >
            {formatShortDay(snapshots[index].dayKey)}
          </SystemText>
        );
      })}
    </Pressable>
  );
}

interface StatChipProps {
  stat: StatKey;
  active: boolean;
  detail: { text: string; tone: 'default' | 'success' | 'danger' | 'muted' };
  onPress: () => void;
}

function StatChip({ stat, active, detail, onPress }: StatChipProps) {
  const color = statColors[stat];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={STAT_LABELS[stat]}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { borderColor: withAlpha(color, 0.7), backgroundColor: withAlpha(color, pressed ? 0.24 : 0.12) }
          : [styles.chipInactive, pressed && styles.chipInactivePressed],
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: active ? color : colors.textMuted }, active && { boxShadow: `0 0 6px ${color}` }]} />
      <SystemText variant="label" style={[styles.chipLabel, { color: active ? colors.text : colors.textMuted }]}>
        {STAT_LABELS[stat].toLocaleUpperCase('tr-TR')}
      </SystemText>
      {active && detail.text ? (
        <SystemText variant="caption" tone={detail.tone} style={styles.chipDetail}>
          {detail.text}
        </SystemText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  measure: { width: '100%' },
  yLabel: { position: 'absolute', left: 0, width: PAD_LEFT - 6, textAlign: 'right', fontSize: 11, lineHeight: 16 },
  xLabel: { position: 'absolute', width: X_LABEL_WIDTH, fontSize: 11, lineHeight: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipInactive: { borderColor: colors.neonFaint, backgroundColor: 'transparent' },
  chipInactivePressed: { backgroundColor: colors.neonFaint },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { fontSize: 11, letterSpacing: 1 },
  chipDetail: { fontWeight: '700' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
});
