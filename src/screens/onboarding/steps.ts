/** Onboarding step order and labels (UI only). */
export type OnboardingStepKey = 'intro' | 'name' | 'baseline' | 'result';

export interface OnboardingStepDef {
  key: OnboardingStepKey;
  label: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  { key: 'intro', label: 'Uyanış' },
  { key: 'name', label: 'Kimlik' },
  { key: 'baseline', label: 'Test' },
  { key: 'result', label: 'Sonuç' },
];

export function stepIndexOf(key: OnboardingStepKey): number {
  return ONBOARDING_STEPS.findIndex((s) => s.key === key);
}
