/** Read-only history queries that refetch whenever the game writes (dataVersion). */
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import type { ExerciseLog, LastSet, RankExamRecord, StatSnapshot, WorkoutSessionSummary } from '@/db/mappers';
import {
  getDailyVolume,
  getLastSets,
  listCompletedQuestDays,
  listLogsForDay,
  listRankExams,
  listRecentSessions,
  listRecordLogs,
  listSessionLogs,
  listStatSnapshots,
} from '@/db/repository';
import {
  HEATMAP_WEEKS,
  addDays,
  buildHeatmap,
  rawXpByDay,
  type DayKey,
  type ExerciseId,
  type Heatmap,
} from '@/game';

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

/** Last logged set (amount + RPE) per exercise, for auto-filling the next set. */
export function useLastSets(): Partial<Record<ExerciseId, LastSet>> {
  return useQuery((db) => getLastSets(db), {}, []);
}

export function useStatSnapshots(limit = 60): StatSnapshot[] {
  return useQuery((db) => listStatSnapshots(db, limit), [], [limit]);
}

export function useRecordLogs(limit = 30): ExerciseLog[] {
  return useQuery((db) => listRecordLogs(db, limit), [], [limit]);
}

/** Activity heatmap for the last `weeks` weeks ending today (docs §14). */
export function useActivityHeatmap(weeks = HEATMAP_WEEKS): Heatmap | null {
  const { today, state } = useGame();
  const restDays = state?.restDays;
  const data = useQuery(
    async (db) => {
      const fromDay = addDays(today, -7 * weeks);
      const [volume, questDays] = await Promise.all([getDailyVolume(db, fromDay), listCompletedQuestDays(db, fromDay)]);
      return { volume, questDays };
    },
    null as { volume: Awaited<ReturnType<typeof getDailyVolume>>; questDays: DayKey[] } | null,
    [today, weeks],
  );
  if (!data) return null;
  return buildHeatmap({
    endDay: today,
    weeks,
    values: rawXpByDay(data.volume),
    restDays: (restDays ?? []).map((d) => d.dayKey),
    questDays: data.questDays,
  });
}
