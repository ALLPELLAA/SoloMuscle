import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { STAT_KEYS, STAT_POINTS_PER_LEVEL, type Player } from '@/game';
import { useGame } from '@/state/game-provider';
import { colors, spacing } from '@/theme';

import { AllocateHeader } from './allocate-header';
import { PointsWindow } from './points-window';
import { StatAllocationRow } from './stat-allocation-row';
import { useAllocation } from './use-allocation';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/** "STAT PUANI DAĞITIMI": spend unspent level-up points; partial allocation is allowed. */
export function AllocateScreen() {
  const { state, allocatePoints } = useGame();
  // While saving, keep drawing the pre-save player so the numbers don't jump or double count.
  const [frozen, setFrozen] = useState<Player | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const player = frozen ?? state?.player ?? null;
  const draft = useAllocation(player);
  const saving = frozen !== null;

  if (!player || player.unspentPoints === 0) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AllocateHeader onBack={goBack} />
        <NoPointsWindow onBack={goBack} />
      </Screen>
    );
  }

  const confirm = async () => {
    if (draft.error || saving) return;
    setSubmitError(null);
    setFrozen(player);
    try {
      await allocatePoints(draft.allocation);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace('/(tabs)');
    } catch (err) {
      setFrozen(null);
      setSubmitError(err instanceof Error ? err.message : 'Puanlar kaydedilemedi.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    }
  };

  const hint = draft.total === 0 ? draft.error : null;
  const blockingError = submitError ?? (draft.total > 0 ? draft.error : null);

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          {blockingError ? (
            <View style={styles.message}>
              <Ionicons name="warning" size={14} color={colors.danger} />
              <SystemText variant="caption" tone="danger" style={styles.messageText}>
                {blockingError}
              </SystemText>
            </View>
          ) : (
            <SystemText variant="caption" tone="muted" align="center">
              {hint ??
                (draft.remaining > 0
                  ? `${draft.total} puan atanacak, ${draft.remaining} puan saklanacak.`
                  : `${draft.total} puanın tamamı atanacak.`)}
            </SystemText>
          )}
          <SystemButton
            label="Onayla"
            variant="solid"
            disabled={draft.error !== null}
            loading={saving}
            icon={<Ionicons name="checkmark-done" size={20} color={colors.background} />}
            onPress={() => void confirm()}
            accessibilityHint="Seçilen puanları statlara kalıcı olarak ekler"
          />
        </>
      }
    >
      <AllocateHeader onBack={goBack} />
      <PointsWindow available={player.unspentPoints} remaining={draft.remaining} />
      <SystemWindow
        title="Statlar"
        headerRight={
          <SystemButton
            label="Sıfırla"
            variant="ghost"
            size="sm"
            disabled={draft.total === 0 || saving}
            icon={<Ionicons name="refresh" size={14} color={colors.neon} />}
            onPress={draft.reset}
            style={styles.resetButton}
          />
        }
        contentStyle={styles.statsContent}
      >
        {STAT_KEYS.map((stat, index) => (
          <View key={stat}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <StatAllocationRow
              stat={stat}
              value={player.stats[stat]}
              delta={draft.pending[stat]}
              canAdd={draft.canAdd(stat)}
              canRemove={draft.canRemove(stat)}
              onAdd={() => draft.add(stat)}
              onRemove={() => draft.remove(stat)}
              disabled={saving}
            />
          </View>
        ))}
      </SystemWindow>
    </Screen>
  );
}

function NoPointsWindow({ onBack }: { onBack: () => void }) {
  return (
    <SystemWindow title="Bildirim" headerRight={<Ionicons name="information-circle" size={16} color={colors.neon} />}>
      <SystemText variant="bodyStrong" tone="neon" glow>
        [SİSTEM] Dağıtılacak stat puanı yok.
      </SystemText>
      <SystemText variant="caption" tone="secondary">
        {`Egzersiz kaydederek XP kazan. Her level atlayışında ${STAT_POINTS_PER_LEVEL} stat puanı kazanırsın.`}
      </SystemText>
      <SystemButton label="Geri dön" variant="outline" onPress={onBack} style={styles.backButton} />
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  statsContent: { gap: 0, paddingVertical: spacing.sm },
  divider: { height: 1, backgroundColor: colors.neonFaint, marginVertical: spacing.xs },
  resetButton: { minHeight: 32, paddingVertical: spacing.xxs },
  message: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  messageText: { flexShrink: 1 },
  backButton: { marginTop: spacing.sm },
});
