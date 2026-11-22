import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SystemButton } from '@/components/system-button';
import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import type { RolloverNotice } from '@/state/game-provider';
import { spacing, toneColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface NoticeLine {
  icon: IconName;
  text: string;
}

function headlineFor(notice: RolloverNotice): string {
  if (notice.penaltyStarted) return 'CEZA GÖREVİ AÇILDI';
  if (notice.penaltyContinues) return 'CEZA GÖREVİ DEVAM EDİYOR';
  if (notice.daysSkipped > 0) return `${notice.daysSkipped} GÜN ATLANDI`;
  if (notice.failedDaily) return 'GÖREV KAÇIRILDI';
  if (notice.excusedDaily) return 'DİNLENME GÜNÜ TAMAMLANDI';
  if (notice.streakLost > 0) return 'SERİ SIFIRLANDI';
  return 'YENİ GÜN BAŞLADI';
}

function linesFor(notice: RolloverNotice): NoticeLine[] {
  const lines: NoticeLine[] = [];
  if (notice.failedDaily) {
    lines.push({ icon: 'close-circle-outline', text: 'Dünkü günlük görev süresi doldu: görev kaçırıldı.' });
  }
  if (notice.excusedDaily) {
    lines.push({
      icon: 'bed-outline',
      text: 'Dün dinlenme/hasta günü olarak işaretliydi: tamamlanmayan görev için ceza yok, serin korundu.',
    });
  }
  if (notice.daysSkipped > 0) {
    lines.push({
      icon: 'calendar-clear-outline',
      text: `${notice.daysSkipped} gün boyunca sisteme giriş yapılmadı. Atlanan günler kaçırılmış sayılır.`,
    });
  }
  if (notice.penaltyStarted) {
    lines.push({
      icon: 'skull-outline',
      text: 'Ceza Görevi açıldı. Tamamlanana kadar XP kazanamaz ve rank sınavına giremezsin.',
    });
  }
  if (notice.penaltyContinues) {
    lines.push({
      icon: 'lock-closed-outline',
      text: 'Önceki Ceza Görevi hâlâ tamamlanmadı. XP kilidi devam ediyor.',
    });
  }
  if (notice.autoSavedSets > 0) {
    lines.push({
      icon: 'save-outline',
      text: `Gece yarısından önce eklenen ${notice.autoSavedSets} set önceki güne kaydedildi.`,
    });
  }
  if (notice.streakLost > 0) {
    lines.push({ icon: 'flame-outline', text: `${notice.streakLost} günlük serin sıfırlandı.` });
  }
  return lines;
}

export interface RolloverNoticeWindowProps {
  notice: RolloverNotice;
  onDismiss: () => void;
  /** Shown as a second action while a penalty applies. */
  onOpenQuests: () => void;
}

/** One-time system message describing what happened at the day change. */
export function RolloverNoticeWindow({ notice, onDismiss, onOpenQuests }: RolloverNoticeWindowProps) {
  const penalty = notice.penaltyStarted || notice.penaltyContinues;
  const tone = penalty ? 'danger' : 'neon';
  const t = toneColors[tone];

  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      <SystemWindow
        title="Sistem Mesajı"
        tone={tone}
        emphasized
        headerRight={<Ionicons name="alert-circle" size={18} color={t.main} />}
      >
        <SystemText variant="title" tone={tone} glow align="center">
          {headlineFor(notice)}
        </SystemText>
        <View style={[styles.lines, { borderColor: t.faint }]}>
          {linesFor(notice).map((line) => (
            <View key={line.text} style={styles.line}>
              <Ionicons name={line.icon} size={18} color={t.main} style={styles.icon} />
              <SystemText variant="body" style={styles.lineText}>
                {line.text}
              </SystemText>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <SystemButton label="Anlaşıldı" variant="solid" tone={tone} onPress={onDismiss} />
          {penalty ? (
            <SystemButton
              label="Ceza Görevine Git"
              variant="outline"
              tone="danger"
              size="sm"
              onPress={() => {
                onDismiss();
                onOpenQuests();
              }}
            />
          ) : null}
        </View>
      </SystemWindow>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: spacing.md },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icon: { marginTop: 2 },
  lineText: { flex: 1 },
  actions: { gap: spacing.sm },
});
