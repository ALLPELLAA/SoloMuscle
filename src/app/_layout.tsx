import {
  DarkTheme,
  Stack,
  ThemeProvider,
  usePathname,
  useRouter,
  type ErrorBoundaryProps,
  type Theme,
} from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { SystemErrorView } from '@/components/system-error-view';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { GameProvider, useGame } from '@/state/game-provider';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.neon,
    background: colors.background,
    card: colors.backgroundAlt,
    text: colors.text,
    border: colors.neonFaint,
    notification: colors.danger,
  },
};

/** Render errors anywhere below the root: themed Turkish error screen instead of a crash. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <SystemErrorView message="Beklenmeyen bir hata oluştu." detail={error.message} onRetry={retry} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Opening/migrating the database can fail (e.g. a downgrade): show it instead of crashing.
  const [dbError, setDbError] = useState<Error | null>(null);
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      {dbError ? (
        <SystemErrorView message="Veriler yüklenemedi." detail={dbError.message} />
      ) : (
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} onError={setDbError}>
          <GameProvider>
            <RootNavigator />
          </GameProvider>
        </SQLiteProvider>
      )}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useGame();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="level-up"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            gestureEnabled: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="boss"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            gestureEnabled: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="allocate" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="rank-exam" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <SystemEventWatcher />
    </>
  );
}

/**
 * Opens system popups in order: defeated bosses first (one per visit to /boss),
 * then the LEVEL UP window. Each popup acknowledges its event and closes itself.
 */
function SystemEventWatcher() {
  const { pendingLevelUp, pendingBoss, status } = useGame();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status !== 'ready') return;
    if (pathname === '/boss' || pathname === '/level-up') return;
    if (pendingBoss) router.push('/boss');
    else if (pendingLevelUp) router.push('/level-up');
  }, [pathname, pendingBoss, pendingLevelUp, router, status]);
  return null;
}
