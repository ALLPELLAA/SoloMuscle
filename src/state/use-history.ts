/** Read-only history queries that refetch whenever the game writes (dataVersion). */
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import type { ExerciseLog, RankExamRecord, WorkoutSessionSummary } from '@/db/mappers';
import { listLogsForDay, listRankExams, listRecentSessions, listSessionLogs } from '@/db/repository';
import type { DayKey } from '@/game';

import { useGame } from './game-provider';

function useQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, initial: T, deps: readonly unknown[]): T {
  const db = useSQLiteContext();
  const { dataVersion } = useGame();
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let cancelled = false;
    load(db)
      .then((result) => {
        if (!cancelled) setValue(result);
      })
      .catch((error: unknown) => console.warn('[history] query failed', error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, dataVersion, ...deps]);
  return value;
}

export function useRecentSessions(limit = 20): WorkoutSessionSummary[] {
  return useQuery((db) => listRecentSessions(db, limit), [], [limit]);
}

export function useSessionLogs(sessionId: number | null): ExerciseLog[] {
  return useQuery((db) => (sessionId === null ? Promise.resolve([]) : listSessionLogs(db, sessionId)), [], [sessionId]);
}

export function useLogsForDay(dayKey: DayKey): ExerciseLog[] {
  return useQuery((db) => listLogsForDay(db, dayKey), [], [dayKey]);
}

export function useRankExams(limit = 20): RankExamRecord[] {
  return useQuery((db) => listRankExams(db, limit), [], [limit]);
}
