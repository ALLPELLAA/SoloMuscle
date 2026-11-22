import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { SystemText } from '@/components/system-text';
import { getExamEligibility } from '@/game';
import { useGame } from '@/state/game-provider';
import { useRankExams } from '@/state/use-history';

import { CurrentRankWindow } from './current-rank-window';
import { ExamGateWindow } from './exam-gate-window';
import { ExamHistoryWindow } from './exam-history-window';
import { RankHeader } from './rank-header';
import { RankLadderWindow } from './rank-ladder-window';

const openExam = () => router.push('/rank-exam');
const openQuests = () => router.push('/(tabs)/quests');

/** "Rank" tab: current rank, exam gate, E → S ladder and exam history. */
export function RankScreen() {
  const { state, today } = useGame();
  const exams = useRankExams(10);

  if (!state) {
    return (
      <Screen contentStyle={styles.loading}>
        <SystemText variant="label" tone="neon" glow align="center">
          SİSTEM YÜKLENİYOR...
        </SystemText>
      </Screen>
    );
  }

  const eligibility = getExamEligibility(state, today);

  return (
    <Screen>
      <RankHeader title="Rank" caption="Avcı sınıflandırması · E → S" icon="shield-half-outline" />
      <CurrentRankWindow player={state.player} />
      <ExamGateWindow
        eligibility={eligibility}
        level={state.player.level}
        today={today}
        onStart={openExam}
        onOpenQuests={openQuests}
      />
      <RankLadderWindow player={state.player} />
      <ExamHistoryWindow exams={exams} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, justifyContent: 'center' },
});
