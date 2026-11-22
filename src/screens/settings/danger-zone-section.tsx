import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { useGame } from '@/state/game-provider';
import { colors, spacing } from '@/theme';

/** "İlerlemeyi Sıfırla" with an in-app confirmation window (works on web too). */
export function DangerZoneSection() {
  const { resetProgress } = useGame();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmReset = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetProgress();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      router.replace('/onboarding');
    } catch {
      setError('Sıfırlama başarısız oldu. Lütfen tekrar dene.');
      setBusy(false);
    }
  };

  return (
    <SystemWindow title="Tehlikeli Bölge" tone="danger">
      <View style={styles.row}>
        <Ionicons name="nuclear-outline" size={20} color={colors.danger} />
        <SystemText variant="caption" tone="secondary" style={styles.flex}>
          Level, statlar, görevler ve tüm antrenman geçmişi silinir; başlangıç testine geri dönersin.
        </SystemText>
      </View>

      {confirming ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <SystemWindow title="Onay Gerekli" tone="danger" emphasized>
            <SystemText variant="heading" tone="danger" glow align="center">
              TÜM İLERLEME SİLİNECEK
            </SystemText>
            <SystemText variant="body" tone="secondary" align="center">
              Bu işlem geri alınamaz. Emin misin?
            </SystemText>
            <View style={styles.actions}>
              <SystemButton
                label="Vazgeç"
                variant="outline"
                size="sm"
                style={styles.flex}
                disabled={busy}
                onPress={() => setConfirming(false)}
              />
              <SystemButton
                label="Evet, Sıfırla"
                variant="solid"
                tone="danger"
                size="sm"
                style={styles.flex}
                loading={busy}
                onPress={() => void confirmReset()}
              />
            </View>
            {error ? (
              <SystemText variant="caption" tone="danger" align="center">
                {error}
              </SystemText>
            ) : null}
          </SystemWindow>
        </Animated.View>
      ) : (
        <SystemButton
          label="İlerlemeyi Sıfırla"
          variant="outline"
          tone="danger"
          icon={<Ionicons name="trash-outline" size={18} color={colors.danger} />}
          onPress={() => setConfirming(true)}
        />
      )}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
