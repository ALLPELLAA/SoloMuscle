import type { RecordEvent } from '@/game';

/** How the boss bonus turned out for this event (docs/GAME_DESIGN.md §10). */
export type BossRewardKind = 'bonus' | 'locked' | 'claimed';

export function bossRewardKind(event: Pick<RecordEvent, 'bonusXp' | 'locked'>): BossRewardKind {
  if (event.locked) return 'locked';
  return event.bonusXp > 0 ? 'bonus' : 'claimed';
}

export const BOSS_COPY = {
  windowTitle: { fight: 'Uyarı', defeated: 'Sistem' },
  systemLine: {
    fight: '[SİSTEM] Rekor bekçisi ortaya çıktı.',
    defeated: '[SİSTEM] Kişisel rekor kırıldı.',
  },
  fightTitle: 'BOSS SAVAŞI',
  defeatTitle: 'BOSS YENİLDİ!',
  guardianLabel: 'Rekor bekçisi',
  hpLabel: 'HP',
  previousLabel: 'Eski rekor',
  newLabel: 'Yeni rekor',
  reward: {
    bonusLabel: 'BOSS BONUSU',
    bonusHint: 'Bonus XP level ilerlemesine eklendi.',
    locked: 'XP KİLİTLİ — ceza görevi aktif',
    lockedHint: 'Rekor kaydedildi, bonus XP verilmedi.',
    claimed: 'Bugünkü boss bonusu zaten alındı',
    claimedHint: 'Rekor yine de kaydedildi.',
  },
  continue: 'Devam',
  skipHint: 'Animasyonu atlamak için dokun',
  missing: {
    title: 'Sistem',
    heading: 'Bekleyen boss kaydı yok.',
    body: 'Bu pencere yalnızca yeni bir kişisel rekor kırıldığında açılır.',
    close: 'Kapat',
  },
} as const;
