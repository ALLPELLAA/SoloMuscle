import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { QuestCard } from '@/components/quest-card';
import { RankBadge } from '@/components/rank-badge';
import { StatBar } from '@/components/stat-bar';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { XpBar } from '@/components/xp-bar';
import {
  RANK_REQUIREMENTS,
  STAT_KEYS,
  STAT_POINTS_PER_LEVEL,
  formatTime,
  nextRank,
  sumStats,
  type GameState,
  type ReminderSettings,
} from '@/game';
import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface ResultStepProps {
  /** What `completeOnboarding` will create (from `createInitialState`). */
  preview: GameState;
  reminder: ReminderSettings;
  error: string | null;
}

/** Evaluation result: starting profile, stats, first daily quest and the core rules. */
export function ResultStep({ preview, reminder, error }: ResultStepProps) {
  const { player, dailyQuest } = preview;
  const examRank = nextRank(player.rank);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  return (
    <>
      <SystemWindow
        title="Değerlendirme Tamamlandı"
        emphasized
        headerRight={<Ionicons name="checkmark-done" size={18} color={colors.neon} />}
      >
        <SystemText variant="heading" tone="neon" glow>
          [SİSTEM] Analiz tamamlandı. Oyuncu kaydı hazır.
        </SystemText>

        <Reveal delay={80}>
          <View style={styles.profile}>
            <RankBadge rank={player.rank} size="lg" />
            <View style={styles.profileInfo}>
              <SystemText variant="caption" tone="muted">
                OYUNCU
              </SystemText>
              <SystemText variant="title" numberOfLines={1}>
                {player.name}
              </SystemText>
              <View style={styles.tags}>
                <Tag tone="neon">{`LEVEL ${player.level}`}</Tag>
                <Tag tone="gold">{`RANK ${player.rank}`}</Tag>
              </View>
            </View>
          </View>
        </Reveal>

        <Reveal delay={160}>
          <XpBar player={player} />
        </Reveal>

        <View style={styles.divider} />

        <View style={styles.statsHeader}>
          <SystemText variant="label" tone="secondary">
            BAŞLANGIÇ STATLARI
          </SystemText>
          <SystemText variant="label" tone="gold" glow>
            {`TOPLAM ${sumStats(player.stats)}`}
          </SystemText>
        </View>
        <View style={styles.stats}>
          {STAT_KEYS.map((stat, i) => (
            <Reveal key={stat} delay={260 + i * 110}>
              <StatBar stat={stat} value={player.stats[stat]} />
            </Reveal>
          ))}
        </View>
      </SystemWindow>

      {dailyQuest ? (
        <Reveal delay={900}>
          <View style={styles.section}>
            <SystemText variant="label" tone="secondary">
              BUGÜNKÜ İLK GÖREVİN
            </SystemText>
            <QuestCard quest={dailyQuest} compact />
          </View>
        </Reveal>
      ) : null}

      <SystemWindow title="Sistem Kuralları" headerRight={<Ionicons name="book-outline" size={18} color={colors.neon} />}>
        <RuleRow icon="time-outline" tone="neon" title="Günlük Görev">
          Her gün 00:00&apos;da yenilenir. Zorluğu level&apos;ına ve statlarına göre artar.
        </RuleRow>
        <RuleRow icon="skull-outline" tone="danger" title="Ceza Görevi">
          Günlük görevi kaçırırsan ertesi gün Ceza Görevi açılır; bitirene kadar hiç XP kazanamazsın. Kayıt
          günün tolerans günüdür: bugünkü görev cezaya yol açmaz.
        </RuleRow>
        <RuleRow icon="trending-up-outline" tone="success" title="Gelişim">
          {`Her egzersiz ilgili stata XP verir. Level atladığında ${STAT_POINTS_PER_LEVEL} stat puanı dağıtırsın.`}
        </RuleRow>
        {examRank ? (
          <RuleRow icon="shield-half-outline" tone="gold" title="Rank Sınavı">
            {`Sınavlar level ile açılır ve gerçek performansla geçilir. İlk sınav (${player.rank} → ${examRank}): Level ${RANK_REQUIREMENTS[examRank].minLevel}.`}
          </RuleRow>
        ) : null}
        {reminder.enabled ? (
          <RuleRow icon="notifications-outline" tone="neon" title="Hatırlatma">
            {`Her gün ${formatTime(reminder.hour, reminder.minute)} için yerel hatırlatma kurulur. Bildirim izni istenecek.`}
          </RuleRow>
        ) : null}
      </SystemWindow>

      {error ? (
        <SystemWindow title="Sistem Hatası" tone="danger" emphasized>
          <SystemText tone="danger">Kayıt oluşturulamadı. Tekrar dene.</SystemText>
          <SystemText variant="caption" tone="secondary">
            {error}
          </SystemText>
        </SystemWindow>
      ) : null}
    </>
  );
}

/** Fades + lifts its content in after `delay` ms (instant with reduced motion). */
function Reveal({ delay, children }: { delay: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function Tag({ tone, children }: { tone: Tone; children: string }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.tag, { borderColor: t.dim, backgroundColor: t.faint }]}>
      <SystemText variant="label" tone={tone} glow>
        {children}
      </SystemText>
    </View>
  );
}

function RuleRow({ icon, tone, title, children }: { icon: IconName; tone: Tone; title: string; children: ReactNode }) {
  const t = toneColors[tone];
  return (
    <View style={styles.rule}>
      <View style={[styles.ruleIcon, { borderColor: t.dim, backgroundColor: t.faint }]}>
        <Ionicons name={icon} size={18} color={t.main} />
      </View>
      <View style={styles.ruleBody}>
        <SystemText variant="label" tone={tone}>
          {title.toLocaleUpperCase('tr-TR')}
        </SystemText>
        <SystemText variant="caption" tone="secondary">
          {children}
        </SystemText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xs },
  profileInfo: { flex: 1, gap: spacing.xxs },
  tags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  divider: { height: 1, backgroundColor: colors.neonFaint, marginVertical: spacing.xs },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { gap: spacing.md },
  section: { gap: spacing.sm },
  rule: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  ruleIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleBody: { flex: 1, gap: spacing.xxs },
});
