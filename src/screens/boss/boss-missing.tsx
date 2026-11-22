import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, spacing } from '@/theme';

import { BOSS_COPY } from './boss-copy';

export interface BossMissingProps {
  onClose(): void;
}

const copy = BOSS_COPY.missing;

/** Shown when /boss is opened without a pending record event (e.g. a stale link). */
export function BossMissing({ onClose }: BossMissingProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <SystemWindow title={copy.title} style={styles.window}>
        <View style={styles.headingRow}>
          <Ionicons name="information-circle-outline" size={20} color={colors.neon} />
          <SystemText variant="heading" style={styles.heading}>
            {copy.heading}
          </SystemText>
        </View>
        <SystemText variant="body" tone="secondary">
          {copy.body}
        </SystemText>
        <SystemButton label={copy.close} onPress={onClose} />
      </SystemWindow>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  window: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { flexShrink: 1 },
});
