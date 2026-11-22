import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { listQuestHistory } from '@/db/repository';
import type { Quest } from '@/game';
import { useGame } from '@/state/game-provider';

export interface QuestHistory {
  quests: Quest[];
  loaded: boolean;
}

/** Most recent quests (daily + penalty) from the DB; refetches after every game write. */
export function useQuestHistory(limit = 14): QuestHistory {
  const db = useSQLiteContext();
  const { dataVersion } = useGame();
  const [history, setHistory] = useState<QuestHistory>({ quests: [], loaded: false });

  useEffect(() => {
    let cancelled = false;
    listQuestHistory(db, limit)
      .then((quests) => {
        if (!cancelled) setHistory({ quests, loaded: true });
      })
      .catch((error: unknown) => {
        console.warn('[quests] history query failed', error);
        if (!cancelled) setHistory((prev) => ({ ...prev, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [db, dataVersion, limit]);

  return history;
}
