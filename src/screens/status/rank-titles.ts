import type { Rank } from '@/game';

/** Flavor title shown on the status window for each rank (presentation only). */
export const RANK_TITLES: Record<Rank, string> = {
  E: 'Uyanmış',
  D: 'Çırak Avcı',
  C: 'Kıdemli Avcı',
  B: 'Elit Avcı',
  A: 'Usta Avcı',
  S: 'Gölge Hükümdarı',
};
