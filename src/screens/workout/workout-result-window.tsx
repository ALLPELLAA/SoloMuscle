import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { EXERCISES, STAT_KEYS, STAT_LABELS, formatAmount, type LogResult, type RecordEvent } from '@/game';
import { colors, radii, spacing, statColors } from '@/theme';

import { signedXp } from './workout-format';

export interface WorkoutResultWindowProps {
  result: LogResult;
  setCount: number;
  onClose: () => void;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** System report after "Antrenmanı Bitir": XP split, stats, quests, records, streak, lock warnings. */
export function WorkoutResultWindow({ result, setCount, onClose }: WorkoutResultWindowProps) {
  const increases = STAT_KEYS.filter((key) => (result.statIncreases[key] ?? 0) > 0);
  const trained = STAT_KEYS.filter((key) => (result.statXpGained[key] ?? 0) > 0);
  const streak = result.state.player.streak.current;
  const lockedOut = result.xpLocked && result.totalXp === 0;

  return (
    <SystemWindow title="Antrenman Tamamlandı" tone={lockedOut ? 'danger' : 'gold'} emphasized>
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.hero}>
        <SystemText variant="label" tone="secondary">
          {`${setCount} SET İŞLENDİ · KAZANILAN XP`}
        </SystemText>
        <SystemText variant="display" tone={lockedOut ? 'danger' : 'gold'} glow>
          {`${signedXp(result.totalXp)} XP`}
        </SystemText>
        {result.levelsGained > 0 ? (
          <SystemText variant="heading" tone="neon" glow>
            {`LEVEL ${result.fromLevel} → ${result.toLevel} · +${result.pointsGained} STAT PUANI`}
          </SystemText>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80)} style={styles.split}>
        <SplitCell label="Egzersiz" value={result.exerciseXp} />
        <SplitCell label="Görev ödülü" value={result.questRewardXp} />
        <SplitCell label="Boss bonusu" value={result.recordBonusXp} />
      </Animated.View>

      {result.xpLocked ? (
        <Animated.View entering={FadeInDown.delay(160)}>
          <Notice icon="lock-closed" tone="danger">
            XP kilitliydi: ceza görevi aktifken yapılan setler XP ve Boss bonusu vermedi.
          </Notice>
        </Animated.View>
      ) : null}

      {result.forfeitedQuests.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(240)}>
          <Notice icon="flame-outline" tone="danger">
            Günlük görev tamamlandı ama ödülü yandı (XP kilitli). Seri yine de sayıldı.
          </Notice>
        </Animated.View>
      ) : null}

      {increases.length > 0 || trained.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(320)} style={styles.section}>
          <SystemText variant="label" tone="secondary">
            STATLAR
          </SystemText>
          <View style={styles.stats}>
            {(increases.length > 0 ? increases : trained).map((key) => (
              <View key={key} style={[styles.statChip, { borderColor: statColors[key] }]}>
                <View style={[styles.statDot, { backgroundColor: statColors[key] }]} />
                <SystemText variant="caption" style={{ color: statColors[key] }}>
                  {increases.length > 0
                    ? `${STAT_LABELS[key]} +${result.statIncreases[key] ?? 0}`
                    : `${STAT_LABELS[key]} +${result.statXpGained[key] ?? 0} eğitim XP`}
                </SystemText>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {result.completedQuests.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <SystemText variant="label" tone="secondary">
            TAMAMLANAN GÖREVLER
          </SystemText>
          {result.completedQuests.map((quest) => {
            const penalty = quest.kind === 'penalty';
            return (
              <View key={quest.id} style={styles.line}>
                <Ionicons
                  name={penalty ? 'shield-checkmark' : 'checkmark-circle'}
                  size={16}
                  color={penalty ? colors.danger : colors.success}
                />
                <SystemText variant="body" style={styles.flex} numberOfLines={2}>
                  {quest.title}
                </SystemText>
                <SystemText variant="mono" tone={quest.awardedXp > 0 ? 'gold' : 'muted'}>
                  {penalty ? 'KİLİT AÇILDI' : `${signedXp(quest.awardedXp)} XP`}
                </SystemText>
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      {result.recordEvents.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(480)} style={styles.section}>
          <SystemText variant="label" tone="secondary">
            REKORLAR
          </SystemText>
          {result.recordEvents.map((event, i) => (
            <RecordLine key={`${event.exerciseId}-${i}`} event={event} />
          ))}
        </Animated.View>
      ) : null}

      {result.streakExtended ? (
        <Animated.View entering={FadeInDown.delay(560)}>
          <Notice icon="flame" tone="gold">
            {`SERİ UZADI · ${streak} GÜN`}
          </Notice>
        </Animated.View>
      ) : null}

      <SystemButton
        label="Yeni Antrenman"
        variant="solid"
        tone={lockedOut ? 'danger' : 'gold'}
        icon={<Ionicons name="refresh" size={18} color={colors.background} />}
        onPress={onClose}
      />
    </SystemWindow>
  );
}

function SplitCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.cell}>
      <SystemText variant="mono" tone={value > 0 ? 'gold' : 'muted'}>
        {signedXp(value)}
      </SystemText>
      <SystemText variant="caption" tone="muted" align="center">
        {label}
      </SystemText>
    </View>
  );
}

function RecordLine({ event }: { event: RecordEvent }) {
  const name = EXERCISES[event.exerciseId].name;
  if (!event.boss) {
    return (
      <View style={styles.line}>
        <Ionicons name="trophy-outline" size={16} color={colors.neon} />
        <SystemText variant="body" style={styles.flex}>
          {`İlk rekor: ${name} ${formatAmount(event.exerciseId, event.amount)}`}
        </SystemText>
      </View>
    );
  }
  return (
    <View style={styles.line}>
      <Ionicons name="skull" size={16} color={colors.gold} />
      <View style={styles.flex}>
        <SystemText variant="bodyStrong" tone="gold">
          {`BOSS YENİLDİ: ${event.bossName}`}
        </SystemText>
        <SystemText variant="caption" tone="secondary">
          {`${name} ${formatAmount(event.exerciseId, event.previous ?? 0)} → ${formatAmount(event.exerciseId, event.amount)}`}
        </SystemText>
      </View>
      <SystemText variant="mono" tone={event.bonusXp > 0 ? 'gold' : 'muted'}>
        {event.bonusXp > 0 ? `+${event.bonusXp} XP` : event.locked ? 'KİLİTLİ' : 'BONUS YOK'}
      </SystemText>
    </View>
  );
}

function Notice({ icon, tone, children }: { icon: IconName; tone: 'danger' | 'gold'; children: ReactNode }) {
  const color = tone === 'danger' ? colors.danger : colors.gold;
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      <Ionicons name={icon} size={16} color={color} />
      <SystemText variant="caption" tone={tone} style={styles.flex}>
        {children}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  split: { flexDirection: 'row', gap: spacing.sm },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.panelSolid,
  },
  section: { gap: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  statDot: { width: 6, height: 6, borderRadius: radii.pill },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    backgroundColor: colors.panelSolid,
  },
});
