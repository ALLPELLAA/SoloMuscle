import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useGame } from '@/state/game-provider';

import { BossEncounter } from './boss-encounter';
import { BossMissing } from './boss-missing';

/**
 * "BOSS YENİLDİ" popup (docs/GAME_DESIGN.md §10). Opened by the root SystemEventWatcher
 * for the first queued record event; acknowledging it lets the watcher open the next one.
 */
export function BossScreen() {
  const { pendingBoss, acknowledgeBoss } = useGame();
  const router = useRouter();
  // Snapshot: acknowledging shifts the queue, the closing window must keep its own boss.
  const [event] = useState(() => pendingBoss);
  const [closing, setClosing] = useState(false);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const handleContinue = useCallback(() => {
    if (closing) return;
    setClosing(true);
    acknowledgeBoss();
    leave();
  }, [acknowledgeBoss, closing, leave]);

  if (!event) return <BossMissing onClose={leave} />;
  return <BossEncounter event={event} closing={closing} onContinue={handleContinue} />;
}
