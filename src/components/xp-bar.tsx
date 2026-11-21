import { StyleSheet, View } from 'react-native';

import { levelProgress, xpToNextLevel, type Player } from '@/game';
import { colors, spacing } from '@/theme';

import { ProgressBar } from './progress-bar';
import { SystemText } from './system-text';

export interface XpBarProps {
  player: Pick<Player, 'level' | 'xp'>;
  locked?: boolean;
}

/** Level XP bar: `XP 120 / 283`. Red when XP is locked by a penalty quest. */
export function XpBar({ player, locked = false }: XpBarProps) {
  const need = xpToNextLevel(player.level);
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <SystemText variant="label" tone={locked ? 'danger' : 'neon'}>
          {locked ? 'XP KİLİTLİ' : 'XP'}
        </SystemText>
        <SystemText variant="mono" tone="secondary">{`${player.xp} / ${need}`}</SystemText>
      </View>
      <ProgressBar
        progress={levelProgress(player)}
        color={locked ? colors.danger : colors.neon}
        height={8}
        accessibilityLabel={`Level ilerlemesi ${player.xp} / ${need}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
