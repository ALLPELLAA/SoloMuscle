import type { SystemTextProps, TextVariant } from '@/components/system-text';

export interface IntroLine {
  text: string;
  variant: TextVariant;
  tone: NonNullable<SystemTextProps['tone']>;
  glow?: boolean;
}

/** System messages typed out on the awakening screen. */
export const INTRO_LINES: readonly IntroLine[] = [
  { text: '[SİSTEM] Oyuncu tespit edildi.', variant: 'heading', tone: 'neon', glow: true },
  { text: 'Uyanış protokolü başlatılıyor...', variant: 'mono', tone: 'secondary' },
  { text: 'Bedenin artık sisteme bağlı. Her tekrar, her saniye seni güçlendirecek.', variant: 'body', tone: 'default' },
  { text: 'Görevleri tamamla. Seviye atla. Rankını yükselt.', variant: 'body', tone: 'default' },
  { text: 'Oyuncu olmayı kabul ediyor musun?', variant: 'bodyStrong', tone: 'gold', glow: true },
];

export const INTRO_TEXTS: readonly string[] = INTRO_LINES.map((line) => line.text);
