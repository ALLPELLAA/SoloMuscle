import { DarkTheme, Stack, ThemeProvider, useRouter, type Theme } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <GameProvider>
          <RootNavigator />
        </GameProvider>
      </SQLiteProvider>
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
        <Stack.Screen name="allocate" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="rank-exam" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <LevelUpWatcher />
    </>
  );
}

/** Opens the LEVEL UP window whenever the game reports a level gain. */
function LevelUpWatcher() {
  const { pendingLevelUp, status } = useGame();
  const router = useRouter();
  useEffect(() => {
    if (status === 'ready' && pendingLevelUp) router.push('/level-up');
  }, [pendingLevelUp, router, status]);
  return null;
}
