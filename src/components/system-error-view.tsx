import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { SystemButton } from './system-button';
import { SystemText } from './system-text';
import { SystemWindow } from './system-window';

export interface SystemErrorViewProps {
  title?: string;
  message: string;
  detail?: string | null;
  onRetry?: () => void;
}

/** Full-screen themed error ("Sistem Hatası"). Also hides the splash screen. */
export function SystemErrorView({ title = 'Sistem Hatası', message, detail, onRetry }: SystemErrorViewProps) {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={styles.root} accessibilityRole="alert">
      <SystemWindow title={title} tone="danger" emphasized>
        <SystemText variant="bodyStrong">{message}</SystemText>
        {detail ? (
          <SystemText variant="caption" tone="secondary" selectable>
            {detail}
          </SystemText>
        ) : null}
        <SystemText variant="caption" tone="muted">
          Verilerin cihazında duruyor. Uygulamayı güncelleyip yeniden açmayı dene.
        </SystemText>
        {onRetry ? <SystemButton label="Tekrar Dene" tone="danger" onPress={onRetry} /> : null}
      </SystemWindow>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
});
