import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import {
  REST_DAY_BLOCK_MESSAGES,
  REST_DAY_LIMIT,
  REST_KIND_LABELS,
  REST_WINDOW_DAYS,
  type RestDay,
  type RestDayEligibility,
  type RestDayKind,
} from '@/game';
import { colors, radii, spacing } from '@/theme';

import { restTextGlow, restTone } from './rest-tone';

type IconName = 'bed-outline' | 'medkit-outline';

const KIND_ICONS: Record<RestDayKind, IconName> = { rest: 'bed-outline', sick: 'medkit-outline' };

const MARK_EFFECTS = [
  'Görev tamamlanmazsa gün dönümünde Ceza Görevi açılmaz.',
  'Serin korunur: artmaz, bozulmaz.',
  'Bugünün hatırlatma bildirimi kurulmaz.',
] as const;

export interface RestDayWindowProps {
  restDay: RestDay | null;
  eligibility: RestDayEligibility | null;
  penaltyActive: boolean;
  busy: boolean;
  onMark: (kind: RestDayKind) => Promise<boolean>;
  onUnmark: () => Promise<boolean>;
}

/** "[ DİNLENME ]": mark today as a rest/sick day (docs §13), with an in-app confirmation step. */
export function RestDayWindow({ restDay, eligibility, penaltyActive, busy, onMark, onUnmark }: RestDayWindowProps) {
  const [pending, setPending] = useState<RestDayKind | null>(null);
  const used = eligibility?.usedInWindow ?? 0;
  const reason = eligibility?.reason ?? null;
  const blockReason = reason && reason !== 'already_marked' ? REST_DAY_BLOCK_MESSAGES[reason] : null;
  const blocked = blockReason !== null;

  const confirm = async () => {
    if (!pending) return;
    if (await onMark(pending)) setPending(null);
  };

  return (
    <SystemWindow title="Dinlenme" headerRight={<UsageMeter used={used} />}>
      {restDay ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.stack}>
          <View style={styles.badge} accessible accessibilityLabel={`Bugün ${REST_KIND_LABELS[restDay.kind]}`}>
            <View style={styles.badgeIcon}>
              <Ionicons name={KIND_ICONS[restDay.kind]} size={26} color={restTone.main} />
            </View>
            <View style={styles.flex}>
              <SystemText variant="label" tone="muted">
                SİSTEM DURUMU
              </SystemText>
              <SystemText variant="heading" style={styles.badgeTitle}>
                {`BUGÜN: ${REST_KIND_LABELS[restDay.kind].toLocaleUpperCase('tr-TR')}`}
              </SystemText>
            </View>
          </View>
          <EffectList extra={penaltyActive ? 'Aktif Ceza Görevi kaldırılmaz; bitene kadar sürer.' : null} />
          <SystemText variant="caption" tone="muted">
            Egzersiz kaydetmeye devam edebilirsin; XP kuralları aynıdır.
          </SystemText>
          <SystemButton
            label="İşareti Kaldır"
            variant="ghost"
            size="sm"
            disabled={busy}
            icon={<Ionicons name="close-circle-outline" size={16} color={colors.neon} />}
            accessibilityHint="Bugünü yeniden normal gün yapar"
            onPress={() => void onUnmark()}
          />
        </Animated.View>
      ) : pending ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.stack, styles.confirm]}>
          <View style={styles.confirmHeader}>
            <Ionicons name="help-circle-outline" size={20} color={restTone.main} />
            <SystemText variant="label" style={styles.purpleText}>
              ONAY GEREKİYOR
            </SystemText>
          </View>
          <SystemText variant="bodyStrong">
            {`Bugün ${REST_KIND_LABELS[pending].toLocaleLowerCase('tr-TR')} olarak işaretlensin mi?`}
          </SystemText>
          <EffectList extra={`Son ${REST_WINDOW_DAYS} günde en fazla ${REST_DAY_LIMIT} gün işaretlenebilir (${used + 1}/${REST_DAY_LIMIT} olacak).`} />
          <View style={styles.row}>
            <SystemButton
              label="Vazgeç"
              variant="ghost"
              size="sm"
              disabled={busy}
              style={styles.flex}
              onPress={() => setPending(null)}
            />
            <SystemButton
              label="Onayla"
              variant="solid"
              size="sm"
              loading={busy}
              style={styles.flex}
              icon={<Ionicons name="checkmark" size={16} color={colors.background} />}
              onPress={() => void confirm()}
            />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.stack}>
          <SystemText variant="caption" tone="secondary">
            Yorgun ya da hasta mısın? Bugünü işaretle: görev tamamlanmazsa ceza açılmaz ve serin bozulmaz.
          </SystemText>
          <View style={styles.row}>
            {(['rest', 'sick'] as const).map((kind) => (
              <SystemButton
                key={kind}
                label={kind === 'rest' ? 'Dinlenme Günü' : 'Hasta Günü'}
                size="sm"
                disabled={busy || blocked}
                style={styles.flex}
                icon={<Ionicons name={KIND_ICONS[kind]} size={16} color={colors.neon} />}
                accessibilityHint="Onay ister"
                onPress={() => setPending(kind)}
              />
            ))}
          </View>
          {blockReason ? (
            <View style={styles.blocked}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <SystemText variant="caption" tone="muted" style={styles.flex}>
                {blockReason}
              </SystemText>
            </View>
          ) : null}
        </View>
      )}
    </SystemWindow>
  );
}

function UsageMeter({ used }: { used: number }) {
  return (
    <View
      style={styles.meter}
      accessible
      accessibilityLabel={`Son ${REST_WINDOW_DAYS} günde ${used} / ${REST_DAY_LIMIT} dinlenme günü kullanıldı`}
    >
      {Array.from({ length: REST_DAY_LIMIT }, (_, i) => (
        <View
          key={i}
          style={[styles.pip, i < used ? { backgroundColor: restTone.main, boxShadow: restTone.glow } : null]}
        />
      ))}
      <SystemText variant="label" tone="muted" style={styles.meterText}>
        {`SON ${REST_WINDOW_DAYS} GÜN: ${used}/${REST_DAY_LIMIT}`}
      </SystemText>
    </View>
  );
}

function EffectList({ extra }: { extra: string | null }) {
  const items = extra ? [...MARK_EFFECTS, extra] : MARK_EFFECTS;
  return (
    <View style={styles.effects}>
      {items.map((text) => (
        <View key={text} style={styles.effect}>
          <SystemText variant="caption" style={styles.purpleText}>
            ›
          </SystemText>
          <SystemText variant="caption" tone="secondary" style={styles.flex}>
            {text}
          </SystemText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: restTone.main,
    borderRadius: radii.sm,
    backgroundColor: restTone.faint,
    boxShadow: restTone.glow,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: restTone.dim,
    borderRadius: radii.pill,
  },
  badgeTitle: { color: restTone.main, ...restTextGlow },
  purpleText: { color: restTone.main },
  confirm: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: restTone.dim,
    borderLeftWidth: 3,
    borderLeftColor: restTone.main,
    borderRadius: radii.sm,
    backgroundColor: restTone.faint,
  },
  confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  effects: { gap: spacing.xxs },
  effect: { flexDirection: 'row', gap: spacing.xs },
  blocked: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meterText: { marginLeft: spacing.xs },
  pip: {
    width: 7,
    height: 7,
    borderWidth: 1,
    borderColor: restTone.main,
    transform: [{ rotate: '45deg' }],
  },
});
