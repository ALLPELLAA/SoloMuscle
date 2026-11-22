import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SystemText } from '@/components/system-text';
import { SystemWindow } from '@/components/system-window';
import { DEFAULT_PLAYER_NAME, PLAYER_NAME_MAX, normalizePlayerName } from '@/game';
import { colors, glow, radii, spacing, typography } from '@/theme';

export interface NameStepProps {
  name: string;
  onChangeName: (name: string) => void;
  onSubmit: () => void;
}

/** Player registration: themed name input with a live preview of the registered name. */
export function NameStep({ name, onChangeName, onSubmit }: NameStepProps) {
  const [focused, setFocused] = useState(false);
  const registered = normalizePlayerName(name);
  const usingDefault = name.trim().length === 0;

  return (
    <>
      <SystemWindow
        title="Oyuncu Kaydı"
        headerRight={<Ionicons name="finger-print" size={18} color={colors.neon} />}
      >
        <SystemText variant="heading" tone="neon" glow>
          [SİSTEM] Oyuncu kimliği oluşturuluyor.
        </SystemText>
        <SystemText tone="secondary">
          Sistem sana bu adla seslenecek. Durum ekranında ve tüm sistem pencerelerinde görünür.
        </SystemText>

        <View style={styles.field}>
          <View style={styles.fieldHeader}>
            <SystemText variant="label" tone="secondary">
              OYUNCU ADI
            </SystemText>
            <SystemText variant="caption" tone={name.length >= PLAYER_NAME_MAX ? 'gold' : 'muted'}>
              {`${name.length}/${PLAYER_NAME_MAX}`}
            </SystemText>
          </View>
          <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
            <Ionicons name="person-outline" size={20} color={focused ? colors.neonBright : colors.textMuted} />
            <TextInput
              value={name}
              onChangeText={onChangeName}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={onSubmit}
              maxLength={PLAYER_NAME_MAX}
              placeholder={DEFAULT_PLAYER_NAME}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.neon}
              cursorColor={colors.neon}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="next"
              accessibilityLabel="Oyuncu adı"
              style={styles.input}
            />
          </View>
          <SystemText variant="caption" tone="muted">
            {usingDefault
              ? `Boş bırakırsan sistem seni “${DEFAULT_PLAYER_NAME}” olarak kaydeder.`
              : `En fazla ${PLAYER_NAME_MAX} karakter. Baştaki ve sondaki boşluklar silinir.`}
          </SystemText>
        </View>
      </SystemWindow>

      <SystemWindow title="Kayıt Önizleme" tone={usingDefault ? 'neon' : 'gold'}>
        <View style={styles.previewRow}>
          <View style={styles.previewIcon}>
            <Ionicons name="person" size={22} color={usingDefault ? colors.neon : colors.gold} />
          </View>
          <View style={styles.flex}>
            <SystemText variant="caption" tone="muted">
              OYUNCU
            </SystemText>
            <SystemText variant="title" tone={usingDefault ? 'default' : 'gold'} glow={!usingDefault} numberOfLines={1}>
              {registered}
            </SystemText>
          </View>
        </View>
      </SystemWindow>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm, marginTop: spacing.xs },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.neonDim,
    borderRadius: radii.sm,
    backgroundColor: colors.panelSolid,
  },
  inputBoxFocused: { borderColor: colors.neon, boxShadow: glow.neonSoft },
  input: {
    ...typography.title,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    paddingVertical: spacing.sm,
    // Web: hide the browser focus ring (the box itself glows on focus).
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.neonDim,
    backgroundColor: colors.panelSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
