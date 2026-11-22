import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, glow, radii, spacing } from '@/theme';

import { INTRO_LINES, INTRO_TEXTS } from './intro-lines';
import type { Typewriter } from './use-typewriter';

export interface IntroStepProps {
  typewriter: Typewriter;
}

const FULL_TEXT = INTRO_TEXTS.join(' ');

/** "System awakening": glowing emblem + notification window whose lines are typed out. */
export function IntroStep({ typewriter }: IntroStepProps) {
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(0);
  const scan = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    scan.value = withDelay(700, withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(scan);
    };
  }, [enter, pulse, reduceMotion, scan]);

  const windowStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.9 + 0.1 * enter.value }, { translateY: (1 - enter.value) * 16 }],
  }));
  const auraStyle = useAnimatedStyle(() => ({ opacity: enter.value * (0.35 + 0.55 * pulse.value) }));
  const emblemStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 1 + 0.05 * pulse.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - pulse.value),
    transform: [{ scale: 1 + 0.45 * pulse.value }],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    top: `${scan.value * 100}%`,
    opacity: Math.sin(Math.PI * scan.value) * 0.8,
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.hero, emblemStyle]}>
        <View style={styles.emblemWrap}>
          <Animated.View pointerEvents="none" style={[styles.emblemRing, ringStyle]} />
          <View style={styles.emblem}>
            <Ionicons name="alert" size={40} color={colors.neonBright} />
          </View>
        </View>
        <SystemText variant="display" tone="neon" glow align="center">
          SOLOMUSCLE
        </SystemText>
        <SystemText variant="label" tone="secondary" align="center">
          OYUNCU UYANIŞ PROTOKOLÜ
        </SystemText>
      </Animated.View>

      <Animated.View style={windowStyle}>
        <Animated.View pointerEvents="none" style={[styles.aura, auraStyle]} />
        <Pressable
          onPress={typewriter.skip}
          disabled={typewriter.done}
          accessibilityLabel={FULL_TEXT}
          accessibilityHint={typewriter.done ? undefined : 'Metnin tamamını göstermek için dokun'}
        >
          <SystemWindow
            title="Bildirim"
            emphasized
            headerRight={<Ionicons name="alert-circle" size={18} color={colors.neon} />}
            contentStyle={styles.windowContent}
          >
            {INTRO_LINES.map((line, i) => {
              const shown = typewriter.visible[i] ?? line.text.length;
              const typing = typewriter.cursorLine === i;
              return (
                <SystemText key={line.text} variant={line.variant} tone={line.tone} glow={line.glow && shown > 0}>
                  {line.text.slice(0, shown)}
                  {typing ? <Text style={styles.cursor}>▌</Text> : null}
                  <Text style={styles.hidden}>{line.text.slice(typing ? shown + 1 : shown)}</Text>
                </SystemText>
              );
            })}
          </SystemWindow>
        </Pressable>
        <Animated.View pointerEvents="none" style={[styles.scan, scanStyle]} />
      </Animated.View>

      <SystemText variant="caption" tone="muted" align="center">
        {typewriter.done
          ? 'Kabul ettiğinde oyuncu kaydın ve başlangıç testin başlayacak.'
          : 'Metni geçmek için pencereye dokun.'}
      </SystemText>
    </View>
  );
}

const EMBLEM = 76;

const styles = StyleSheet.create({
  root: { gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm },
  emblemWrap: {
    width: EMBLEM,
    height: EMBLEM,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emblemRing: {
    position: 'absolute',
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM / 2,
    borderWidth: 1,
    borderColor: colors.neon,
  },
  emblem: {
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM / 2,
    borderWidth: 2,
    borderColor: colors.neon,
    backgroundColor: colors.panelSolid,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: glow.neonStrong,
  },
  aura: {
    position: 'absolute',
    top: -spacing.xs,
    bottom: -spacing.xs,
    left: -spacing.xs,
    right: -spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.neonDim,
    boxShadow: glow.neonStrong,
  },
  windowContent: { gap: spacing.md, paddingVertical: spacing.xl },
  cursor: {
    color: colors.neonBright,
    textShadowColor: colors.neon,
    textShadowRadius: 8,
  },
  hidden: {
    color: 'transparent',
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
  scan: {
    position: 'absolute',
    left: spacing.xxs,
    right: spacing.xxs,
    height: 2,
    backgroundColor: colors.neonDim,
    boxShadow: glow.neonSoft,
  },
});
