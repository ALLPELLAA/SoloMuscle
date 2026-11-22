import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

export interface BossCrackProps {
  size: number;
  color?: string;
}

/** Jagged fracture lines radiating from the centre (viewBox 0..100). */
const CRACKS = [
  'M50 50 L43 41 L39 30 L31 21 L27 9',
  'M50 50 L59 44 L66 33 L78 27 L88 15',
  'M50 50 L56 60 L54 72 L63 83 L66 95',
  'M50 50 L41 56 L30 58 L20 70 L8 74',
  'M50 50 L62 53 L74 50 L86 57',
  'M39 30 L31 33',
  'M66 33 L70 22',
  'M54 72 L45 79',
  'M30 58 L28 47',
];

/** Static crack drawing; the parent animates its opacity / scale. */
export function BossCrack({ size, color = colors.gold }: BossCrackProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={styles.svg} pointerEvents="none">
      {CRACKS.map((d) => (
        <Path key={`glow-${d}`} d={d} stroke={color} strokeOpacity={0.3} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {CRACKS.map((d) => (
        <Path key={d} d={d} stroke={colors.text} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute' },
});
