import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { SystemText } from '@/components/system-text';
import { dayKeyToDate, diffDays } from '@/game';
import { useGame } from '@/state/game-provider';

import { PenaltyBanner } from './penalty-banner';
import { PlayerWindow } from './player-window';
import { RestDayBanner } from './rest-day-banner';
import { RolloverNoticeWindow } from './rollover-notice-window';
import { StatsWindow } from './stats-window';
import { StatusTopBar } from './status-top-bar';
import { TodayQuestSection } from './today-quest-section';

function formatDate(dayKey: string): string {
  try {
    return dayKeyToDate(dayKey).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  } catch {
    return dayKey;
  }
}

const openQuests = () => router.push('/(tabs)/quests');

/** "Durum" tab: the RPG status window of the player. */
export function StatusScreen() {
  const { state, today, xpLocked, rolloverNotice, dismissRolloverNotice, restDayToday } = useGame();

  if (!state) {
    return (
      <Screen contentStyle={styles.loading}>
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      </Screen>
    );
  }

  const { player, dailyQuest } = state;
  const dayNumber = Math.max(1, diffDays(player.createdDay, today) + 1);

  return (
    <Screen>
      <StatusTopBar
        dateLabel={formatDate(today)}
        dayNumber={dayNumber}
        onOpenSettings={() => router.push('/settings')}
      />
      {rolloverNotice ? (
        <RolloverNoticeWindow notice={rolloverNotice} onDismiss={dismissRolloverNotice} onOpenQuests={openQuests} />
      ) : null}
      {xpLocked ? <PenaltyBanner onPress={openQuests} /> : null}
      {restDayToday ? <RestDayBanner restDay={restDayToday} onPress={openQuests} /> : null}
      <PlayerWindow player={player} xpLocked={xpLocked} />
      <StatsWindow player={player} onAllocate={() => router.push('/allocate')} />
      <TodayQuestSection quest={dailyQuest} xpLocked={xpLocked} onOpenQuests={openQuests} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, justifyContent: 'center' },
});
