import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, radii, spacing } from '@/theme';

/** App name, version (from app config) and the offline-data note. */
export function AboutSection() {
  const name = Constants.expoConfig?.name ?? 'SoloMuscle';
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <SystemWindow title="Hakkında">
      <View style={styles.row}>
        <SystemText variant="label" tone="muted">
          UYGULAMA
        </SystemText>
        <SystemText variant="bodyStrong">{name}</SystemText>
      </View>
      <View style={styles.row}>
        <SystemText variant="label" tone="muted">
          SÜRÜM
        </SystemText>
        <SystemText variant="mono" tone="neon">{`v${version}`}</SystemText>
      </View>
      <View style={styles.offline}>
        <Ionicons name="cloud-offline-outline" size={20} color={colors.success} />
        <SystemText variant="caption" tone="secondary" style={styles.flex}>
          Tüm veriler cihazda saklanır, internet gerekmez.
        </SystemText>
      </View>
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.successDim,
  },
});
