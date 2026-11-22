import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { RankBadge } from '@/components/rank-badge';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { RANK_REQUIREMENTS, rankUpRewardXp, type ExamRank } from '@/game';
import { colors, spacing } from '@/theme';

import type { IconName } from './rank-copy';
import { ThresholdChips } from './threshold-chips';

export interface ExamInstructionsWindowProps {
  target: ExamRank;
}

const RULES: readonly { icon: IconName; text: string }[] = [
  { icon: 'flash-outline', text: 'Her hareketi bir kez, tek sette ve maksimum eforla yap.' },
  { icon: 'pause-circle-outline', text: 'Hareketler arasında dinlenebilirsin; set içinde durmak seti bitirir.' },
  { icon: 'shield-checkmark-outline', text: 'Dürüst ol. Sistem yalnızca girdiğin sonucu bilir; kendini kandırmak seni güçlendirmez.' },
  { icon: 'hourglass-outline', text: 'Dört eşiğin hepsi karşılanırsa geçersin. Kalırsan sınav ertesi gün tekrar açılır.' },
];

/** Exam briefing: rules, the four thresholds and the reward. */
export function ExamInstructionsWindow({ target }: ExamInstructionsWindowProps) {
  return (
    <SystemWindow title="Sınav Talimatı" emphasized headerRight={<RankBadge rank={target} size="sm" />}>
      <SystemText variant="heading" tone="neon" glow>
        {`[SİSTEM] ${target} rank değerlendirmesi başlıyor.`}
      </SystemText>
      <View style={styles.rules}>
        {RULES.map((rule) => (
          <View key={rule.icon} style={styles.rule}>
            <Ionicons name={rule.icon} size={16} color={colors.neon} style={styles.ruleIcon} />
            <SystemText variant="caption" tone="secondary" style={styles.flex}>
              {rule.text}
            </SystemText>
          </View>
        ))}
      </View>
      <SystemText variant="label" tone="secondary">
        GEÇME EŞİKLERİ
      </SystemText>
      <ThresholdChips values={RANK_REQUIREMENTS[target].thresholds} />
      <SystemText variant="label" tone="gold">
        {`ÖDÜL: ${target} RANK · +${rankUpRewardXp(target)} XP`}
      </SystemText>
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  rules: { gap: spacing.sm },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ruleIcon: { marginTop: 1 },
  flex: { flex: 1 },
});
