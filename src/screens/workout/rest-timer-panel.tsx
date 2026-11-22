import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle } from 'react-native-reanimated';

import { ProgressBar } from '@/components/progress-bar';
import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { formatClock } from '@/game';
import { colors, glow, radii, spacing } from '@/theme';

import type { RestTimerControls } from './use-rest-timer';
import { useNeonPulse } from './use-neon-pulse';
import { restLabel } from './workout-format';

export interface RestTimerPanelProps {
  rest: RestTimerControls;
}

/** Pinned rest countdown: big mm:ss, draining bar, −15 / +15 / Atla. */
export function RestTimerPanel({ rest }: RestTimerPanelProps) {
  const pulse = useNeonPulse(rest.finished, 700);
  const doneStyle = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * pulse.get() }));
  const warning = !rest.finished && rest.remainingMs <= 10_000;

  if (rest.finished) {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={[styles.root, styles.doneRoot]}>
        <Animated.View style={[styles.doneRow, doneStyle]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <SystemText variant="heading" tone="success" align="center" accessibilityLiveRegion="assertive">
            DİNLENME BİTTİ — SIRADAKİ SET
          </SystemText>
        </Animated.View>
        <View style={styles.actions}>
          <SystemButton
            label={`Tekrar ${restLabel(rest.presetSeconds)}`}
            size="sm"
            variant="outline"
            style={styles.flex}
            onPress={() => rest.start()}
          />
          <SystemButton label="Kapat" size="sm" variant="solid" tone="success" style={styles.flex} onPress={rest.skip} />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.root}>
      <View style={styles.top}>
        <View style={styles.labelCol}>
          <SystemText variant="label" tone="neon" glow>
            [ DİNLENME ]
          </SystemText>
          <SystemText variant="caption" tone="muted">
            {`Hazır süre ${restLabel(rest.presetSeconds)}`}
          </SystemText>
        </View>
        <SystemText
          variant="display"
          tone={warning ? 'gold' : 'neon'}
          glow
          style={styles.clock}
          accessibilityRole="timer"
          accessibilityLabel={`Kalan dinlenme ${formatClock(rest.remainingMs)}`}
        >
          {formatClock(rest.remainingMs)}
        </SystemText>
      </View>
      <ProgressBar progress={rest.progress} color={warning ? colors.gold : colors.neon} height={6} />
      <View style={styles.actions}>
        <SystemButton label="−15 sn" size="sm" variant="outline" style={styles.flex} onPress={() => rest.adjust(-15)} />
        <SystemButton label="+15 sn" size="sm" variant="outline" style={styles.flex} onPress={() => rest.adjust(15)} />
        <SystemButton
          label="Atla"
          size="sm"
          variant="ghost"
          style={styles.flex}
          icon={<Ionicons name="play-skip-forward-outline" size={16} color={colors.neon} />}
          onPress={rest.skip}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  doneRoot: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.successDim,
    boxShadow: glow.success,
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelCol: { gap: spacing.xxs },
  clock: { fontVariant: ['tabular-nums'], letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
