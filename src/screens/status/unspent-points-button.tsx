import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { colors, radii, spacing, toneColors } from '@/theme';

import { usePulse } from './use-pulse';

export interface UnspentPointsButtonProps {
  points: number;
  onPress: () => void;
}

const gold = toneColors.gold;

/** Gold, softly pulsing call to action: "N STAT PUANI DAĞITILMAYI BEKLİYOR". */
export function UnspentPointsButton({ points, onPress }: UnspentPointsButtonProps) {
  const pulse = usePulse(1100);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * pulse.get() }));

  const handlePress = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${points} stat puanı dağıtılmayı bekliyor`}
      accessibilityHint="Stat puanı dağıtma ekranını açar"
      onPress={handlePress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Ionicons name="add-circle" size={30} color={colors.gold} />
      <View style={styles.texts}>
        <SystemText variant="title" tone="gold" glow>
          {`${points} STAT PUANI`}
        </SystemText>
        <SystemText variant="label" tone="gold">
          DAĞITILMAYI BEKLİYOR
        </SystemText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: gold.main,
    backgroundColor: gold.faint,
  },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.sm,
    boxShadow: gold.glow,
  },
  pressed: { backgroundColor: gold.dim, transform: [{ scale: 0.99 }] },
  texts: { flex: 1, gap: spacing.xxs },
});
