import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useGame } from '@/state/game-provider';
import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={typeof color === 'string' ? color : colors.neon} size={size} />;
  };
}

export default function TabsLayout() {
  const { status, xpLocked } = useGame();
  if (status === 'onboarding') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.neon,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.backgroundAlt,
          borderTopColor: colors.neonDim,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.condensed, fontWeight: '700', letterSpacing: 1, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Durum', tabBarIcon: tabIcon('person-circle-outline') }} />
      <Tabs.Screen
        name="quests"
        options={{
          title: 'Görevler',
          tabBarIcon: tabIcon('list-outline'),
          tabBarBadge: xpLocked ? '!' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.text },
        }}
      />
      <Tabs.Screen name="workout" options={{ title: 'Antrenman', tabBarIcon: tabIcon('barbell-outline') }} />
      <Tabs.Screen name="rank" options={{ title: 'Rank', tabBarIcon: tabIcon('shield-half-outline') }} />
    </Tabs>
  );
}
