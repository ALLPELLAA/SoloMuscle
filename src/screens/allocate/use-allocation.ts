import { useMemo, useState } from 'react';

import { STAT_KEYS, STAT_MAX, emptyStats, sumStats, validateAllocation, type Player, type StatKey, type Stats } from '@/game';

export interface AllocationDraft {
  /** Pending points per stat (not yet saved). */
  pending: Stats;
  /** Only the non-zero entries, as passed to `allocatePoints`. */
  allocation: Partial<Stats>;
  total: number;
  remaining: number;
  /** Turkish validation message from `validateAllocation`, or null when it can be confirmed. */
  error: string | null;
  canAdd(stat: StatKey): boolean;
  canRemove(stat: StatKey): boolean;
  add(stat: StatKey): void;
  remove(stat: StatKey): void;
  reset(): void;
}

/** Local draft of a stat point allocation; validation comes from `@/game`. */
export function useAllocation(player: Player | null): AllocationDraft {
  const [pending, setPending] = useState<Stats>(() => emptyStats(0));
  const available = player?.unspentPoints ?? 0;
  const total = sumStats(pending);
  const remaining = Math.max(0, available - total);

  const allocation = useMemo(() => {
    const result: Partial<Stats> = {};
    for (const key of STAT_KEYS) if (pending[key] > 0) result[key] = pending[key];
    return result;
  }, [pending]);

  const error = player ? validateAllocation(player, allocation) : 'Oyuncu bulunamadı.';

  const canAdd = (stat: StatKey) =>
    player !== null && remaining > 0 && player.stats[stat] + pending[stat] < STAT_MAX;
  const canRemove = (stat: StatKey) => pending[stat] > 0;

  return {
    pending,
    allocation,
    total,
    remaining,
    error,
    canAdd,
    canRemove,
    add: (stat) => {
      if (!canAdd(stat)) return;
      setPending((prev) => ({ ...prev, [stat]: prev[stat] + 1 }));
    },
    remove: (stat) => {
      if (!canRemove(stat)) return;
      setPending((prev) => ({ ...prev, [stat]: Math.max(0, prev[stat] - 1) }));
    },
    reset: () => setPending(emptyStats(0)),
  };
}
