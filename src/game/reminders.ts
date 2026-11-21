/** Pure planning of local reminder notifications (docs/GAME_DESIGN.md §8). */

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: true, hour: 19, minute: 0 };
export const REMINDER_DAYS_AHEAD = 7;

export const REMINDER_TEXT = {
  normal: {
    title: '[SİSTEM] Günlük Görev',
    body: 'Günlük görevin seni bekliyor. Tamamlanmazsa Ceza Görevi açılacak.',
  },
  penalty: {
    title: '[SİSTEM] CEZA GÖREVİ AKTİF',
    body: 'Ceza görevini tamamlamadan XP kazanamazsın.',
  },
} as const;

export interface PlannedReminder {
  /** Epoch milliseconds (local wall-clock time hour:minute). */
  at: number;
  title: string;
  body: string;
}

export interface ReminderPlanInput {
  now: number;
  settings: ReminderSettings;
  todayQuestDone: boolean;
  penaltyActive: boolean;
  days?: number;
}

export function isValidReminderTime(hour: number, minute: number): boolean {
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function buildReminderPlan(input: ReminderPlanInput): PlannedReminder[] {
  const { now, settings, todayQuestDone, penaltyActive } = input;
  const days = input.days ?? REMINDER_DAYS_AHEAD;
  if (!settings.enabled || !isValidReminderTime(settings.hour, settings.minute)) return [];

  const base = new Date(now);
  const plan: PlannedReminder[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, settings.hour, settings.minute).getTime();
    if (at <= now) continue;
    if (i === 0) {
      if (penaltyActive) {
        plan.push({ at, ...REMINDER_TEXT.penalty });
        continue;
      }
      if (todayQuestDone) continue;
    }
    plan.push({ at, ...REMINDER_TEXT.normal });
  }
  return plan;
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
