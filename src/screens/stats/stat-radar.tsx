import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { STAT_KEYS, STAT_LABELS, sumStats, type StatKey, type Stats } from '@/game';
import { colors, spacing, statColors } from '@/theme';

export interface StatRadarProps {
  stats: Stats;
}

const RINGS = [0.25, 0.5, 0.75, 1] as const;
const SIDE_LABEL = 92;
const MID_LABEL = 96;
const LABEL_GAP = 8;
const TOP_SPACE = 40;
const BOTTOM_SPACE = 44;
const MARGIN = 10;
const MIN_RADIUS = 56;
const MAX_RADIUS = 120;
const COS_18 = Math.cos(Math.PI / 10);
const COS_36 = Math.cos(Math.PI / 5);

/** Outer ring value: next round ten above the best stat, with some headroom (min 20). */
function radarScale(stats: Stats): number {
  const best = Math.max(...STAT_KEYS.map((key) => stats[key]));
  let scale = Math.ceil(best / 10) * 10;
  if (scale - best < 2) scale += 10;
  return Math.max(20, scale);
}

interface Point {
  x: number;
  y: number;
}

function vertex(center: Point, radius: number, index: number, fraction: number): Point {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / STAT_KEYS.length;
  return { x: center.x + Math.cos(angle) * radius * fraction, y: center.y + Math.sin(angle) * radius * fraction };
}

function toPoints(points: readonly Point[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** RPG "status pentagon" of the five current stats. */
export function StatRadar({ stats }: StatRadarProps) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  const scale = radarScale(stats);

  return (
    <SystemWindow
      title="Stat Beşgeni"
      contentStyle={styles.content}
      headerRight={
        <SystemText variant="label" tone="secondary">
          {`TOPLAM ${sumStats(stats)}`}
        </SystemText>
      }
    >
      <View onLayout={onLayout} style={styles.measure}>
        {width > 0 ? <RadarChart width={width} stats={stats} scale={scale} /> : <View style={styles.placeholder} />}
      </View>
      <SystemText variant="caption" tone="muted" align="center">
        {`Dış halka = ${scale} puan · Halkalar %25 aralıklı`}
      </SystemText>
    </SystemWindow>
  );
}

function RadarChart({ width, stats, scale }: { width: number; stats: Stats; scale: number }) {
  const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, (width / 2 - SIDE_LABEL - LABEL_GAP) / COS_18));
  const height = TOP_SPACE + radius + radius * COS_36 + BOTTOM_SPACE;
  const center: Point = { x: width / 2, y: TOP_SPACE + radius };

  // The data layer lives in its own square so it can zoom in around the pentagon center.
  const box = 2 * (radius + MARGIN);
  const local: Point = { x: radius + MARGIN, y: radius + MARGIN };

  const outer = STAT_KEYS.map((_, i) => vertex(center, radius, i, 1));
  const values = STAT_KEYS.map((key, i) => vertex(local, radius, i, Math.min(1, Math.max(0.04, stats[key] / scale))));

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.get() }));

  return (
    <View style={{ width, height }} accessible accessibilityLabel={radarAccessibilityLabel(stats)}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {RINGS.map((fraction) => (
          <Polygon
            key={fraction}
            points={toPoints(STAT_KEYS.map((_, i) => vertex(center, radius, i, fraction)))}
            fill={fraction === 1 ? colors.neon : 'none'}
            fillOpacity={fraction === 1 ? 0.04 : 0}
            stroke={fraction === 1 ? colors.neonDim : colors.neonFaint}
            strokeWidth={fraction === 1 ? 1.5 : 1}
          />
        ))}
        {outer.map((p, i) => (
          <Line key={STAT_KEYS[i]} x1={center.x} y1={center.y} x2={p.x} y2={p.y} stroke={colors.neonFaint} strokeWidth={1} />
        ))}
        {outer.map((p, i) => (
          <Circle key={`tip-${STAT_KEYS[i]}`} cx={p.x} cy={p.y} r={2} fill={colors.neonDim} />
        ))}
      </Svg>

      <Animated.View
        entering={ZoomIn.duration(650)}
        style={[styles.dataLayer, { left: center.x - local.x, top: center.y - local.y, width: box, height: box }]}
        pointerEvents="none"
      >
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <Svg width={box} height={box}>
            <Polygon
              points={toPoints(values)}
              fill="none"
              stroke={colors.neon}
              strokeOpacity={0.35}
              strokeWidth={7}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
          <Polygon
            points={toPoints(values)}
            fill={colors.neon}
            fillOpacity={0.24}
            stroke={colors.neonBright}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {values.map((p, i) => (
            <Circle key={`halo-${STAT_KEYS[i]}`} cx={p.x} cy={p.y} r={7} fill={statColors[STAT_KEYS[i]]} fillOpacity={0.25} />
          ))}
          {values.map((p, i) => (
            <Circle
              key={`dot-${STAT_KEYS[i]}`}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={statColors[STAT_KEYS[i]]}
              stroke={colors.background}
              strokeWidth={1}
            />
          ))}
          <Circle cx={local.x} cy={local.y} r={2.5} fill={colors.neonBright} />
        </Svg>
      </Animated.View>

      {STAT_KEYS.map((key, i) => (
        <RadarLabel key={key} stat={key} value={stats[key]} index={i} anchor={outer[i]} />
      ))}
    </View>
  );
}

function radarAccessibilityLabel(stats: Stats): string {
  return STAT_KEYS.map((key) => `${STAT_LABELS[key]} ${stats[key]}`).join(', ');
}

/** Name + value next to a pentagon tip; placement depends on the tip's side. */
function RadarLabel({ stat, value, index, anchor }: { stat: StatKey; value: number; index: number; anchor: Point }) {
  const color = statColors[stat];
  let position: { left: number; top: number; width: number; align: 'left' | 'center' | 'right' };
  if (index === 0) {
    position = { left: anchor.x - MID_LABEL / 2, top: anchor.y - TOP_SPACE + 2, width: MID_LABEL, align: 'center' };
  } else if (index === 1) {
    position = { left: anchor.x + LABEL_GAP, top: anchor.y - 16, width: SIDE_LABEL, align: 'left' };
  } else if (index === STAT_KEYS.length - 1) {
    position = { left: anchor.x - LABEL_GAP - SIDE_LABEL, top: anchor.y - 16, width: SIDE_LABEL, align: 'right' };
  } else {
    position = { left: anchor.x - MID_LABEL / 2, top: anchor.y + LABEL_GAP, width: MID_LABEL, align: 'center' };
  }
  return (
    <View pointerEvents="none" style={[styles.label, { left: position.left, top: position.top, width: position.width }]}>
      <SystemText variant="label" tone="secondary" align={position.align} numberOfLines={1} style={styles.labelName}>
        {STAT_LABELS[stat].toLocaleUpperCase('tr-TR')}
      </SystemText>
      <SystemText
        variant="mono"
        align={position.align}
        style={[styles.labelValue, { color, textShadowColor: color }]}
      >
        {String(value)}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, gap: spacing.sm },
  measure: { width: '100%' },
  placeholder: { height: 240 },
  dataLayer: { position: 'absolute' },
  label: { position: 'absolute', gap: 0 },
  labelName: { fontSize: 10, letterSpacing: 0.4 },
  labelValue: { fontSize: 16, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
});
