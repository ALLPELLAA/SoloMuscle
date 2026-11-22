import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export interface RevealProps {
  delay: number;
  /** False under reduced motion: content is shown immediately. */
  animate: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Fades + slides its children in after `delay` ms. */
export function Reveal({ delay, animate, children, style }: RevealProps) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    progress.set(withDelay(delay, withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) })));
  }, [animate, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 10 }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
