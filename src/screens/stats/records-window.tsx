import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { ExerciseLog } from '@/db/mappers';
import {
  BOSS_NAMES,
  EXERCISE_IDS,
  UNIT_LABELS,
  getExercise,
  type ExerciseId,
  type PersonalRecord,
  type PersonalRecords,
  type RecordSource,
} from '@/game';
import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

import { RECORD_SOURCE_LABELS, formatNumber, formatShortDay } from './stats-format';

const SOURCE_TONES: Record<RecordSource, Tone> = {
  baseline: 'neon',
  set: 'success',
  exam: 'gold',
};

function amountLabel(exerciseId: ExerciseId, amount: number): string {
  return `${formatNumber(amount)} ${UNIT_LABELS[getExercise(exerciseId).unit].short}`;
}

export interface RecordsWindowProps {
  records: PersonalRecords;
}

/** Current personal record of every exercise, in exercise order (docs §10, §14). */
export function RecordsWindow({ records }: RecordsWindowProps) {
  const rows = EXERCISE_IDS.flatMap((id) => {
    const record = records[id];
    return record ? [{ id, record }] : [];
  });

  return (
    <SystemWindow
      title="Rekorlar"
      headerRight={
        <SystemText variant="label" tone="gold">
          {`${rows.length} REKOR`}
        </SystemText>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          text="Henüz rekor yok."
          hint="Antrenman kaydettikçe her egzersizdeki en iyi setin burada listelenir."
        />
      ) : (
        <View>
          {rows.map(({ id, record }, index) => (
            <RecordRow key={id} exerciseId={id} record={record} index={index} />
          ))}
        </View>
      )}
    </SystemWindow>
  );
}

function RecordRow({ exerciseId, record, index }: { exerciseId: ExerciseId; record: PersonalRecord; index: number }) {
  const tone = toneColors[SOURCE_TONES[record.source]];
  return (
    <Animated.View
      entering={FadeInRight.delay(40 * index).duration(320)}
      style={[styles.row, index > 0 && styles.divided]}
      accessible
      accessibilityLabel={`${getExercise(exerciseId).name} rekoru ${amountLabel(exerciseId, record.amount)}, ${formatShortDay(record.dayKey)}, kaynak ${RECORD_SOURCE_LABELS[record.source]}`}
    >
      <View style={styles.main}>
        <SystemText variant="bodyStrong" numberOfLines={1}>
          {getExercise(exerciseId).name}
        </SystemText>
        <View style={styles.bossRow}>
          <Ionicons name="skull-outline" size={12} color={colors.textMuted} />
          <SystemText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            {BOSS_NAMES[exerciseId]}
          </SystemText>
        </View>
      </View>
      <View style={styles.side}>
        <SystemText variant="mono" tone="gold" glow numberOfLines={1}>
          {amountLabel(exerciseId, record.amount)}
        </SystemText>
        <View style={styles.metaRow}>
          <SystemText variant="caption" tone="muted">
            {formatShortDay(record.dayKey)}
          </SystemText>
          <View style={[styles.badge, { borderColor: tone.dim, backgroundColor: tone.faint }]}>
            <SystemText variant="label" style={[styles.badgeText, { color: tone.main }]}>
              {RECORD_SOURCE_LABELS[record.source].toLocaleUpperCase('tr-TR')}
            </SystemText>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export interface BossLogWindowProps {
  logs: readonly ExerciseLog[];
}

/** Latest record-setting sets ("Son yenilen bosslar"). */
export function BossLogWindow({ logs }: BossLogWindowProps) {
  const rows = logs.filter((log) => log.isRecord);
  return (
    <SystemWindow
      title="Son Yenilen Bosslar"
      tone="gold"
      headerRight={
        <Ionicons name="skull" size={14} color={colors.gold} />
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="skull-outline"
          text="Henüz boss yenilmedi."
          hint="Bir egzersizde rekorunu geçtiğinde o egzersizin bossu yenilir ve ekstra XP kazanırsın."
        />
      ) : (
        <View style={styles.bossList}>
          {rows.map((log) => (
            <View key={log.id} style={styles.bossItem}>
              <View style={styles.bossIcon}>
                <Ionicons name="skull" size={14} color={colors.gold} />
              </View>
              <View style={styles.main}>
                <SystemText variant="bodyStrong" tone="gold" numberOfLines={1}>
                  {BOSS_NAMES[log.exerciseId]}
                </SystemText>
                <SystemText variant="caption" tone="secondary" numberOfLines={1}>
                  {`${getExercise(log.exerciseId).name} · ${amountLabel(log.exerciseId, log.amount)}`}
                </SystemText>
              </View>
              <SystemText variant="caption" tone="muted">
                {formatShortDay(log.dayKey)}
              </SystemText>
            </View>
          ))}
        </View>
      )}
    </SystemWindow>
  );
}

function EmptyState({ icon, text, hint }: { icon: 'trophy-outline' | 'skull-outline'; text: string; hint: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={colors.neonDim} />
      <SystemText variant="bodyStrong" tone="secondary" align="center">
        {text}
      </SystemText>
      <SystemText variant="caption" tone="muted" align="center">
        {hint}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.neonFaint },
  main: { flex: 1, gap: spacing.xxs },
  flex: { flex: 1 },
  bossRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  side: { alignItems: 'flex-end', gap: spacing.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 10, letterSpacing: 1 },
  bossList: { gap: spacing.sm },
  bossItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  bossIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: toneColors.gold.dim,
    backgroundColor: toneColors.gold.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
});
