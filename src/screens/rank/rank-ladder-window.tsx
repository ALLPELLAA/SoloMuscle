import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { RankBadge } from '@/components/rank-badge';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import {
  evaluateRankExam,
  nextRank,
  RANK_REQUIREMENTS,
  rankIndex,
  RANKS,
  type ExamEvaluation,
  type Player,
  type Rank,
} from '@/game';
import { RANK_TITLES } from '@/screens/status/rank-titles';
import { colors, glow, radii, rankColors, spacing } from '@/theme';

import { recordsAsBaseline, type ExamMetricKey } from './rank-copy';
import { ThresholdChips } from './threshold-chips';

export interface RankLadderWindowProps {
  player: Player;
}

type StepState = 'achieved' | 'current' | 'next' | 'locked';

const STATE_LABEL: Record<StepState, string> = {
  achieved: '✓ KAZANILDI',
  current: 'MEVCUT',
  next: 'SIRADAKİ HEDEF',
  locked: 'KİLİTLİ',
};

/** E → S progression with min level and the four exam thresholds of each rank. */
export function RankLadderWindow({ player }: RankLadderWindowProps) {
  const currentIndex = rankIndex(player.rank);
  const target = nextRank(player.rank);
  // Readiness preview: compares the next thresholds with the current personal records.
  const readiness = target ? evaluateRankExam(target, recordsAsBaseline(player.records)) : null;
  const ready = readiness ? readiness.checks.filter((c) => c.passed).length : 0;

  return (
    <SystemWindow
      title="Rank Merdiveni"
      headerRight={
        <SystemText variant="label" tone="secondary">
          {`${currentIndex + 1}/${RANKS.length}`}
        </SystemText>
      }
    >
      <View>
        {RANKS.map((rank, i) => {
          const state: StepState =
            i < currentIndex ? 'achieved' : i === currentIndex ? 'current' : rank === target ? 'next' : 'locked';
          return (
            <LadderStep
              key={rank}
              rank={rank}
              state={state}
              last={i === RANKS.length - 1}
              readiness={rank === target ? readiness : null}
            />
          );
        })}
      </View>
      {readiness ? (
        <SystemText variant="caption" tone="muted">
          {`Rekorlarına göre hazırlık: ${ready}/${readiness.checks.length} eşik. Yeşil değerler mevcut kişisel rekorunla karşılanıyor.`}
        </SystemText>
      ) : null}
    </SystemWindow>
  );
}

function LadderStep({
  rank,
  state,
  last,
  readiness,
}: {
  rank: Rank;
  state: StepState;
  last: boolean;
  readiness: ExamEvaluation | null;
}) {
  const color = rankColors[rank];
  const requirement = rank === 'E' ? null : RANK_REQUIREMENTS[rank];
  const reached = state === 'achieved' || state === 'current';
  const passed: Partial<Record<ExamMetricKey, boolean>> = {};
  if (readiness) for (const check of readiness.checks) if (check.passed) passed[check.key] = true;

  const labelTone = state === 'achieved' ? 'success' : state === 'current' ? 'neon' : state === 'next' ? 'gold' : 'muted';

  return (
    <View style={styles.step}>
      <View style={styles.rail}>
        <View style={[styles.badge, state === 'locked' && styles.lockedBadge]}>
          <RankBadge rank={rank} size="sm" />
        </View>
        {!last ? <View style={[styles.connector, reached && { backgroundColor: color }]} /> : null}
      </View>

      <View style={[styles.body, state === 'next' && styles.nextBody, state === 'current' && styles.currentBody]}>
        <View style={styles.headRow}>
          <View style={styles.flex}>
            <SystemText variant="heading" style={state === 'locked' ? styles.lockedText : { color }}>
              {`${rank} RANK`}
            </SystemText>
            <SystemText variant="caption" tone={state === 'locked' ? 'muted' : 'secondary'}>
              {RANK_TITLES[rank]}
            </SystemText>
          </View>
          <View style={styles.stateTag}>
            {state === 'locked' ? <Ionicons name="lock-closed" size={11} color={colors.textMuted} /> : null}
            <SystemText variant="label" tone={labelTone} style={styles.tagText}>
              {STATE_LABEL[state]}
            </SystemText>
          </View>
        </View>

        {requirement ? (
          <>
            <SystemText variant="caption" tone={state === 'locked' ? 'muted' : 'secondary'}>
              {`Min. LV ${requirement.minLevel} · dört eşiğin hepsi`}
            </SystemText>
            <ThresholdChips
              values={requirement.thresholds}
              passed={readiness ? passed : undefined}
              dimmed={state === 'locked'}
            />
          </>
        ) : (
          <SystemText variant="caption" tone="secondary">
            Başlangıç rankı · sınav yok
          </SystemText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 36, alignItems: 'center' },
  badge: { paddingTop: spacing.xs },
  lockedBadge: { opacity: 0.4 },
  connector: { flex: 1, width: 2, marginVertical: spacing.xs, backgroundColor: colors.neonFaint, borderRadius: 1 },
  body: {
    flex: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.sm,
  },
  currentBody: { borderColor: colors.neonFaint, backgroundColor: colors.neonFaint },
  nextBody: { borderColor: colors.neon, backgroundColor: colors.backgroundAlt, boxShadow: glow.neonSoft },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  lockedText: { color: colors.textMuted },
  stateTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  tagText: { fontSize: 10, letterSpacing: 1.2 },
});
