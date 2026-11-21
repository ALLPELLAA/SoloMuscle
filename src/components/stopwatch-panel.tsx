import { StyleSheet, View } from 'react-native';

import { formatClock } from '@/game';
import { useStopwatch } from '@/hooks/use-stopwatch';
import { spacing } from '@/theme';

import { SystemButton } from './system-button';
import { SystemText } from './system-text';

export interface StopwatchPanelProps {
  /** Called with whole seconds when the user stops the stopwatch. */
  onStop: (seconds: number) => void;
  hint?: string;
}

/** Plank timer: start / stop / reset; reports the measured seconds on stop. */
export function StopwatchPanel({ onStop, hint }: StopwatchPanelProps) {
  const watch = useStopwatch();
  return (
    <View style={styles.root}>
      <SystemText variant="display" tone="neon" glow align="center" accessibilityLiveRegion="polite">
        {formatClock(watch.elapsedMs - (watch.elapsedMs % 1000))}
      </SystemText>
      {hint ? (
        <SystemText variant="caption" tone="secondary" align="center">
          {hint}
        </SystemText>
      ) : null}
      <View style={styles.row}>
        {watch.running ? (
          <SystemButton label="Durdur" tone="danger" variant="solid" style={styles.flex} onPress={() => onStop(watch.stop())} />
        ) : (
          <SystemButton label={watch.elapsedMs > 0 ? 'Devam' : 'Başlat'} variant="solid" style={styles.flex} onPress={watch.start} />
        )}
        <SystemButton label="Sıfırla" variant="outline" style={styles.flex} onPress={watch.reset} disabled={watch.running} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
