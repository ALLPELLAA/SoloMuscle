import { useEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { spacing } from '@/theme';

export interface StepTransitionProps {
  /** 1 = moving forward (slides in from the right), -1 = going back. */
  direction: 1 | -1;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const OFFSET = 28;

/** Fades and slides a step in when it mounts (give it a `key` per step). */
export function StepTransition({ direction, children, style }: StepTransitionProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * OFFSET * direction }],
  }));

  return <Animated.View style={[styles.root, style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
});
