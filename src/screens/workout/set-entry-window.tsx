import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { NumberStepper } from '@/components/number-stepper';
import { StopwatchPanel } from '@/components/stopwatch-panel';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import {
  AMOUNT_LIMITS,
  EXERCISES,
  REST_PRESETS_SECONDS,
  UNIT_LABELS,
  formatAmount,
  type ExerciseId,
  type ExerciseUnit,
  type PersonalRecord,
  type RecordEvent,
} from '@/game';
import { colors, glow, radii, spacing } from '@/theme';

import type { Prefill } from './prefill';
import { RecordIndicator } from './record-indicator';
import { RpePicker } from './rpe-picker';
import { restLabel } from './workout-format';

export interface SetEntryWindowProps {
  exerciseId: ExerciseId;
  amount: number;
  onAmountChange: (amount: number) => void;
  rpe: number | null;
  onRpeChange: (rpe: number | null) => void;
  prefill: Prefill;
  record: PersonalRecord | undefined;
  recordFromSession: boolean;
  recordEvent: RecordEvent | null;
  restSeconds: number;
  onRestSecondsChange: (seconds: number) => void;
  /** Validation message for the amount (null = valid). */
  error: string | null;
  onAddSet: () => void;
  disabled?: boolean;
}

const STEP: Record<ExerciseUnit, number> = { reps: 1, seconds: 5, minutes: 1 };

function prefillHint(exerciseId: ExerciseId, prefill: Prefill): string {
  const amount = formatAmount(exerciseId, prefill.amount);
  const rpe = prefill.rpe !== null ? ` · RPE ${prefill.rpe}` : '';
  switch (prefill.source) {
    case 'session':
      return `Önceki set: ${amount}${rpe} (bu antrenman)`;
    case 'history':
      return `Önceki set: ${amount}${rpe} (son kayıt)`;
    case 'penalty':
      return `Ceza görevi: ${amount} kaldı`;
    case 'quest':
      return `Günlük görev: ${amount} kaldı`;
    default:
      return 'Önceki set yok: varsayılan değer';
  }
}

/** Amount, stopwatch (timed exercises), record status, RPE and rest preset for the next set. */
export function SetEntryWindow({
  exerciseId,
  amount,
  onAmountChange,
  rpe,
  onRpeChange,
  prefill,
  record,
  recordFromSession,
  recordEvent,
  restSeconds,
  onRestSecondsChange,
  error,
  onAddSet,
  disabled = false,
}: SetEntryWindowProps) {
  const def = EXERCISES[exerciseId];
  const limits = AMOUNT_LIMITS[def.unit];
  const fromPrevious = prefill.source === 'session' || prefill.source === 'history';

  return (
    <SystemWindow
      title={`Set: ${def.name}`}
      tone={recordEvent?.boss ? 'gold' : 'neon'}
      emphasized={recordEvent?.boss === true}
    >
      <View style={styles.hint}>
        <Ionicons
          name={fromPrevious ? 'refresh-outline' : prefill.source === 'default' ? 'create-outline' : 'flag-outline'}
          size={14}
          color={prefill.source === 'penalty' ? colors.danger : colors.neonBright}
        />
        <SystemText
          variant="caption"
          tone={prefill.source === 'penalty' ? 'danger' : 'secondary'}
          style={styles.flex}
          accessibilityLiveRegion="polite"
        >
          {prefillHint(exerciseId, prefill)}
        </SystemText>
      </View>

      <NumberStepper
        value={amount}
        onChange={onAmountChange}
        min={limits.min}
        max={limits.max}
        step={STEP[def.unit]}
        unit={UNIT_LABELS[def.unit].short}
        label={UNIT_LABELS[def.unit].long}
        accessibilityLabel={`${def.name} miktarı`}
      />

      {def.unit === 'seconds' ? (
        <View style={styles.stopwatch}>
          <StopwatchPanel
            key={exerciseId}
            hint="Süreyi ölç: durdurunca miktara yazılır."
            onStop={(seconds) => {
              if (seconds >= limits.min) onAmountChange(Math.min(limits.max, seconds));
            }}
          />
        </View>
      ) : null}

      {error ? (
        <SystemText variant="caption" tone="danger">
          {error}
        </SystemText>
      ) : null}

      <RecordIndicator exerciseId={exerciseId} record={record} fromSession={recordFromSession} event={recordEvent} />

      <RpePicker value={rpe} onChange={onRpeChange} />

      <View style={styles.restRow}>
        <SystemText variant="label" tone="secondary">
          DİNLENME
        </SystemText>
        <View style={styles.presets}>
          {REST_PRESETS_SECONDS.map((seconds) => {
            const selected = seconds === restSeconds;
            return (
              <Pressable
                key={seconds}
                accessibilityRole="button"
                accessibilityLabel={`Dinlenme ${restLabel(seconds)}`}
                accessibilityState={{ selected }}
                onPress={() => onRestSecondsChange(seconds)}
                style={({ pressed }) => [styles.preset, selected && styles.presetActive, pressed && styles.pressed]}
              >
                <SystemText variant="caption" tone={selected ? 'neon' : 'muted'} style={styles.presetText}>
                  {restLabel(seconds)}
                </SystemText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SystemButton
        label="Set Ekle"
        variant="solid"
        tone={recordEvent?.boss ? 'gold' : 'neon'}
        icon={<Ionicons name="add-circle-outline" size={20} color={colors.background} />}
        disabled={disabled || error !== null}
        onPress={onAddSet}
        accessibilityHint={`Seti listeye ekler ve ${restLabel(restSeconds)} dinlenme başlatır`}
      />
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.neonDim,
    backgroundColor: colors.neonFaint,
  },
  stopwatch: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.backgroundAlt,
  },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  presets: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  preset: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    alignItems: 'center',
  },
  presetActive: { borderColor: colors.neon, backgroundColor: colors.neonFaint, boxShadow: glow.neonSoft },
  presetText: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
