import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { colors, radii, spacing, toneColors } from '@/theme';

import type { LogToastContent } from './log-toast-content';

export interface LogToastProps {
  /** Changes for every new message (restarts the timer). Also pass it as `key` to replay the animation. */
  id: number;
  content: LogToastContent;
  onDismiss: () => void;
  durationMs?: number;
}

/** Floating system message at the top of the screen; tap or wait to dismiss. */
export function LogToast({ id, content, onDismiss, durationMs = 4200 }: LogToastProps) {
  const insets = useSafeAreaInsets();
  const t = toneColors[content.tone];

  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, id, onDismiss]);

  return (
    <Animated.View
      entering={FadeInUp.duration(260)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.root, { top: insets.top + spacing.sm }]}
      accessibilityLiveRegion="polite"
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`${content.headline}. Kapat`} onPress={onDismiss}>
        <SystemWindow
          title="Sistem Mesajı"
          tone={content.tone}
          emphasized
          style={styles.window}
          contentStyle={styles.content}
          headerRight={<Ionicons name="close" size={16} color={t.main} />}
        >
          <View style={styles.headlineRow}>
            <Ionicons name={content.icon} size={24} color={t.main} />
            <SystemText variant="title" tone={content.tone} glow style={styles.flex}>
              {content.headline}
            </SystemText>
          </View>
          {content.lines.map((line) => (
            <SystemText key={line} variant="caption" tone="secondary">
              {line}
            </SystemText>
          ))}
          {content.highlights.map((highlight) => (
            <View
              key={highlight.text}
              style={[
                styles.highlight,
                { borderColor: toneColors[highlight.tone].dim, backgroundColor: toneColors[highlight.tone].faint },
              ]}
            >
              <SystemText variant="label" tone={highlight.tone} glow>
                {highlight.text}
              </SystemText>
            </View>
          ))}
        </SystemWindow>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 20 },
  window: { backgroundColor: colors.panelSolid },
  content: { gap: spacing.xs, paddingVertical: spacing.md },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  highlight: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
});
