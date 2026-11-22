import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { RankBadge } from '@/components/rank-badge';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { XpBar } from '@/components/xp-bar';
import type { Player } from '@/game';
import { colors, radii, rankColors, spacing } from '@/theme';

import { RANK_TITLES } from './rank-titles';

export interface PlayerWindowProps {
  player: Player;
  xpLocked: boolean;
}

/** Main RPG status window: name, level, rank emblem, title and XP. */
export function PlayerWindow({ player, xpLocked }: PlayerWindowProps) {
  const rankColor = rankColors[player.rank];

  return (
    <SystemWindow
      title="Durum"
      emphasized
      tone={xpLocked ? 'danger' : 'neon'}
      headerRight={
        <SystemText variant="label" tone="muted">
          OYUNCU
        </SystemText>
      }
    >
      <View style={styles.top}>
        <View style={styles.identity}>
          <SystemText variant="label" tone="secondary">
            İSİM
          </SystemText>
          <SystemText variant="title" numberOfLines={1}>
            {player.name}
          </SystemText>
          <View style={styles.levelRow}>
            <SystemText variant="heading" tone="neon">
              LEVEL
            </SystemText>
            <SystemText variant="display" tone="neon" glow accessibilityLabel={`Level ${player.level}`}>
              {String(player.level)}
            </SystemText>
          </View>
        </View>
        <View style={styles.rankBox}>
          <RankBadge rank={player.rank} size="lg" />
          <SystemText variant="label" style={{ color: rankColor }}>
            {`${player.rank} RANK`}
          </SystemText>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCell}>
          <SystemText variant="label" tone="muted">
            UNVAN
          </SystemText>
          <SystemText variant="bodyStrong" style={{ color: rankColor }} numberOfLines={1}>
            {RANK_TITLES[player.rank]}
          </SystemText>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoCell}>
          <SystemText variant="label" tone="muted">
            TOPLAM
          </SystemText>
          <SystemText variant="mono" tone="gold" numberOfLines={1}>
            {`${player.totalXp.toLocaleString('tr-TR')} XP`}
          </SystemText>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoCell} accessible accessibilityLabel={`Seri ${player.streak.current} gün`}>
          <SystemText variant="label" tone="muted">
            SERİ
          </SystemText>
          <View style={styles.streakRow}>
            <Ionicons
              name={player.streak.current > 0 ? 'flame' : 'flame-outline'}
              size={16}
              color={player.streak.current > 0 ? colors.warning : colors.textMuted}
            />
            <SystemText variant="mono" style={{ color: player.streak.current > 0 ? colors.warning : colors.textMuted }}>
              {`${player.streak.current} gün`}
            </SystemText>
          </View>
          <SystemText variant="caption" tone="muted">{`En iyi: ${player.streak.best}`}</SystemText>
        </View>
      </View>

      <XpBar player={player} locked={xpLocked} />
      {xpLocked ? (
        <SystemText variant="caption" tone="danger">
          Ceza görevi tamamlanana kadar antrenman ve görevler XP vermez.
        </SystemText>
      ) : null}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identity: { flex: 1, gap: spacing.xxs },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  rankBox: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundAlt,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  infoCell: { flex: 1, gap: spacing.xxs },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  separator: { width: 1, alignSelf: 'stretch', backgroundColor: colors.neonFaint },
});
