import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { createInitialState, validateBaseline, type BaselineTest } from '@/game';
import { useGame } from '@/state/game-provider';
import { colors, spacing } from '@/theme';

import { BaselineStep } from './baseline-step';
import { INTRO_TEXTS } from './intro-lines';
import { IntroStep } from './intro-step';
import { NameStep } from './name-step';
import { ResultStep } from './result-step';
import { StepIndicator } from './step-indicator';
import { StepTransition } from './step-transition';
import { ONBOARDING_STEPS, stepIndexOf, type OnboardingStepKey } from './steps';
import { useTypewriter } from './use-typewriter';

const EMPTY_BASELINE: BaselineTest = { pushups: 0, situps: 0, squats: 0, plankSeconds: 0 };

interface NavState {
  step: OnboardingStepKey;
  /** 1 = forward, -1 = back (drives the slide direction). */
  direction: 1 | -1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Multi-step "system awakening": intro → name → baseline test → evaluation → join. */
export function OnboardingScreen() {
  const { status, today, reminder, completeOnboarding } = useGame();
  const reduceMotion = useReducedMotion();
  const typewriter = useTypewriter(INTRO_TEXTS, { charMs: 14, instant: reduceMotion });

  const [nav, setNav] = useState<NavState>({ step: 'intro', direction: 1 });
  const [name, setName] = useState('');
  const [baseline, setBaseline] = useState<BaselineTest>(EMPTY_BASELINE);
  const [joining, setJoining] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const index = stepIndexOf(nav.step);
  const errors = useMemo(() => validateBaseline(baseline), [baseline]);
  const baselineValid = Object.keys(errors).length === 0;
  const preview = useMemo(
    () => (baselineValid ? createInitialState(name, baseline, today) : null),
    [baseline, baselineValid, name, today],
  );

  const goForward = (step: OnboardingStepKey) => setNav({ step, direction: 1 });
  const goBack = () => {
    if (joining || index <= 0) return;
    setNav({ step: ONBOARDING_STEPS[index - 1].key, direction: -1 });
  };

  // Android hardware back walks back through the steps instead of leaving the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (joining) return true;
      if (index <= 0) return false;
      setNav({ step: ONBOARDING_STEPS[index - 1].key, direction: -1 });
      return true;
    });
    return () => subscription.remove();
  }, [index, joining]);

  const join = async () => {
    if (joining || !baselineValid) return;
    setJoining(true);
    setSaveError(null);
    try {
      await completeOnboarding(name, baseline);
      router.replace('/(tabs)');
    } catch (e) {
      setSaveError(errorMessage(e));
      setJoining(false);
    }
  };

  // Already onboarded (e.g. deep link) — but not while our own join is finishing.
  if (status === 'ready' && !joining) return <Redirect href="/(tabs)" />;

  const setField = (key: keyof BaselineTest, value: number) => setBaseline((prev) => ({ ...prev, [key]: value }));

  let body: ReactNode;
  let primary: ReactNode;
  switch (nav.step) {
    case 'intro':
      body = <IntroStep typewriter={typewriter} />;
      primary = typewriter.done ? (
        <SystemButton label="Kabul Et" variant="solid" style={styles.primary} onPress={() => goForward('name')} />
      ) : (
        <SystemButton label="Atla" variant="ghost" style={styles.primary} onPress={typewriter.skip} />
      );
      break;
    case 'name':
      body = <NameStep name={name} onChangeName={setName} onSubmit={() => goForward('baseline')} />;
      primary = <SystemButton label="Devam" variant="solid" style={styles.primary} onPress={() => goForward('baseline')} />;
      break;
    case 'baseline':
      body = <BaselineStep baseline={baseline} errors={errors} onChange={setField} />;
      primary = (
        <SystemButton
          label="Değerlendir"
          variant="solid"
          style={styles.primary}
          disabled={!baselineValid}
          onPress={() => goForward('result')}
          icon={<Ionicons name="analytics" size={18} color={colors.background} />}
        />
      );
      break;
    case 'result':
      body = preview ? <ResultStep preview={preview} reminder={reminder} error={saveError} /> : null;
      primary = (
        <SystemButton
          label="Sisteme Katıl"
          variant="solid"
          style={styles.primary}
          loading={joining}
          disabled={!preview}
          onPress={() => void join()}
          icon={<Ionicons name="flash" size={18} color={colors.background} />}
        />
      );
      break;
  }

  const footer = (
    <>
      {nav.step === 'baseline' && !baselineValid ? (
        <SystemText variant="caption" tone="danger" align="center">
          Hatalı alanları düzelt, sonra değerlendirmeye geç.
        </SystemText>
      ) : null}
      <View style={styles.footerRow}>
        {index > 0 ? (
          <SystemButton
            label="Geri"
            variant="outline"
            style={styles.back}
            disabled={joining}
            onPress={goBack}
            icon={<Ionicons name="chevron-back" size={18} color={colors.neon} />}
          />
        ) : null}
        {primary}
      </View>
    </>
  );

  return (
    // Keyed by step so each step starts scrolled to the top.
    <Screen key={nav.step} edges={['top', 'bottom']} footer={footer} contentStyle={styles.content}>
      <StepIndicator steps={ONBOARDING_STEPS} current={index} />
      <StepTransition direction={nav.direction} style={nav.step === 'intro' ? styles.introBody : undefined}>
        {body}
      </StepTransition>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  introBody: { flex: 1, justifyContent: 'center' },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  back: { flex: 1 },
  primary: { flex: 2 },
});
