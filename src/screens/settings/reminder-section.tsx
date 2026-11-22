import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { NumberStepper } from '@/components/number-stepper';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { formatTime, type ReminderSettings } from '@/game';
import { useGame } from '@/state/game-provider';
import { colors, radii, spacing } from '@/theme';

import { NeonToggle } from './neon-toggle';

type Feedback = 'saved' | 'denied' | 'error' | null;

const DENIED_TEXT =
  Platform.OS === 'web'
    ? 'Web önizlemede bildirimler desteklenmez. Hatırlatmayı denemek için uygulamayı Android cihazda aç.'
    : 'Bildirim izni reddedildi. Ayar kaydedildi ama hatırlatma gelmeyecek. Android Ayarlar → Uygulamalar → SoloMuscle → Bildirimler bölümünden izin ver.';

function sameReminder(a: ReminderSettings, b: ReminderSettings): boolean {
  return a.enabled === b.enabled && a.hour === b.hour && a.minute === b.minute;
}

/** Daily quest reminder: on/off, time (hour + minute in 5-minute steps) and save. */
export function ReminderSection() {
  const { reminder, updateReminder } = useGame();
  const [enabled, setEnabled] = useState(reminder.enabled);
  const [hour, setHour] = useState(reminder.hour);
  const [minute, setMinute] = useState(reminder.minute);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // The saved setting the form was last synced to. When the stored reminder changes (e.g. it
  // finished loading after this screen mounted) and the user has no unsaved edits, adopt it.
  const [base, setBase] = useState<ReminderSettings>(reminder);
  if (!sameReminder(base, reminder)) {
    setBase(reminder);
    if (sameReminder(base, { enabled, hour, minute })) {
      setEnabled(reminder.enabled);
      setHour(reminder.hour);
      setMinute(reminder.minute);
    }
  }

  const dirty = enabled !== reminder.enabled || hour !== reminder.hour || minute !== reminder.minute;
  const scheduleText = reminder.enabled ? `Her gün ${formatTime(reminder.hour, reminder.minute)}` : 'Kapalı';

  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setFeedback(null);
    };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateReminder({ enabled, hour, minute });
      setFeedback(result.permissionGranted ? 'saved' : 'denied');
      void Haptics.notificationAsync(
        result.permissionGranted ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => undefined);
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SystemWindow
      title="Günlük Hatırlatma"
      headerRight={
        <SystemText variant="label" tone={reminder.enabled ? 'success' : 'muted'}>
          {reminder.enabled ? 'AKTİF' : 'KAPALI'}
        </SystemText>
      }
    >
      <View style={styles.scheduleRow}>
        <Ionicons name="alarm-outline" size={18} color={colors.neon} />
        <SystemText variant="label" tone="secondary">
          MEVCUT PLAN
        </SystemText>
        <SystemText variant="mono" tone={reminder.enabled ? 'neon' : 'muted'} style={styles.flex} align="right">
          {scheduleText}
        </SystemText>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.flex}>
          <SystemText variant="bodyStrong">Hatırlatma bildirimi</SystemText>
          <SystemText variant="caption" tone="secondary">
            Günlük görev bitmediyse seçtiğin saatte sistem seni uyarır.
          </SystemText>
        </View>
        <NeonToggle value={enabled} onValueChange={edit(setEnabled)} accessibilityLabel="Günlük hatırlatma" />
      </View>

      <View style={[styles.timeBlock, !enabled && styles.inactive]} pointerEvents={enabled ? 'auto' : 'none'}>
        <View style={styles.clock}>
          <SystemText variant="display" tone={enabled ? 'neon' : 'muted'} glow={enabled} align="center">
            {formatTime(hour, minute)}
          </SystemText>
        </View>
        <NumberStepper label="Saat" value={hour} onChange={edit(setHour)} min={0} max={23} step={1} />
        <NumberStepper label="Dakika" value={minute} onChange={edit(setMinute)} min={0} max={55} step={5} />
      </View>

      {dirty ? (
        <SystemText variant="caption" tone="gold">
          Kaydedilmemiş değişiklik var.
        </SystemText>
      ) : null}

      <SystemButton label="Kaydet" variant="solid" loading={saving} onPress={() => void save()} />

      {feedback === 'saved' ? (
        <Animated.View entering={FadeIn.duration(250)} style={styles.feedbackRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <SystemText variant="caption" tone="success" style={styles.flex}>
            {enabled ? `Kaydedildi. Hatırlatma her gün ${formatTime(hour, minute)}.` : 'Kaydedildi. Hatırlatma kapatıldı.'}
          </SystemText>
        </Animated.View>
      ) : null}

      {feedback === 'denied' ? (
        <Animated.View entering={FadeIn.duration(250)}>
          <SystemWindow title="Bildirim İzni Yok" tone="danger" contentStyle={styles.warningContent}>
            <View style={styles.feedbackRow}>
              <Ionicons name="notifications-off-outline" size={18} color={colors.danger} />
              <SystemText variant="caption" tone="secondary" style={styles.flex}>
                {DENIED_TEXT}
              </SystemText>
            </View>
            {Platform.OS === 'web' ? null : (
              <SystemButton
                label="Uygulama Ayarlarını Aç"
                tone="danger"
                size="sm"
                onPress={() => void Linking.openSettings().catch(() => undefined)}
              />
            )}
          </SystemWindow>
        </Animated.View>
      ) : null}

      {feedback === 'error' ? (
        <SystemText variant="caption" tone="danger">
          Kaydedilemedi. Lütfen tekrar dene.
        </SystemText>
      ) : null}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.backgroundAlt,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeBlock: { gap: spacing.md },
  inactive: { opacity: 0.35 },
  clock: {
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: colors.panelSolid,
  },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  warningContent: { padding: spacing.md, gap: spacing.sm },
});
