import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { useGame } from '@/state/game-provider';
import { colors, spacing } from '@/theme';

/** Entry: sends the user to onboarding or the main tabs. */
export default function Index() {
  const { status, error } = useGame();

  if (status === 'onboarding') return <Redirect href="/onboarding" />;
  if (status === 'ready') return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.root}>
      {status === 'error' ? (
        <SystemWindow title="Sistem Hatası" tone="danger">
          <SystemText>Veriler yüklenemedi.</SystemText>
          <SystemText variant="caption" tone="secondary">
            {error}
          </SystemText>
        </SystemWindow>
      ) : (
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
});
