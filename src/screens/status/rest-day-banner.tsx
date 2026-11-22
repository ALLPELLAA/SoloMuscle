import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { REST_KIND_LABELS, type RestDay } from '@/game';
import { colors, radii, spacing } from '@/theme';

export interface RestDayBannerProps {
  restDay: RestDay;
  onPress: () => void;
}

/** Calm banner shown while today is marked as a rest/sick day (docs §13). */
export function RestDayBanner({ restDay, onPress }: RestDayBannerProps) {
  const label = REST_KIND_LABELS[restDay.kind].toLocaleUpperCase('tr-TR');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bugün ${REST_KIND_LABELS[restDay.kind]}. Görevler sekmesini aç.`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <Ionicons name={restDay.kind === 'sick' ? 'medkit-outline' : 'bed-outline'} size={22} color={colors.purple} />
      <View style={styles.text}>
        <SystemText variant="label" style={styles.title}>{`BUGÜN: ${label}`}</SystemText>
        <SystemText variant="caption" tone="secondary">
          Görev tamamlanmazsa ceza açılmaz, serin korunur. Hatırlatma kapalı.
        </SystemText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.purple,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
  },
  pressed: { opacity: 0.8 },
  text: { flex: 1, gap: spacing.xxs },
  title: { color: colors.purple },
});
