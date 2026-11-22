import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { NumberStepper } from '@/components/number-stepper';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import {
  AMOUNT_LIMITS,
  exerciseXp,
  getExercise,
  UNIT_LABELS,
  validateExerciseAmount,
  type ExerciseId,
} from '@/game';
import { colors, spacing, toneColors, type Tone } from '@/theme';

export interface QuickLogEditorProps {
  exerciseId: ExerciseId;
  /** Amount still missing for the objective (prefills the stepper). */
  remaining: number;
  tone: Tone;
  xpLocked: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (amount: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Inline amount entry for one quest objective (mounted only while expanded). */
export function QuickLogEditor({ exerciseId, remaining, tone, xpLocked, busy, onCancel, onSubmit }: QuickLogEditorProps) {
  const def = getExercise(exerciseId);
  const limits = AMOUNT_LIMITS[def.unit];
  const [amount, setAmount] = useState(() => clamp(remaining, limits.min, limits.max));
  const error = validateExerciseAmount(exerciseId, amount);
  const t = toneColors[tone];

  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.root, { borderColor: t.faint }]}>
      <NumberStepper
        value={amount}
        onChange={setAmount}
        min={limits.min}
        max={limits.max}
        step={def.unit === 'seconds' ? 5 : 1}
        unit={UNIT_LABELS[def.unit].short}
        accessibilityLabel={`${def.name} miktarı`}
      />
      {error ? (
        <SystemText variant="caption" tone="danger">
          {error}
        </SystemText>
      ) : (
        <View style={styles.previewRow}>
          <Ionicons name={xpLocked ? 'lock-closed' : 'flash'} size={14} color={xpLocked ? colors.danger : colors.gold} />
          <SystemText variant="label" tone={xpLocked ? 'danger' : 'gold'}>
            {xpLocked ? 'XP KİLİTLİ: BU KAYIT XP VERMEZ' : `TAHMİNİ KAZANÇ: +${exerciseXp({ exerciseId, amount })} XP`}
          </SystemText>
        </View>
      )}
      <View style={styles.actions}>
        <SystemButton label="İptal" variant="ghost" tone={tone} size="sm" onPress={onCancel} disabled={busy} />
        <SystemButton
          label="Kaydı Onayla"
          variant="solid"
          tone={tone}
          size="sm"
          style={styles.confirm}
          loading={busy}
          disabled={error !== null}
          icon={<Ionicons name="checkmark" size={16} color={colors.background} />}
          onPress={() => onSubmit(amount)}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  confirm: { flex: 1 },
});
