import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GridBackground } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { RecordEvent } from '@/game';
import { colors, radii, spacing, typography } from '@/theme';

import { BossEmblem } from './boss-emblem';
import { BOSS_COPY, bossRewardKind } from './boss-copy';
import { BossHpBar } from './boss-hp-bar';
import { BossReward } from './boss-reward';
import { KEYS, SHAKE_FRAMES } from './boss-timeline';
import { RecordComparison } from './record-comparison';
import { ScanLine } from './scan-line';
import { useBossTimeline } from './use-boss-timeline';

export interface BossEncounterProps {
  event: RecordEvent;
  closing: boolean;
  onContinue(): void;
}

const CLAMP = Extrapolation.CLAMP;

/** The animated "BOSS YENİLDİ" window: shake, HP drain, crack, gold reveal, details. */
export function BossEncounter({ event, closing, onContinue }: BossEncounterProps) {
  const { clock, phase, done, reduceMotion, skip } = useBossTimeline();
  const defeated = phase === 'defeated';
  const tone = defeated ? 'gold' : 'danger';

  // Hardware back: first finishes the animation, then behaves like "DEVAM".
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!done) skip();
      else if (!closing) onContinue();
      return true;
    });
    return () => subscription.remove();
  }, [closing, done, onContinue, skip]);

  const windowStyle = useAnimatedStyle(() => {
    const t = clock.get();
    const shake = reduceMotion ? 0 : interpolate(t, SHAKE_FRAMES.input, SHAKE_FRAMES.output, CLAMP);
    const scale = reduceMotion ? 1 : interpolate(t, KEYS.enter, [0.86, 1.03, 1], CLAMP);
    return {
      opacity: interpolate(t, KEYS.enter, [0, 1, 1], CLAMP),
      transform: [{ translateX: shake }, { scale }],
    };
  });

  const redFlashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), KEYS.redFlash, [0, 0.5, 0], CLAMP),
  }));
  const goldFlashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), KEYS.goldFlash, [0, 0.7, 0], CLAMP),
  }));
  const screenRedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), KEYS.redFlash, [0, 0.22, 0], CLAMP),
  }));
  const screenGoldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), KEYS.goldFlash, [0, 0.26, 0], CLAMP),
  }));

  const fightOutStyle = useAnimatedStyle(() => {
    const p = interpolate(clock.get(), KEYS.fightTitleOut, [0, 1], CLAMP);
    return { opacity: 1 - p, transform: [{ scale: reduceMotion ? 1 : 1 + 0.25 * p }] };
  });
  const titleStyle = useAnimatedStyle(() => {
    const t = clock.get();
    return {
      opacity: interpolate(t, KEYS.title, [0, 1, 1], CLAMP),
      transform: [{ scale: reduceMotion ? 1 : interpolate(t, KEYS.title, [1.8, 0.95, 1], CLAMP) }],
    };
  });
  const defeatedLineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), KEYS.details, [0, 1], CLAMP),
  }));
  const detailsStyle = useAnimatedStyle(() => {
    const p = interpolate(clock.get(), KEYS.details, [0, 1], CLAMP);
    return { opacity: p, transform: [{ translateY: reduceMotion ? 0 : 14 * (1 - p) }] };
  });
  const rewardStyle = useAnimatedStyle(() => {
    const t = clock.get();
    return {
      opacity: interpolate(t, KEYS.reward, [0, 1, 1], CLAMP),
      transform: [{ scale: reduceMotion ? 1 : interpolate(t, KEYS.reward, [0.92, 1.04, 1], CLAMP) }],
    };
  });
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), KEYS.button, [0, 1], CLAMP),
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(clock.get(), [KEYS.button[0] - 300, KEYS.button[0]], [1, 0], CLAMP),
  }));

  const bossName = event.bossName.toLocaleUpperCase('tr-TR');

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <GridBackground />
      <Animated.View pointerEvents="none" style={[styles.screenFlash, styles.redFill, screenRedStyle]} />
      <Animated.View pointerEvents="none" style={[styles.screenFlash, styles.goldFill, screenGoldStyle]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEnabled={done}
        >
          <Animated.View style={[styles.windowWrap, windowStyle]}>
            <SystemWindow
              title={BOSS_COPY.windowTitle[phase]}
              tone={tone}
              emphasized
              headerRight={
                <Ionicons
                  name={defeated ? 'trophy' : 'warning'}
                  size={16}
                  color={defeated ? colors.gold : colors.danger}
                />
              }
              contentStyle={styles.content}
            >
              <View style={styles.titleZone} accessibilityLiveRegion="polite">
                <Animated.View style={[styles.titleLayer, fightOutStyle]}>
                  <SystemText variant="title" tone="danger" glow align="center">
                    {BOSS_COPY.fightTitle}
                  </SystemText>
                </Animated.View>
                <Animated.View style={[styles.titleLayer, titleStyle]}>
                  <SystemText
                    variant="display"
                    tone="gold"
                    glow
                    align="center"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={styles.defeatTitle}
                  >
                    {BOSS_COPY.defeatTitle}
                  </SystemText>
                </Animated.View>
              </View>

              <BossEmblem clock={clock} phase={phase} reduceMotion={reduceMotion} />

              <View style={styles.nameBlock}>
                <SystemText variant="label" tone="muted" align="center">
                  {BOSS_COPY.guardianLabel.toLocaleUpperCase('tr-TR')}
                </SystemText>
                <SystemText
                  variant="title"
                  tone={defeated ? 'gold' : 'danger'}
                  glow
                  align="center"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {bossName}
                </SystemText>
              </View>

              <BossHpBar clock={clock} phase={phase} maxHp={event.previous} />

              <View style={styles.lineZone}>
                <Animated.View style={[styles.lineLayer, fightOutStyle]}>
                  <SystemText variant="caption" tone="danger" align="center">
                    {BOSS_COPY.systemLine.fight}
                  </SystemText>
                </Animated.View>
                <Animated.View style={[styles.lineLayer, defeatedLineStyle]}>
                  <SystemText variant="caption" tone="neon" glow align="center">
                    {BOSS_COPY.systemLine.defeated}
                  </SystemText>
                </Animated.View>
              </View>

              <Animated.View style={detailsStyle}>
                <RecordComparison exerciseId={event.exerciseId} previous={event.previous} amount={event.amount} />
              </Animated.View>

              <Animated.View style={rewardStyle}>
                <BossReward kind={bossRewardKind(event)} bonusXp={event.bonusXp} />
              </Animated.View>

              <View style={styles.actionZone}>
                {done ? null : (
                  <Animated.View style={[styles.actionLayer, hintStyle]} pointerEvents="none">
                    <SystemText variant="label" tone="muted" align="center">
                      {BOSS_COPY.skipHint.toLocaleUpperCase('tr-TR')}
                    </SystemText>
                  </Animated.View>
                )}
                <Animated.View style={buttonStyle} pointerEvents={done ? 'auto' : 'none'}>
                  <SystemButton
                    label={BOSS_COPY.continue}
                    variant="solid"
                    tone="gold"
                    onPress={onContinue}
                    disabled={!done || closing}
                    icon={<Ionicons name="chevron-forward" size={18} color={colors.background} />}
                  />
                </Animated.View>
              </View>
            </SystemWindow>

            <ScanLine tone={tone} reduceMotion={reduceMotion} />
            <Animated.View pointerEvents="none" style={[styles.windowFlash, styles.redFill, redFlashStyle]} />
            <Animated.View pointerEvents="none" style={[styles.windowFlash, styles.goldFill, goldFlashStyle]} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {done ? null : (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel={BOSS_COPY.skipHint}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.overlay },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  screenFlash: { ...StyleSheet.absoluteFill },
  redFill: { backgroundColor: colors.danger },
  goldFill: { backgroundColor: colors.gold },
  windowWrap: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  windowFlash: { ...StyleSheet.absoluteFill, borderRadius: radii.sm },
  content: { gap: spacing.md, paddingTop: spacing.md },
  titleZone: { height: typography.display.fontSize + spacing.lg, justifyContent: 'center' },
  titleLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  defeatTitle: { letterSpacing: spacing.xxs },
  nameBlock: { gap: spacing.xxs, marginTop: -spacing.xs },
  lineZone: { height: typography.caption.lineHeight + spacing.xs, justifyContent: 'center' },
  lineLayer: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  actionZone: { marginTop: spacing.xs, justifyContent: 'center' },
  actionLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
