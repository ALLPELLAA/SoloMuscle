import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { questProgress, type DayKey, type Quest, type QuestStatus } from '@/game';
import { colors, radii, spacing, toneColors } from '@/theme';

import { formatHistoryDay } from './format';

type TextTone = 'neon' | 'danger' | 'success' | 'gold' | 'secondary' | 'muted';

const STATUS_VIEW: Record<QuestStatus, { label: string; tone: TextTone; color: string }> = {
  active: { label: 'DEVAM EDİYOR', tone: 'neon', color: colors.neon },
  completed: { label: 'TAMAMLANDI', tone: 'success', color: colors.success },
  failed: { label: 'BAŞARISIZ', tone: 'danger', color: colors.danger },
  excused: { label: 'DİNLENME GÜNÜ', tone: 'secondary', color: colors.textSecondary },
};

function rewardView(quest: Quest): { text: string; tone: TextTone } {
  if (quest.kind === 'penalty') {
    return quest.status === 'completed' ? { text: 'KİLİT AÇILDI', tone: 'success' } : { text: '—', tone: 'muted' };
  }
  if (quest.status === 'completed') {
    return quest.awardedXp > 0 ? { text: `+${quest.awardedXp} XP`, tone: 'gold' } : { text: 'ÖDÜL YANDI', tone: 'danger' };
  }
  if (quest.status === 'active') return { text: `ÖDÜL ${quest.rewardXp} XP`, tone: 'muted' };
  return { text: '+0 XP', tone: 'muted' };
}

export interface QuestHistoryWindowProps {
  quests: Quest[];
  today: DayKey;
  loaded: boolean;
}

/** Last quests from the DB: day, kind, status and awarded XP. */
export function QuestHistoryWindow({ quests, today, loaded }: QuestHistoryWindowProps) {
  return (
    <SystemWindow
      title="Görev Geçmişi"
      headerRight={
        <SystemText variant="label" tone="muted">
          {`SON ${quests.length} KAYIT`}
        </SystemText>
      }
      contentStyle={styles.content}
    >
      {quests.length === 0 ? (
        <SystemText variant="caption" tone="secondary" style={styles.empty}>
          {loaded ? 'Henüz kayıtlı görev yok.' : 'Kayıtlar yükleniyor...'}
        </SystemText>
      ) : (
        quests.map((quest, index) => (
          <HistoryRow key={quest.id} quest={quest} today={today} first={index === 0} />
        ))
      )}
    </SystemWindow>
  );
}

function HistoryRow({ quest, today, first }: { quest: Quest; today: DayKey; first: boolean }) {
  const status = STATUS_VIEW[quest.status];
  const reward = rewardView(quest);
  const penalty = quest.kind === 'penalty';
  const kindTone = penalty ? toneColors.danger : toneColors.neon;
  const progress = questProgress(quest);

  return (
    <View
      style={[styles.row, !first && styles.rowDivider]}
      accessible
      accessibilityLabel={`${formatHistoryDay(quest.dayKey, today)}, ${penalty ? 'ceza' : 'günlük'} görev, ${status.label}, ${reward.text}`}
    >
      <View style={[styles.accent, { backgroundColor: status.color, boxShadow: `0 0 6px ${status.color}` }]} />
      <View style={styles.body}>
        <View style={styles.line}>
          <SystemText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {formatHistoryDay(quest.dayKey, today)}
          </SystemText>
          <SystemText variant="label" tone={status.tone}>
            {status.label}
          </SystemText>
        </View>
        <View style={styles.line}>
          <View style={[styles.kindChip, { borderColor: kindTone.dim, backgroundColor: kindTone.faint }]}>
            <SystemText variant="label" style={[styles.kindText, { color: kindTone.main }]}>
              {penalty ? 'CEZA' : 'GÜNLÜK'}
            </SystemText>
          </View>
          <ProgressBar
            progress={progress}
            color={status.color}
            height={3}
            style={styles.flex}
            accessibilityLabel={`İlerleme yüzde ${Math.round(progress * 100)}`}
          />
          <SystemText variant="caption" tone="muted" style={styles.percent}>
            {`${Math.round(progress * 100)}%`}
          </SystemText>
          <SystemText variant="label" tone={reward.tone} style={styles.reward}>
            {reward.text}
          </SystemText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0, paddingVertical: spacing.sm },
  empty: { paddingVertical: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.neonFaint },
  accent: { width: 3, borderRadius: radii.pill },
  body: { flex: 1, gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  kindChip: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  kindText: { fontSize: 10, letterSpacing: 1.5 },
  percent: { minWidth: 34, textAlign: 'right' },
  reward: { minWidth: 92, textAlign: 'right' },
});
