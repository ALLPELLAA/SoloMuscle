import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GridBackground } from '@/components/screen';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { useGame, type LevelUpEvent } from '@/state/game-provider';
import { colors, glow, radii, spacing, toneColors } from '@/theme';

import { LevelTransition } from './level-transition';
import { LevelUpEmblem } from './level-up-emblem';
import { Reveal } from './reveal';
import { ScanSweep } from './scan-sweep';

const gold = toneColors.gold;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/**
 * Animated LEVEL UP system window (transparent modal). Opened by the root
 * SystemEventWatcher while `pendingLevelUp` is set; both actions acknowledge it.
 */
export function LevelUpScreen() {
  const { pendingLevelUp, acknowledgeLevelUp, state } = useGame();
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  // Keep showing the last event while the acknowledgement + navigation settle.
  const [shown, setShown] = useState<LevelUpEvent | null>(pendingLevelUp);
  if (pendingLevelUp && pendingLevelUp !== shown) setShown(pendingLevelUp);

  const later = useCallback(() => {
    acknowledgeLevelUp();
    close();
  }, [acknowledgeLevelUp]);

  const allocate = useCallback(() => {
    acknowledgeLevelUp();
    router.replace('/allocate');
  }, [acknowledgeLevelUp]);

  // Android back = "SONRA" (otherwise the watcher would reopen the popup).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      later();
      return true;
    });
    return () => sub.remove();
  }, [later]);

  const unspent = state?.player.unspentPoints ?? 0;

  return (
    <PopupFrame animate={animate}>
      {shown ? (
        <LevelUpContent
          key={`${shown.fromLevel}-${shown.toLevel}`}
          event={shown}
          playerName={state?.player.name ?? null}
          unspent={unspent}
          animate={animate}
          onAllocate={allocate}
          onLater={later}
        />
      ) : (
        <NothingPendingContent
          level={state?.player.level ?? null}
          unspent={unspent}
          animate={animate}
          onAllocate={allocate}
          onClose={later}
        />
      )}
    </PopupFrame>
  );
}

interface PopupFrameProps {
  animate: boolean;
  children: ReactNode;
}

/** Dark overlay + centered window with spring entrance, pulsing glow and scan line. */
function PopupFrame({ animate, children }: PopupFrameProps) {
  const enter = useSharedValue(animate ? 0 : 1);
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    if (!animate) return;
    enter.set(withSpring(1, { damping: 11, stiffness: 150, mass: 0.9 }));
    pulse.set(
      withDelay(400, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true)),
    );
    return () => cancelAnimation(pulse);
  }, [animate, enter, pulse]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0, 0.35], [0, 1], Extrapolation.CLAMP),
  }));
  const windowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0, 0.45], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: 0.6 + 0.4 * enter.get() }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * pulse.get() }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <GridBackground />
      </Animated.View>
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Animated.View style={[styles.windowWrap, windowStyle]}>
          <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
          <SystemWindow
            title="Sistem Bildirimi"
            emphasized
            headerRight={<Ionicons name="flash" size={16} color={colors.gold} />}
            contentStyle={styles.content}
          >
            {children}
          </SystemWindow>
          {animate ? <ScanSweep /> : null}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

interface LevelUpContentProps {
  event: LevelUpEvent;
  playerName: string | null;
  unspent: number;
  animate: boolean;
  onAllocate: () => void;
  onLater: () => void;
}

function LevelUpContent({ event, playerName, unspent, animate, onAllocate, onLater }: LevelUpContentProps) {
  const levelsGained = event.toLevel - event.fromLevel;
  const flicker = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!animate) return;
    flicker.set(
      withDelay(
        200,
        withSequence(
          withTiming(1, { duration: 70 }),
          withTiming(0.15, { duration: 60 }),
          withTiming(1, { duration: 60 }),
          withTiming(0.45, { duration: 50 }),
          withTiming(1, { duration: 140 }),
        ),
      ),
    );
  }, [animate, flicker]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: flicker.get(),
    transform: [{ scale: 1.18 - 0.18 * flicker.get() }],
  }));

  const greeting = playerName ? `[SİSTEM] Tebrikler, ${playerName}. Seviyen yükseldi.` : '[SİSTEM] Seviyen yükseldi.';

  return (
    <>
      <LevelUpEmblem animate={animate} />

      <Animated.View style={titleStyle}>
        <SystemText variant="display" tone="gold" glow align="center" accessibilityRole="header">
          LEVEL UP!
        </SystemText>
      </Animated.View>

      <Reveal delay={260} animate={animate} style={styles.messages}>
        <SystemText variant="bodyStrong" tone="neon" glow align="center">
          {greeting}
        </SystemText>
        <SystemText variant="caption" tone="secondary" align="center">
          Bedenin yeni bir eşiği aştı. Kazandığın puanları statlarına dağıtarak güçlen.
        </SystemText>
      </Reveal>

      <Reveal delay={420} animate={animate}>
        <LevelTransition from={event.fromLevel} to={event.toLevel} animate={animate} />
        {levelsGained > 1 ? (
          <View style={styles.multiChip}>
            <SystemText variant="label" tone="gold">{`${levelsGained} LEVEL BİRDEN!`}</SystemText>
          </View>
        ) : null}
      </Reveal>

      <Reveal delay={760} animate={animate}>
        <View style={styles.reward} accessible accessibilityLabel={`${event.pointsGained} stat puanı kazanıldı`}>
          <Ionicons name="add-circle" size={26} color={colors.gold} />
          <View style={styles.rewardTexts}>
            <SystemText variant="heading" tone="gold" glow>
              {`+${event.pointsGained} STAT PUANI KAZANILDI`}
            </SystemText>
            <SystemText variant="caption" tone="secondary">
              {`Dağıtılmayı bekleyen: ${unspent} puan`}
            </SystemText>
          </View>
        </View>
      </Reveal>

      <Reveal delay={940} animate={animate} style={styles.actions}>
        <SystemButton
          label="Statları dağıt"
          variant="solid"
          tone="gold"
          icon={<Ionicons name="options" size={18} color={colors.background} />}
          onPress={onAllocate}
          accessibilityHint="Stat puanı dağıtma ekranını açar"
        />
        <SystemButton label="Sonra" variant="ghost" onPress={onLater} accessibilityHint="Puanlar saklanır" />
      </Reveal>
    </>
  );
}

interface NothingPendingContentProps {
  level: number | null;
  unspent: number;
  animate: boolean;
  onAllocate: () => void;
  onClose: () => void;
}

/** Reload / deep link without a pending event: current level + close. */
function NothingPendingContent({ level, unspent, animate, onAllocate, onClose }: NothingPendingContentProps) {
  return (
    <>
      <LevelUpEmblem animate={animate} muted />
      <SystemText variant="bodyStrong" tone="neon" glow align="center">
        [SİSTEM] Bekleyen bir level atlama bildirimi yok.
      </SystemText>
      {level !== null ? (
        <View style={styles.currentLevel}>
          <SystemText variant="label" tone="secondary">
            MEVCUT LEVEL
          </SystemText>
          <SystemText variant="display" tone="neon" glow>
            {String(level)}
          </SystemText>
        </View>
      ) : null}
      <View style={styles.actions}>
        {unspent > 0 ? (
          <SystemButton
            label={`${unspent} puanı dağıt`}
            variant="solid"
            tone="gold"
            icon={<Ionicons name="options" size={18} color={colors.background} />}
            onPress={onAllocate}
          />
        ) : null}
        <SystemButton label="Kapat" variant="outline" onPress={onClose} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  windowWrap: { width: '100%', maxWidth: 420 },
  halo: { ...StyleSheet.absoluteFill, borderRadius: radii.sm, boxShadow: glow.neonStrong },
  content: { gap: spacing.lg, paddingVertical: spacing.xl, alignItems: 'stretch' },
  messages: { gap: spacing.xs },
  multiChip: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: gold.dim,
    backgroundColor: gold.faint,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: gold.main,
    backgroundColor: gold.faint,
  },
  rewardTexts: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.sm },
  currentLevel: { alignItems: 'center', gap: spacing.xxs },
});
