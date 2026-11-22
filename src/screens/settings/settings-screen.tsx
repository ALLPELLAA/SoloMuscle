import { router } from 'expo-router';

import { Screen } from '@/components/screen';

import { AboutSection } from './about-section';
import { DangerZoneSection } from './danger-zone-section';
import { DevToolsSection } from './dev-tools-section';
import { ReminderSection } from './reminder-section';
import { SettingsHeader } from './settings-header';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/** Settings: daily reminder, dev clock tools, reset and about. */
export function SettingsScreen() {
  return (
    <Screen>
      <SettingsHeader onBack={goBack} />
      <ReminderSection />
      {__DEV__ ? <DevToolsSection /> : null}
      <DangerZoneSection />
      <AboutSection />
    </Screen>
  );
}
