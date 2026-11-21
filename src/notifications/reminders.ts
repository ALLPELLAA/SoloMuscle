/**
 * expo-notifications wrapper: local daily-quest reminders only (no push).
 * What to schedule is decided by the pure `buildReminderPlan` in src/game.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from '@/game';

export const REMINDER_CHANNEL_ID = 'daily-quest';
const REMINDER_DATA_TAG = 'solomuscle-reminder';

let configured = false;

/** Foreground presentation + Android channel. Safe to call repeatedly. */
export async function configureNotifications(): Promise<void> {
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Günlük görev hatırlatması',
      description: 'Günlük görev ve ceza görevi hatırlatmaları',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#3AB4FF',
    });
  }
}

/** Local notifications are only supported on native platforms (web preview: no-op). */
const SUPPORTED = Platform.OS !== 'web';

export async function hasNotificationPermission(): Promise<boolean> {
  if (!SUPPORTED) return false;
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

/** Asks for permission if not yet decided. Returns whether notifications are allowed. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!SUPPORTED) return false;
  try {
    await configureNotifications();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('[notifications] permission request failed', error);
    return false;
  }
}

async function cancelOurReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === REMINDER_DATA_TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Replaces all scheduled reminders with `plan`. Never throws: notification
 * failures must not break the game (returns false instead).
 */
export async function syncReminders(plan: PlannedReminder[]): Promise<boolean> {
  if (!SUPPORTED) return false;
  try {
    await configureNotifications();
    await cancelOurReminders();
    if (plan.length === 0) return true;
    if (!(await hasNotificationPermission())) return false;
    for (const reminder of plan) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { tag: REMINDER_DATA_TAG },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
    }
    return true;
  } catch (error) {
    console.warn('[notifications] syncReminders failed', error);
    return false;
  }
}
