import { StyleSheet, View } from 'react-native';

import { StatBar } from '@/components/stat-bar';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { STAT_KEYS, sumStats, type Player } from '@/game';
import { colors, spacing } from '@/theme';

import { UnspentPointsButton } from './unspent-points-button';

export interface StatsWindowProps {
  player: Player;
  onAllocate: () => void;
}

/** The five stats with their training progress bars. */
export function StatsWindow({ player, onAllocate }: StatsWindowProps) {
  return (
    <SystemWindow
      title="Statlar"
      headerRight={
        <SystemText variant="label" tone="secondary">
          {`TOPLAM ${sumStats(player.stats)}`}
        </SystemText>
      }
    >
      {player.unspentPoints > 0 ? <UnspentPointsButton points={player.unspentPoints} onPress={onAllocate} /> : null}
      <View style={styles.bars}>
        {STAT_KEYS.map((key, index) => (
          <View key={key} style={[styles.stat, index > 0 && styles.divided]}>
            <StatBar stat={key} value={player.stats[key]} statXp={player.statXp[key]} />
          </View>
        ))}
      </View>
      <SystemText variant="caption" tone="muted">
        Kaydettiğin her egzersiz ilgili stata antrenman XP&apos;si verir. Bar dolduğunda stat +1 artar.
      </SystemText>
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  bars: { gap: spacing.sm },
  stat: { paddingTop: spacing.xs },
  divided: { borderTopWidth: 1, borderTopColor: colors.neonFaint, paddingTop: spacing.sm },
});
