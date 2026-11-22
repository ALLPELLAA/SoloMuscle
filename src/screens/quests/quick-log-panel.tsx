import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { formatAmount, getExercise, type ExerciseId, type Quest } from '@/game';
import { spacing, toneColors, type Tone } from '@/theme';

import { QuickLogEditor } from './quick-log-editor';

export interface QuickLogPanelProps {
  quest: Quest;
  tone: Tone;
  xpLocked: boolean;
  busy: boolean;
  /** Logs one set; resolves `true` when it was saved. */
  onLog: (exerciseId: ExerciseId, amount: number, rpe: number | undefined) => Promise<boolean>;
}

/** "Kaydet" per incomplete objective, expanding into an inline amount entry. */
export function QuickLogPanel({ quest, tone, xpLocked, busy, onLog }: QuickLogPanelProps) {
  const [expanded, setExpanded] = useState<ExerciseId | null>(null);
  const open = quest.objectives.filter((o) => o.progress < o.target);
  const t = toneColors[tone];

  if (open.length === 0) return null;

  const submit = async (exerciseId: ExerciseId, amount: number, rpe: number | undefined) => {
    const saved = await onLog(exerciseId, amount, rpe);
    if (saved) setExpanded(null);
  };

  return (
    <SystemWindow
      title={quest.kind === 'penalty' ? 'Ceza Kaydı' : 'Hızlı Kayıt'}
      tone={tone}
      headerRight={
        <SystemText variant="label" tone="muted">
          {`${open.length} HEDEF KALDI`}
        </SystemText>
      }
    >
      {open.map((objective, index) => {
        const def = getExercise(objective.exerciseId);
        const remaining = objective.target - objective.progress;
        const isOpen = expanded === objective.exerciseId;
        return (
          <View
            key={objective.exerciseId}
            style={[styles.item, index > 0 && [styles.divider, { borderTopColor: t.faint }]]}
          >
            <View style={styles.row}>
              <View style={[styles.marker, { borderColor: t.main, backgroundColor: isOpen ? t.main : t.faint }]} />
              <View style={styles.texts}>
                <SystemText variant="bodyStrong">{def.name}</SystemText>
                <SystemText variant="caption" tone="secondary">
                  {`Kalan: ${formatAmount(objective.exerciseId, remaining)}`}
                </SystemText>
              </View>
              {isOpen ? null : (
                <SystemButton
                  label="Kaydet"
                  variant="outline"
                  tone={tone}
                  size="sm"
                  disabled={busy}
                  icon={<Ionicons name="add" size={16} color={t.main} />}
                  accessibilityHint={`${def.name} için set kaydı açar`}
                  onPress={() => setExpanded(objective.exerciseId)}
                />
              )}
            </View>
            {isOpen ? (
              <QuickLogEditor
                exerciseId={objective.exerciseId}
                remaining={remaining}
                tone={tone}
                xpLocked={xpLocked}
                busy={busy}
                onCancel={() => setExpanded(null)}
                onSubmit={(amount, rpe) => void submit(objective.exerciseId, amount, rpe)}
              />
            ) : null}
          </View>
        );
      })}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing.sm },
  divider: { borderTopWidth: 1, paddingTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  marker: { width: 10, height: 10, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  texts: { flex: 1, gap: spacing.xxs },
});
