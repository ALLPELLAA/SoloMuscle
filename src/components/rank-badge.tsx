import { StyleSheet, View } from 'react-native';

import type { Rank } from '@/game';
import { colors, radii, rankColors } from '@/theme';

import { SystemText } from './system-text';

export interface RankBadgeProps {
  rank: Rank;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 32, md: 48, lg: 88 } as const;

/** Hexagon-ish rank emblem (rotated square with glowing border). */
export function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const dim = SIZES[size];
  const color = rankColors[rank];
  return (
    <View
      accessible
      accessibilityLabel={`${rank} rank`}
      style={[styles.outer, { width: dim, height: dim }]}
    >
      <View
        style={[
          styles.diamond,
          {
            width: dim * 0.72,
            height: dim * 0.72,
            borderColor: color,
            boxShadow: `0 0 ${size === 'lg' ? 22 : 10}px ${color}`,
          },
        ]}
      />
      <SystemText
        variant={size === 'lg' ? 'display' : size === 'md' ? 'title' : 'heading'}
        style={[styles.letter, { color, textShadowColor: color }]}
      >
        {rank}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  diamond: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.panelSolid,
    transform: [{ rotate: '45deg' }],
  },
  letter: { textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 }, letterSpacing: 0 },
});
