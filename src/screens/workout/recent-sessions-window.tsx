import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { WorkoutSessionSummary } from '@/db/mappers';
import type { DayKey } from '@/game';
import { colors, radii, spacing } from '@/theme';

import { formatDuration, formatSessionTime, signedXp } from './workout-format';

export interface RecentSessionsWindowProps {
  sessions: readonly WorkoutSessionSummary[];
  today: DayKey;
}

/** Last saved workouts: when, how many sets, XP and the lock badge. */
export function RecentSessionsWindow({ sessions, today }: RecentSessionsWindowProps) {
  return (
    <SystemWindow title="Son Antrenmanlar">
      {sessions.length === 0 ? (
        <SystemText variant="caption" tone="muted" align="center">
          Henüz kayıtlı antrenman yok. İlk antrenmanını bitirince burada görünür.
        </SystemText>
      ) : (
        sessions.map((session) => (
          <View key={session.id} style={styles.row}>
            <Ionicons
              name={session.xpLocked ? 'lock-closed-outline' : 'barbell-outline'}
              size={18}
              color={session.xpLocked ? colors.danger : colors.neon}
            />
            <View style={styles.flex}>
              <SystemText variant="bodyStrong">{formatSessionTime(session.startedAt, session.dayKey, today)}</SystemText>
              <SystemText variant="caption" tone="muted">
                {`${session.setCount} set · ${formatDuration(session.endedAt - session.startedAt)}`}
              </SystemText>
            </View>
            {session.xpLocked ? (
              <View style={styles.lockBadge}>
                <SystemText variant="caption" tone="danger" style={styles.badgeText}>
                  KİLİTLİ
                </SystemText>
              </View>
            ) : null}
            <SystemText variant="mono" tone={session.totalXp > 0 ? 'gold' : 'muted'}>
              {`${signedXp(session.totalXp)} XP`}
            </SystemText>
          </View>
        ))
      )}
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neonFaint,
  },
  lockBadge: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.dangerFaint,
  },
  badgeText: { fontWeight: '700', letterSpacing: 1 },
});
