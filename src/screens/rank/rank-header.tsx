import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { colors, glow, radii, spacing } from '@/theme';

import type { IconName } from './rank-copy';

export interface RankHeaderProps {
  title: string;
  caption: string;
  icon: IconName;
  /** Shows a back button when given (stack screens). */
  onBack?: () => void;
}

/** Screen title row used by the rank tab and the rank exam. */
export function RankHeader({ title, caption, icon, onBack }: RankHeaderProps) {
  return (
    <View style={styles.root}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.neon} />
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <SystemText variant="title" tone="neon" glow accessibilityRole="header">
          {title.toLocaleUpperCase('tr-TR')}
        </SystemText>
        <SystemText variant="caption" tone="secondary">
          {caption}
        </SystemText>
      </View>
      <Ionicons name={icon} size={22} color={colors.neonDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: colors.neonFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { backgroundColor: colors.neonDim, boxShadow: glow.neonSoft },
  titles: { flex: 1, gap: spacing.xxs },
});
