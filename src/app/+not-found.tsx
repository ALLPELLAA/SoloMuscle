import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, spacing } from '@/theme';

/** Unknown route / deep link: themed Turkish fallback instead of the default English page. */
export default function NotFoundScreen() {
  return (
    <View style={styles.root}>
      <SystemWindow title="Bilinmeyen Bölge" tone="danger" emphasized>
        <SystemText variant="bodyStrong">[SİSTEM] Bu konum haritada yok.</SystemText>
        <SystemText variant="caption" tone="secondary">
          Aradığın ekran bulunamadı. Ana ekrana dönerek devam edebilirsin.
        </SystemText>
        <SystemButton label="Ana Ekrana Dön" variant="solid" onPress={() => router.replace('/')} />
      </SystemWindow>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
});
