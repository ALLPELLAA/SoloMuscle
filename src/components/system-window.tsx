import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, toneColors, type Tone } from '@/theme';

import { SystemText } from './system-text';

export interface SystemWindowProps {
  /** Shown in the header as `[ TITLE ]`. */
  title?: string;
  /** Small text on the right side of the header. */
  headerRight?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Stronger glow, used for important popups. */
  emphasized?: boolean;
}

/** The core "system window": dark translucent panel, neon border, corner brackets. */
export function SystemWindow({
  title,
  headerRight,
  tone = 'neon',
  children,
  style,
  contentStyle,
  emphasized = false,
}: SystemWindowProps) {
  const t = toneColors[tone];
  return (
    <View
      style={[
        styles.window,
        { borderColor: t.dim, boxShadow: emphasized ? t.glow : undefined },
        style,
      ]}
    >
      <Corner position="topLeft" color={t.main} />
      <Corner position="topRight" color={t.main} />
      <Corner position="bottomLeft" color={t.main} />
      <Corner position="bottomRight" color={t.main} />
      {title ? (
        <View style={[styles.header, { borderBottomColor: t.faint, backgroundColor: t.faint }]}>
          <SystemText variant="label" tone={tone} glow numberOfLines={1} style={styles.title}>
            {`[ ${title.toLocaleUpperCase('tr-TR')} ]`}
          </SystemText>
          {headerRight ? <View>{headerRight}</View> : null}
        </View>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

function Corner({ position, color }: { position: CornerPosition; color: string }) {
  return <View pointerEvents="none" style={[styles.corner, cornerStyles[position], { borderColor: color }]} />;
}

const CORNER = 12;

const styles = StyleSheet.create({
  window: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderRadius: radii.sm,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  title: { flexShrink: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
});

const cornerStyles = StyleSheet.create({
  topLeft: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
});
