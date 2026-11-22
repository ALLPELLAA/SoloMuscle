import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { NumberStepper } from '@/components/number-stepper';
import { StopwatchPanel } from '@/components/stopwatch-panel';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { BASELINE_LIMITS, UNIT_LABELS, type BaselineTest } from '@/game';
import { colors, radii, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BaselineKey = keyof BaselineTest;

export interface BaselineStepProps {
  baseline: BaselineTest;
  /** Per-field messages from `validateBaseline`. */
  errors: Partial<Record<BaselineKey, string>>;
  onChange: (key: BaselineKey, value: number) => void;
}

interface TestDef {
  key: BaselineKey;
  title: string;
  icon: IconName;
  hint: string;
  unit: string;
  step: number;
}

const TESTS: readonly TestDef[] = [
  {
    key: 'pushups',
    title: 'Max Şınav',
    icon: 'barbell-outline',
    hint: 'Vücut düz bir çizgide, göğüs yere yaklaşana kadar in. Form bozulduğu an dur.',
    unit: UNIT_LABELS.reps.short,
    step: 1,
  },
  {
    key: 'situps',
    title: 'Max Mekik',
    icon: 'body-outline',
    hint: 'Dizler bükülü, ayaklar yerde. Sırtın yerden kalkana kadar doğrul, ara verme.',
    unit: UNIT_LABELS.reps.short,
    step: 1,
  },
  {
    key: 'squats',
    title: 'Max Squat',
    icon: 'walk-outline',
    hint: 'Kalça diz hizasına inene kadar çök, topuklar yerde kalsın. Durduğun an say.',
    unit: UNIT_LABELS.reps.short,
    step: 1,
  },
  {
    key: 'plankSeconds',
    title: 'Max Plank',
    icon: 'timer-outline',
    hint: 'Dirsekler omuz altında, vücut dümdüz. Kalçan düştüğü an süre biter.',
    unit: UNIT_LABELS.seconds.long.toLocaleLowerCase('tr-TR'),
    step: 5,
  },
];

/** Baseline test: one max-effort attempt per movement; plank can be timed in-app. */
export function BaselineStep({ baseline, errors, onChange }: BaselineStepProps) {
  const [timerOpen, setTimerOpen] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);

  const onPlankMeasured = (seconds: number) => {
    setMeasured(seconds);
    onChange('plankSeconds', seconds);
  };

  return (
    <>
      <SystemWindow title="Başlangıç Testi" headerRight={<Ionicons name="pulse" size={18} color={colors.neon} />}>
        <SystemText variant="heading" tone="neon" glow>
          [SİSTEM] Fiziksel değerlendirme başlıyor.
        </SystemText>
        <SystemText tone="secondary">
          Her hareketi bir kez, tek seferde ve maksimum eforla yap. Bitirince sonucunu gir.
        </SystemText>
        <View style={styles.rules}>
          <Rule icon="flash-outline">Tek set, ara vermeden. Dinlenmek testi bitirir.</Rule>
          <Rule icon="shield-checkmark-outline">
            Dürüst ol: başlangıç statların ve görev zorluğun bu sonuçlara göre belirlenir.
          </Rule>
          <Rule icon="medkit-outline">Ağrı hissedersen dur. Yapamadığın hareket için 0 girebilirsin.</Rule>
        </View>
      </SystemWindow>

      {TESTS.map((test, index) => {
        const error = errors[test.key];
        const limits = BASELINE_LIMITS[test.key];
        return (
          <SystemWindow
            key={test.key}
            title={`Test ${index + 1}/${TESTS.length} · ${test.title}`}
            tone={error ? 'danger' : 'neon'}
            headerRight={<Ionicons name={test.icon} size={18} color={error ? colors.danger : colors.neon} />}
          >
            <SystemText variant="caption" tone="secondary">
              {test.hint}
            </SystemText>
            <NumberStepper
              value={baseline[test.key]}
              onChange={(value) => onChange(test.key, value)}
              min={limits.min}
              max={limits.max}
              step={test.step}
              unit={test.unit}
              accessibilityLabel={test.title}
            />
            {error ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
                <SystemText variant="caption" tone="danger" style={styles.flex}>
                  {error}
                </SystemText>
              </View>
            ) : null}

            {test.key === 'plankSeconds' ? (
              <View style={styles.timerSection}>
                <SystemButton
                  size="sm"
                  variant={timerOpen ? 'ghost' : 'outline'}
                  label={timerOpen ? 'Kronometreyi gizle' : 'Kronometre ile ölç'}
                  icon={<Ionicons name="stopwatch-outline" size={16} color={colors.neon} />}
                  onPress={() => setTimerOpen((open) => !open)}
                />
                {timerOpen ? (
                  <View style={styles.timerBox}>
                    <StopwatchPanel
                      hint="Pozisyona geç ve başlat. Bıraktığın an durdur; süre otomatik girilir."
                      onStop={onPlankMeasured}
                    />
                    {measured !== null ? (
                      <SystemText variant="caption" tone="success" align="center">
                        {`✓ Ölçüm aktarıldı: ${measured} ${UNIT_LABELS.seconds.short}`}
                      </SystemText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </SystemWindow>
        );
      })}
    </>
  );
}

function Rule({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={styles.rule}>
      <Ionicons name={icon} size={16} color={colors.neon} style={styles.ruleIcon} />
      <SystemText variant="caption" tone="secondary" style={styles.flex}>
        {children}
      </SystemText>
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: spacing.sm, paddingTop: spacing.xs },
  rule: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  ruleIcon: { marginTop: 1 },
  flex: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timerSection: { gap: spacing.md },
  timerBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neonFaint,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundAlt,
  },
});
