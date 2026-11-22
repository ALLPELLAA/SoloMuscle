import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { EXERCISES, formatAmount, type ExerciseTotal, type LogResult } from '@/game';
import { colors, radii, spacing, toneColors } from '@/theme';

import type { SessionSet } from './use-workout-session';
import { rpeTone, signedXp } from './workout-format';

export interface SessionWindowProps {
  sets: readonly SessionSet[];
  totals: readonly ExerciseTotal[];
  /** previewSessionXp of the sets (exercise XP only). */
  setXp: number;
  /** Engine dry-run of the session (per-set XP, quest reward, record bonus). */
  projection: LogResult | null;
  xpLocked: boolean;
  busy: boolean;
  error: string | null;
  onRemove: (key: number) => void;
  onFinish: () => void;
  onCancel: () => void;
}

/** Unsaved sets of the current workout with the XP estimate and finish / cancel actions. */
export function SessionWindow({
  sets,
  totals,
  setXp,
  projection,
  xpLocked,
  busy,
  error,
  onRemove,
  onFinish,
  onCancel,
}: SessionWindowProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const empty = sets.length === 0;
  const exerciseXp = xpLocked ? (projection?.exerciseXp ?? 0) : setXp;
  const questXp = projection?.questRewardXp ?? 0;
  const bonusXp = projection?.recordBonusXp ?? 0;
  const total = exerciseXp + questXp + bonusXp;

  return (
    <SystemWindow
      title="Antrenman Kaydı"
      headerRight={
        <SystemText variant="label" tone="muted">
          {`${sets.length} SET`}
        </SystemText>
      }
    >
      {empty ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={28} color={colors.neonDim} />
          <SystemText variant="caption" tone="muted" align="center">
            Henüz set yok. Egzersizi seç, miktarı gir ve SET EKLE ile kaydet. Antrenman ilk setle başlar.
          </SystemText>
        </View>
      ) : (
        <View style={styles.list}>
          {sets.map((set, index) => (
            <SetRow
              key={set.key}
              set={set}
              index={index}
              xp={projection?.entryXp[index]}
              record={projection?.entryRecord[index] === true}
              disabled={busy}
              onRemove={() => onRemove(set.key)}
            />
          ))}
        </View>
      )}

      {!empty ? (
        <>
          <View style={styles.totals}>
            {totals.map((t) => (
              <View key={t.exerciseId} style={styles.totalChip}>
                <SystemText variant="caption" tone="secondary">
                  {`${EXERCISES[t.exerciseId].name} · ${t.sets} set · ${formatAmount(t.exerciseId, t.amount)}`}
                </SystemText>
              </View>
            ))}
          </View>

          <View style={[styles.xpBox, xpLocked && styles.xpBoxLocked]}>
            <View style={styles.xpHeader}>
              <SystemText variant="label" tone={xpLocked ? 'danger' : 'secondary'}>
                TAHMİNİ XP
              </SystemText>
              <SystemText variant="title" tone={xpLocked && total === 0 ? 'danger' : 'gold'} glow>
                {`${signedXp(total)} XP`}
              </SystemText>
            </View>
            <View style={styles.breakdown}>
              <Breakdown label="Set XP" value={exerciseXp} />
              {questXp > 0 ? <Breakdown label="Görev ödülü" value={questXp} /> : null}
              {bonusXp > 0 ? <Breakdown label="Rekor bonusu" value={bonusXp} /> : null}
            </View>
            {xpLocked ? (
              <View style={styles.lockRow}>
                <Ionicons name="lock-closed" size={14} color={colors.danger} />
                <SystemText variant="caption" tone="danger" style={styles.flex}>
                  {`XP KİLİTLİ: ceza görevi aktif. Setler ceza görevine sayılır; ceza bitene kadar XP verilmez (kilitsiz değer ${signedXp(setXp)} XP).`}
                </SystemText>
              </View>
            ) : (
              <SystemText variant="caption" tone="muted">
                Kesin sonuç antrenman bitince hesaplanır.
              </SystemText>
            )}
          </View>
        </>
      ) : null}

      {error ? (
        <SystemText variant="caption" tone="danger" align="center">
          {error}
        </SystemText>
      ) : null}

      {confirmingCancel ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <SystemWindow title="Onay Gerekli" tone="danger" emphasized>
            <SystemText variant="heading" tone="danger" glow align="center">
              ANTRENMAN İPTAL EDİLSİN Mİ?
            </SystemText>
            <SystemText variant="body" tone="secondary" align="center">
              {`${sets.length} set kaydedilmeden silinecek.`}
            </SystemText>
            <View style={styles.actions}>
              <SystemButton
                label="Vazgeç"
                size="sm"
                variant="outline"
                style={styles.flex}
                onPress={() => setConfirmingCancel(false)}
              />
              <SystemButton
                label="Evet, İptal Et"
                size="sm"
                variant="solid"
                tone="danger"
                style={styles.flex}
                onPress={() => {
                  setConfirmingCancel(false);
                  onCancel();
                }}
              />
            </View>
          </SystemWindow>
        </Animated.View>
      ) : (
        <View style={styles.actions}>
          <SystemButton
            label="İptal"
            variant="outline"
            tone="danger"
            disabled={empty || busy}
            onPress={() => setConfirmingCancel(true)}
          />
          <SystemButton
            label="Antrenmanı Bitir"
            variant="solid"
            style={styles.flex}
            disabled={empty}
            loading={busy}
            icon={<Ionicons name="checkmark-done" size={20} color={colors.background} />}
            onPress={onFinish}
          />
        </View>
      )}
    </SystemWindow>
  );
}

function SetRow({
  set,
  index,
  xp,
  record,
  disabled,
  onRemove,
}: {
  set: SessionSet;
  index: number;
  xp: number | undefined;
  record: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const tone = set.rpe !== null ? toneColors[rpeTone(set.rpe)] : null;
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} layout={LinearTransition} style={styles.row}>
      <View style={styles.index}>
        <SystemText variant="mono" tone="neon">
          {String(index + 1).padStart(2, '0')}
        </SystemText>
      </View>
      <View style={styles.flex}>
        <SystemText variant="bodyStrong" numberOfLines={1}>
          {EXERCISES[set.exerciseId].name}
        </SystemText>
        <View style={styles.meta}>
          <SystemText variant="caption" tone="secondary">
            {formatAmount(set.exerciseId, set.amount)}
          </SystemText>
          {xp !== undefined ? (
            <SystemText variant="caption" tone={xp > 0 ? 'gold' : 'muted'}>
              {`${signedXp(xp)} XP`}
            </SystemText>
          ) : null}
          {record ? <Ionicons name="trophy" size={12} color={colors.gold} accessibilityLabel="Rekor" /> : null}
        </View>
      </View>
      {tone && set.rpe !== null ? (
        <View style={[styles.rpe, { borderColor: tone.main, backgroundColor: tone.faint }]}>
          <SystemText variant="caption" style={[styles.rpeText, { color: tone.main }]}>
            {`RPE ${set.rpe}`}
          </SystemText>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${index + 1}. seti sil`}
        onPress={onRemove}
        disabled={disabled}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
      >
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    </Animated.View>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.breakdownItem}>
      <SystemText variant="caption" tone="muted">
        {label}
      </SystemText>
      <SystemText variant="mono" tone="default">
        {signedXp(value)}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    backgroundColor: colors.panelSolid,
  },
  index: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rpe: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  rpeText: { fontWeight: '700' },
  remove: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { backgroundColor: colors.dangerFaint },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  totalChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.neonFaint,
  },
  xpBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: colors.backgroundAlt,
  },
  xpBoxLocked: { borderColor: colors.dangerDim, backgroundColor: colors.dangerFaint },
  xpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  breakdownItem: { gap: spacing.xxs },
  lockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
