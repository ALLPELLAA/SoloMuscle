import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { useGame } from '@/state/game-provider';
import { colors, radii, spacing } from '@/theme';

/** Dev-only clock controls to test day rollover / penalty quests. Render only when `__DEV__`. */
export function DevToolsSection() {
  const { today, debugDayOffset, debugAdvanceDay } = useGame();
  const [busy, setBusy] = useState<number | null>(null);

  const advance = async (days: number) => {
    setBusy(days);
    try {
      await debugAdvanceDay(days);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SystemWindow
      title="Geliştirici Araçları"
      tone="gold"
      headerRight={
        <View style={styles.devChip}>
          <SystemText variant="label" tone="gold">
            DEV
          </SystemText>
        </View>
      }
    >
      <SystemText variant="caption" tone="secondary">
        Gece yarısı (00:00) gün dönümünü simüle eder. Görevi bitirmeden günü ilerleterek Ceza Görevi akışını test
        edebilirsin. Sadece geliştirme derlemesinde görünür.
      </SystemText>

      <View style={styles.readout}>
        <View style={styles.readoutCell}>
          <SystemText variant="label" tone="muted">
            SİMÜLE GÜN
          </SystemText>
          <SystemText variant="mono">{today}</SystemText>
        </View>
        <View style={styles.separator} />
        <View style={styles.readoutCell}>
          <SystemText variant="label" tone="muted">
            GÜN KAYMASI
          </SystemText>
          <SystemText variant="mono" tone={debugDayOffset > 0 ? 'gold' : 'default'}>
            {`+${debugDayOffset} gün`}
          </SystemText>
        </View>
      </View>

      <View style={styles.actions}>
        <SystemButton
          label="Günü İlerlet (+1)"
          tone="gold"
          size="sm"
          loading={busy === 1}
          disabled={busy !== null}
          icon={<Ionicons name="play-forward-outline" size={16} color={colors.gold} />}
          onPress={() => void advance(1)}
        />
        <SystemButton
          label="2 Gün Atla"
          tone="danger"
          size="sm"
          loading={busy === 2}
          disabled={busy !== null}
          icon={<Ionicons name="play-skip-forward-outline" size={16} color={colors.danger} />}
          onPress={() => void advance(2)}
        />
      </View>
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  devChip: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.backgroundAlt,
  },
  readoutCell: { flex: 1, gap: spacing.xxs },
  separator: { width: 1, alignSelf: 'stretch', backgroundColor: colors.neonFaint },
  actions: { gap: spacing.sm },
});
