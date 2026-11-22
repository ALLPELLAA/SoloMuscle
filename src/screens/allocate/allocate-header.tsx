import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { colors, glow, radii, spacing } from '@/theme';

export interface AllocateHeaderProps {
  onBack: () => void;
}

/** Back button + `STAT PUANI DAĞITIMI` title. */
export function AllocateHeader({ onBack }: AllocateHeaderProps) {
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Geri"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.neon} />
      </Pressable>
      <View style={styles.titles}>
        <SystemText variant="title" tone="neon" glow numberOfLines={1} adjustsFontSizeToFit>
          STAT PUANI DAĞITIMI
        </SystemText>
        <SystemText variant="caption" tone="secondary">
          [SİSTEM] Gücünü nereye yönlendireceğini seç.
        </SystemText>
      </View>
      <Ionicons name="options-outline" size={22} color={colors.neonDim} />
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
