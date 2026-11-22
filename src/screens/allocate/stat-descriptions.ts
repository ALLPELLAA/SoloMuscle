import type { StatKey } from '@/game';

/** Short in-game description per stat for the allocation screen. */
export const STAT_DESCRIPTIONS: Record<StatKey, string> = {
  strength: 'Ham kuvvet. Şınav, barfiks ve squat ile gelişir.',
  endurance: 'Uzun süre efor sarf edebilme. Koşu, mekik ve plank ile gelişir.',
  agility: 'Hız ve koordinasyon. Burpee, ip atlama ve lunge ile gelişir.',
  vitality: 'Genel sağlık ve toparlanma. Yürüyüş, koşu ve yoga ile gelişir.',
  flexibility: 'Hareket açıklığı. Esneme ve yoga ile gelişir.',
};
