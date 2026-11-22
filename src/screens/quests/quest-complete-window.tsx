import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, ZoomIn } from 'react-native-reanimated';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { Quest, Streak } from '@/game';
import { colors, glow, radii, spacing, toneColors } from '@/theme';

import { useGlowPulse } from './use-glow-pulse';
import { useResetCountdown } from './use-reset-countdown';

export interface QuestCompleteWindowProps {
  quest: Quest;
  streak: Streak;
  onFreeWorkout: () => void;
}

/** Celebratory system window once today's daily quest is completed. */
export function QuestCompleteWindow({ quest, streak, onFreeWorkout }: QuestCompleteWindowProps) {
  const countdown = useResetCountdown();
  const pulse = useGlowPulse(1100);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * pulse.get(),
    transform: [{ scale: 0.92 + 0.12 * pulse.get() }],
  }));
  const forfeited = quest.awardedXp === 0;
  const gold = toneColors.gold;

  return (
    <Animated.View entering={ZoomIn.duration(420)}>
      <SystemWindow
        title="Görev Tamamlandı"
        tone="gold"
        emphasized
        headerRight={<Ionicons name="sparkles" size={16} color={colors.gold} />}
        contentStyle={styles.content}
      >
        <View style={styles.emblem}>
          <Animated.View style={[styles.ring, { borderColor: gold.main }, ringStyle]} />
          <View style={[styles.core, { borderColor: gold.dim, backgroundColor: gold.faint }]}>
            <Ionicons name="trophy" size={40} color={colors.gold} />
          </View>
        </View>

        <SystemText variant="label" tone="secondary" align="center">
          SİSTEM BİLDİRİMİ
        </SystemText>
        <SystemText variant="title" tone="gold" glow align="center">
          GÜNLÜK GÖREV TAMAMLANDI!
        </SystemText>

        {forfeited ? (
          <View style={styles.rewardBox}>
            <SystemText variant="heading" tone="danger" align="center">
              ÖDÜL YANDI
            </SystemText>
            <SystemText variant="caption" tone="secondary" align="center">
              Görev tamamlandığında XP kilitliydi (Ceza Görevi aktifti).
            </SystemText>
          </View>
        ) : (
          <View style={styles.rewardBox}>
            <SystemText variant="label" tone="secondary" align="center">
              ÖDÜL
            </SystemText>
            <SystemText variant="display" tone="gold" glow align="center">
              {`+${quest.awardedXp} XP`}
            </SystemText>
          </View>
        )}

        <View style={[styles.statsRow, { borderColor: gold.faint }]}>
          <StatCell icon="flame" label="SERİ" value={`${streak.current} GÜN`} />
          <View style={[styles.separator, { backgroundColor: gold.faint }]} />
          <StatCell icon="ribbon" label="EN İYİ" value={`${streak.best} GÜN`} />
          <View style={[styles.separator, { backgroundColor: gold.faint }]} />
          <StatCell icon="hourglass" label="YENİ GÖREV" value={countdown.label} />
        </View>

        <SystemText variant="caption" tone="secondary" align="center">
          Sistem bugünkü gelişimini onayladı. Dinlen ya da serbest antrenmanla XP kazanmaya devam et.
        </SystemText>
        <SystemButton
          label="Serbest Antrenman"
          variant="outline"
          tone="gold"
          size="sm"
          icon={<Ionicons name="barbell-outline" size={16} color={colors.gold} />}
          onPress={onFreeWorkout}
        />
      </SystemWindow>
    </Animated.View>
  );
}

function StatCell({ icon, label, value }: { icon: 'flame' | 'ribbon' | 'hourglass'; label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <SystemText variant="label" tone="muted">
        {label}
      </SystemText>
      <SystemText variant="mono" tone="default">
        {value}
      </SystemText>
    </View>
  );
}

const EMBLEM = 96;

const styles = StyleSheet.create({
  content: { alignItems: 'stretch', gap: spacing.md },
  emblem: { alignSelf: 'center', width: EMBLEM, height: EMBLEM, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: radii.pill,
    borderWidth: 2,
    boxShadow: glow.gold,
  },
  core: {
    width: EMBLEM - 22,
    height: EMBLEM - 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBox: { gap: spacing.xxs },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
  },
  cell: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  separator: { width: 1 },
});
