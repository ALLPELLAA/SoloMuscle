import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { RankBadge } from '@/components/rank-badge';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { RANK_REQUIREMENTS, rankUpRewardXp, type DayKey, type ExamEligibility } from '@/game';
import { colors, glow, radii, spacing, toneColors } from '@/theme';

import { ExamBlockDetails } from './exam-block-details';
import { blockTone } from './rank-copy';
import { ThresholdChips } from './threshold-chips';
import { useBreathe } from './use-breathe';

export interface ExamGateWindowProps {
  eligibility: ExamEligibility;
  level: number;
  today: DayKey;
  onStart: () => void;
  onOpenQuests: () => void;
}

/** Rank exam entry: start button when open, otherwise the blocking reason with details. */
export function ExamGateWindow({ eligibility, level, today, onStart, onOpenQuests }: ExamGateWindowProps) {
  const { allowed, reason, target } = eligibility;
  const tone = allowed ? 'neon' : blockTone(reason);
  const pulse = useBreathe(1100, allowed);
  const buttonGlow = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * pulse.get() }));

  const status = allowed ? 'AÇIK' : reason === 'max_rank' ? 'TAMAMLANDI' : 'KİLİTLİ';
  const statusTone = allowed ? 'success' : reason === 'level' || reason === 'cooldown' ? 'secondary' : tone;
  const statusIcon = allowed ? 'lock-open-outline' : reason === 'max_rank' ? 'trophy-outline' : 'lock-closed-outline';
  const statusColor = statusTone === 'secondary' ? colors.textSecondary : toneColors[statusTone].main;

  return (
    <SystemWindow
      title="Rank Sınavı"
      tone={tone}
      emphasized={allowed || reason === 'penalty'}
      headerRight={
        <View style={styles.status}>
          <Ionicons name={statusIcon} size={14} color={statusColor} />
          <SystemText variant="label" tone={statusTone}>
            {status}
          </SystemText>
        </View>
      }
    >
      {allowed && target ? (
        <>
          <View style={styles.intro}>
            <RankBadge rank={target} size="md" />
            <View style={styles.flex}>
              <SystemText variant="heading" tone="neon" glow>
                {`[SİSTEM] ${target} rank sınavı açıldı.`}
              </SystemText>
              <SystemText variant="caption" tone="secondary">
                Dört hareketin hepsinde eşiği geç; rankın yükselsin.
              </SystemText>
            </View>
          </View>
          <ThresholdChips values={RANK_REQUIREMENTS[target].thresholds} />
          <View style={styles.reward}>
            <Ionicons name="sparkles-outline" size={14} color={colors.gold} />
            <SystemText variant="label" tone="gold">
              {`ÖDÜL: +${rankUpRewardXp(target)} XP · ${target} RANK`}
            </SystemText>
          </View>
          <View>
            <Animated.View pointerEvents="none" style={[styles.buttonGlow, buttonGlow]} />
            <SystemButton
              variant="solid"
              label="Rank sınavına gir"
              icon={<Ionicons name="shield-half" size={18} color={colors.background} />}
              onPress={onStart}
              accessibilityHint="Rank sınavı ekranını açar"
            />
          </View>
        </>
      ) : (
        <ExamBlockDetails eligibility={eligibility} level={level} today={today} onOpenQuests={onOpenQuests} />
      )}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  reward: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  buttonGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.sm,
    boxShadow: glow.neonStrong,
  },
});
