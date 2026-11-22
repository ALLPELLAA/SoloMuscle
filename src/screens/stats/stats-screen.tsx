import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SystemText } from '@/components/system-text';
import { EXERCISE_IDS, HEATMAP_WEEKS, type DayKey, type RestDayKind } from '@/game';
import { useGame } from '@/state/game-provider';
import { useActivityHeatmap, useRecordLogs, useStatSnapshots } from '@/state/use-history';
import { colors, spacing } from '@/theme';

import { ActivityHeatmap } from './activity-heatmap';
import { BossLogWindow, RecordsWindow } from './records-window';
import { StatHistoryChart } from './stat-history-chart';
import { StatRadar } from './stat-radar';
import { SummaryRow } from './summary-row';

/** "İstatistik" tab: streak, activity map, stat charts and personal records (docs §14). */
export function StatsScreen() {
  const { state, today } = useGame();
  const heatmap = useActivityHeatmap(HEATMAP_WEEKS);
  const snapshots = useStatSnapshots(60);
  const recordLogs = useRecordLogs(10);

  const restDays = state?.restDays;
  const restKinds = useMemo(() => {
    const kinds: Record<DayKey, RestDayKind> = {};
    for (const day of restDays ?? []) kinds[day.dayKey] = day.kind;
    return kinds;
  }, [restDays]);

  if (!state) {
    return (
      <Screen contentStyle={styles.loading}>
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      </Screen>
    );
  }

  const { player } = state;
  const recordCount = EXERCISE_IDS.filter((id) => player.records[id] !== undefined).length;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titles}>
          <SystemText variant="title" tone="neon" glow accessibilityRole="header">
            İSTATİSTİK
          </SystemText>
          <SystemText variant="caption" tone="secondary">
            Oyuncu kayıtları · gelişim analizi
          </SystemText>
        </View>
        <Ionicons name="stats-chart" size={22} color={colors.neonDim} />
      </View>

      <SummaryRow
        streakCurrent={player.streak.current}
        streakBest={player.streak.best}
        level={player.level}
        totalXp={player.totalXp}
        activeDays={heatmap ? heatmap.activeDays : null}
        heatmapWeeks={HEATMAP_WEEKS}
        recordCount={recordCount}
      />
      <ActivityHeatmap heatmap={heatmap} weeks={HEATMAP_WEEKS} today={today} restKinds={restKinds} />
      <StatRadar stats={player.stats} />
      <StatHistoryChart snapshots={snapshots} />
      <RecordsWindow records={player.records} />
      <BossLogWindow logs={recordLogs} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xxs },
});
