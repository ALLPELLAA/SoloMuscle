import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ProgressBar } from '@/components/progress-bar';
import { RankBadge } from '@/components/rank-badge';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { nextRank, RANK_REQUIREMENTS, type Player } from '@/game';
import { RANK_TITLES } from '@/screens/status/rank-titles';
import { colors, radii, rankColors, spacing, toneColors } from '@/theme';

import { RANK_DESCRIPTIONS } from './rank-copy';
import { useBreathe } from './use-breathe';

export interface CurrentRankWindowProps {
  player: Player;
}

/** Big glowing badge, rank title + description and the level gate of the next rank. */
export function CurrentRankWindow({ player }: CurrentRankWindowProps) {
  const color = rankColors[player.rank];
  const target = nextRank(player.rank);
  const requiredLevel = target ? RANK_REQUIREMENTS[target].minLevel : null;
  const levelReady = requiredLevel !== null && player.level >= requiredLevel;

  const pulse = useBreathe(1800);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + 0.55 * pulse.get(),
    transform: [{ scale: 0.92 + 0.14 * pulse.get() }],
  }));

  return (
    <SystemWindow
      title="Mevcut Rank"
      emphasized
      headerRight={
        <SystemText variant="label" tone="secondary">
          {`LV ${player.level}`}
        </SystemText>
      }
    >
      <View style={styles.hero}>
        <View style={styles.badgeWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.halo, { borderColor: color, boxShadow: `0 0 26px ${color}` }, haloStyle]}
          />
          <RankBadge rank={player.rank} size="lg" />
        </View>
        <View style={styles.heroText}>
          <SystemText variant="label" tone="muted">
            AVCI SINIFI
          </SystemText>
          <SystemText variant="display" style={[styles.rankName, { color, textShadowColor: color }]}>
            {`${player.rank}-RANK`}
          </SystemText>
          <SystemText variant="heading">{RANK_TITLES[player.rank].toLocaleUpperCase('tr-TR')}</SystemText>
        </View>
      </View>

      <SystemText tone="secondary">{RANK_DESCRIPTIONS[player.rank]}</SystemText>

      {target && requiredLevel !== null ? (
        <View style={styles.next}>
          <View style={styles.nextRow}>
            <SystemText variant="label" tone="neon">
              {`SIRADAKİ HEDEF · ${target} RANK`}
            </SystemText>
            <SystemText variant="mono" tone={levelReady ? 'success' : 'secondary'}>
              {`LV ${Math.min(player.level, requiredLevel)}/${requiredLevel}`}
            </SystemText>
          </View>
          <ProgressBar
            progress={player.level / requiredLevel}
            color={levelReady ? colors.success : colors.neon}
            accessibilityLabel={`${target} rank için level ilerlemesi`}
          />
          <SystemText variant="caption" tone={levelReady ? 'success' : 'muted'}>
            {levelReady ? '✓ Level şartı karşılandı. Sınav eşiklerine odaklan.' : `Sınav LV ${requiredLevel}'de açılır.`}
          </SystemText>
        </View>
      ) : (
        <View style={[styles.next, styles.maxBox]}>
          <SystemText variant="label" tone="gold" glow>
            ZİRVE · EN YÜKSEK RANK
          </SystemText>
        </View>
      )}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.sm },
  badgeWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  heroText: { flex: 1, gap: spacing.xxs },
  rankName: { fontSize: 34, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
  next: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundAlt,
  },
  nextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  maxBox: { alignItems: 'center', borderColor: toneColors.gold.dim },
});
