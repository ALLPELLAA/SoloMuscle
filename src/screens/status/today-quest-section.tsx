import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { QuestCard } from '@/components/quest-card';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { Quest } from '@/game';
import { colors, spacing } from '@/theme';

export interface TodayQuestSectionProps {
  quest: Quest | null;
  xpLocked: boolean;
  onOpenQuests: () => void;
}

/** Compact summary of today's daily quest with a shortcut to the quests tab. */
export function TodayQuestSection({ quest, xpLocked, onOpenQuests }: TodayQuestSectionProps) {
  return (
    <View style={styles.root}>
      {quest ? (
        <QuestCard quest={quest} xpLocked={xpLocked} compact />
      ) : (
        <SystemWindow title="Günlük Görev">
          <SystemText tone="secondary">Bugünün görevi hazırlanıyor...</SystemText>
        </SystemWindow>
      )}
      <SystemButton
        label="Görevlere Git"
        variant="outline"
        size="sm"
        icon={<Ionicons name="list-outline" size={16} color={colors.neon} />}
        onPress={onOpenQuests}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
});
