/**
 * Bridge between the pure game logic (src/game), persistence (src/db) and the UI.
 * The UI reads state and calls actions exclusively through `useGame()`.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import {
  DEFAULT_REMINDER,
  allocateStatPoints,
  applyExerciseLogs,
  buildReminderPlan,
  createInitialState,
  findRestDay,
  getRestDayEligibility,
  isValidReminderTime,
  isXpLocked,
  markRestDay as markRestDayRule,
  msUntilNextMidnight,
  rolloverDay,
  submitRankExam,
  toDayKey,
  unmarkRestDay as unmarkRestDayRule,
  type BaselineTest,
  type DayKey,
  type ExerciseEntry,
  type GameState,
  type LogResult,
  type RankExamResult,
  type RecordEvent,
  type ReminderSettings,
  type RestDay,
  type RestDayEligibility,
  type RestDayKind,
  type RolloverEvent,
  type Stats,
} from '@/game';
import {
  getSetting,
  loadGameState,
  resetAllData,
  saveGameState,
  saveRankExam,
  saveRestDay,
  saveWorkout,
  setSetting,
} from '@/db/repository';
import { ensureNotificationPermission, syncReminders } from '@/notifications/reminders';

export type GameStatus = 'loading' | 'onboarding' | 'ready' | 'error';

export interface LevelUpEvent {
  fromLevel: number;
  toLevel: number;
  pointsGained: number;
}

/** Noteworthy outcome of a day change, shown once as a system message. */
export interface RolloverNotice {
  failedDaily: boolean;
  /** Previous daily quest was not completed but the day was a rest/sick day. */
  excusedDaily: boolean;
  daysSkipped: number;
  penaltyStarted: boolean;
  penaltyContinues: boolean;
  /** Streak length that was lost (0 = not broken). */
  streakLost: number;
}

export interface GameContextValue {
  status: GameStatus;
  error: string | null;
  /** Non-null when status is 'ready'. */
  state: GameState | null;
  today: DayKey;
  xpLocked: boolean;
  reminder: ReminderSettings;
  rolloverNotice: RolloverNotice | null;
  pendingLevelUp: LevelUpEvent | null;
  /** First defeated boss waiting to be shown (personal record beaten). */
  pendingBoss: RecordEvent | null;
  /** Today's rest/sick mark, if any. */
  restDayToday: RestDay | null;
  /** Whether today can be marked as rest/sick day (null before onboarding). */
  restDayEligibility: RestDayEligibility | null;
  /** Increments after every write; use as a dependency to refetch history. */
  dataVersion: number;
  /** Dev-only: days added to the real clock (always 0 in release builds). */
  debugDayOffset: number;

  completeOnboarding(name: string, baseline: BaselineTest): Promise<void>;
  logWorkout(entries: ExerciseEntry[], startedAt?: number): Promise<LogResult>;
  allocatePoints(allocation: Partial<Stats>): Promise<void>;
  takeRankExam(results: BaselineTest): Promise<RankExamResult>;
  updateReminder(settings: ReminderSettings): Promise<{ permissionGranted: boolean }>;
  resetProgress(): Promise<void>;
  /** Re-checks the day (rollover) — e.g. on focus. */
  refresh(): Promise<void>;
  dismissRolloverNotice(): void;
  acknowledgeLevelUp(): void;
  acknowledgeBoss(): void;
  /** Marks today as rest/sick day: no penalty, streak kept (docs §13). */
  markRestDay(kind: RestDayKind): Promise<void>;
  unmarkRestDay(): Promise<void>;
  /** Dev-only: advance the simulated clock by `days` (to test rollover/penalty). */
  debugAdvanceDay(days?: number): Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

const REMINDER_KEY = 'reminder';
const DEBUG_OFFSET_KEY = 'debug_day_offset';
const MS_PER_DAY = 86_400_000;

function parseReminder(text: string | null): ReminderSettings {
  if (!text) return DEFAULT_REMINDER;
  try {
    const raw = JSON.parse(text) as Partial<ReminderSettings>;
    const hour = typeof raw.hour === 'number' ? raw.hour : DEFAULT_REMINDER.hour;
    const minute = typeof raw.minute === 'number' ? raw.minute : DEFAULT_REMINDER.minute;
    if (!isValidReminderTime(hour, minute)) return DEFAULT_REMINDER;
    return { enabled: raw.enabled !== false, hour, minute };
  } catch {
    return DEFAULT_REMINDER;
  }
}

function noticeFromEvents(events: RolloverEvent[]): RolloverNotice | null {
  const notice: RolloverNotice = {
    failedDaily: false,
    excusedDaily: false,
    daysSkipped: 0,
    penaltyStarted: false,
    penaltyContinues: false,
    streakLost: 0,
  };
  for (const event of events) {
    if (event.type === 'daily_failed' && !event.forgiven) notice.failedDaily = true;
    if (event.type === 'daily_excused') notice.excusedDaily = true;
    if (event.type === 'days_skipped') notice.daysSkipped = event.days;
    if (event.type === 'penalty_started') notice.penaltyStarted = true;
    if (event.type === 'penalty_continues') notice.penaltyContinues = true;
    if (event.type === 'streak_broken') notice.streakLost = event.previous;
  }
  const noteworthy =
    notice.failedDaily ||
    notice.excusedDaily ||
    notice.daysSkipped > 0 ||
    notice.penaltyStarted ||
    notice.penaltyContinues ||
    notice.streakLost > 0;
  return noteworthy ? notice : null;
}

function mergeLevelUp(prev: LevelUpEvent | null, next: LevelUpEvent): LevelUpEvent {
  if (!prev) return next;
  return {
    fromLevel: Math.min(prev.fromLevel, next.fromLevel),
    toLevel: Math.max(prev.toLevel, next.toLevel),
    pointsGained: prev.pointsGained + next.pointsGained,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();

  const [status, setStatus] = useState<GameStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [rolloverNotice, setRolloverNotice] = useState<RolloverNotice | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpEvent | null>(null);
  const [bossQueue, setBossQueue] = useState<RecordEvent[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [debugDayOffset, setDebugDayOffset] = useState(0);
  const [today, setToday] = useState<DayKey>(() => toDayKey(Date.now()));

  // Refs hold the latest values for async actions (avoid stale closures).
  const stateRef = useRef<GameState | null>(null);
  const reminderRef = useRef<ReminderSettings>(DEFAULT_REMINDER);
  const offsetRef = useRef(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const now = useCallback(() => Date.now() + offsetRef.current * MS_PER_DAY, []);

  /** Serializes all mutations so rollover and logging never interleave. */
  const exclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const commit = useCallback((next: GameState | null) => {
    stateRef.current = next;
    setState(next);
    setDataVersion((v) => v + 1);
  }, []);

  const scheduleReminders = useCallback(async () => {
    const current = stateRef.current;
    if (!current) {
      await syncReminders([]);
      return;
    }
    const todayKey = toDayKey(now());
    const plan = buildReminderPlan({
      now: now(),
      settings: reminderRef.current,
      todayQuestDone: current.dailyQuest?.dayKey === todayKey && current.dailyQuest.status === 'completed',
      penaltyActive: isXpLocked(current),
      todayRest: findRestDay(current.restDays, todayKey) !== undefined,
    });
    await syncReminders(plan);
  }, [now]);

  /** Applies the day rollover for the current (possibly simulated) day and persists it. */
  const runRollover = useCallback(async () => {
    const current = stateRef.current;
    const todayKey = toDayKey(now());
    setToday(todayKey);
    if (!current) return;
    const result = rolloverDay(current, todayKey);
    if (!result.changed) return;
    await saveGameState(db, result.state, { archived: result.archived, now: now() });
    commit(result.state);
    const notice = noticeFromEvents(result.events);
    if (notice) setRolloverNotice(notice);
    await scheduleReminders();
  }, [commit, db, now, scheduleReminders]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    void exclusive(async () => {
      try {
        const [loaded, reminderText, offsetText] = await Promise.all([
          loadGameState(db),
          getSetting(db, REMINDER_KEY),
          getSetting(db, DEBUG_OFFSET_KEY),
        ]);
        if (cancelled) return;
        const offset = __DEV__ ? Number(offsetText ?? 0) || 0 : 0;
        offsetRef.current = offset;
        setDebugDayOffset(offset);
        const settings = parseReminder(reminderText);
        reminderRef.current = settings;
        setReminder(settings);
        stateRef.current = loaded;
        setState(loaded);
        if (loaded) {
          await runRollover();
          await scheduleReminders();
          setStatus('ready');
        } else {
          setStatus('onboarding');
        }
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, exclusive, runRollover, scheduleReminders]);

  // Rollover when returning to the foreground and at local midnight.
  useEffect(() => {
    if (status !== 'ready') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void exclusive(runRollover);
    });
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => {
        void exclusive(runRollover);
        arm();
      }, msUntilNextMidnight(now()) + 500);
    };
    arm();
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [exclusive, now, runRollover, status]);

  const completeOnboarding = useCallback(
    (name: string, baseline: BaselineTest) =>
      exclusive(async () => {
        const todayKey = toDayKey(now());
        const initial = createInitialState(name, baseline, todayKey);
        await saveGameState(db, initial, { now: now() });
        commit(initial);
        setToday(todayKey);
        setStatus('ready');
        if (reminderRef.current.enabled) await ensureNotificationPermission();
        await scheduleReminders();
      }),
    [commit, db, exclusive, now, scheduleReminders],
  );

  const logWorkout = useCallback(
    (entries: ExerciseEntry[], startedAt?: number) =>
      exclusive(async () => {
        await runRollover();
        const current = stateRef.current;
        if (!current) throw new Error('Oyuncu bulunamadı.');
        const endedAt = now();
        const result = applyExerciseLogs(current, entries, endedAt);
        await saveWorkout(db, result.state, {
          dayKey: toDayKey(endedAt),
          startedAt: startedAt ?? endedAt,
          endedAt,
          entries,
          entryXp: result.entryXp,
          entryRecord: result.entryRecord,
          xpLocked: result.xpLocked,
        });
        commit(result.state);
        const bosses = result.recordEvents.filter((e) => e.boss);
        if (bosses.length > 0) setBossQueue((prev) => [...prev, ...bosses]);
        if (result.levelsGained > 0) {
          const event = { fromLevel: result.fromLevel, toLevel: result.toLevel, pointsGained: result.pointsGained };
          setPendingLevelUp((prev) => mergeLevelUp(prev, event));
        }
        if (result.completedQuests.length > 0) await scheduleReminders();
        return result;
      }),
    [commit, db, exclusive, now, runRollover, scheduleReminders],
  );

  const allocatePoints = useCallback(
    (allocation: Partial<Stats>) =>
      exclusive(async () => {
        const current = stateRef.current;
        if (!current) throw new Error('Oyuncu bulunamadı.');
        const next: GameState = { ...current, player: allocateStatPoints(current.player, allocation) };
        await saveGameState(db, next, { now: now() });
        commit(next);
      }),
    [commit, db, exclusive, now],
  );

  const takeRankExam = useCallback(
    (results: BaselineTest) =>
      exclusive(async () => {
        await runRollover();
        const current = stateRef.current;
        if (!current) throw new Error('Oyuncu bulunamadı.');
        const takenAt = now();
        const todayKey = toDayKey(takenAt);
        const result = submitRankExam(current, results, todayKey);
        await saveRankExam(db, result.state, {
          targetRank: result.evaluation.target,
          results,
          passed: result.evaluation.passed,
          dayKey: todayKey,
          takenAt,
        });
        commit(result.state);
        if (result.levelsGained > 0) {
          const event = { fromLevel: result.fromLevel, toLevel: result.toLevel, pointsGained: result.pointsGained };
          setPendingLevelUp((prev) => mergeLevelUp(prev, event));
        }
        return result;
      }),
    [commit, db, exclusive, now, runRollover],
  );

  const updateReminder = useCallback(
    (settings: ReminderSettings) =>
      exclusive(async () => {
        if (!isValidReminderTime(settings.hour, settings.minute)) throw new Error('Geçersiz saat.');
        let permissionGranted = true;
        if (settings.enabled) permissionGranted = await ensureNotificationPermission();
        await setSetting(db, REMINDER_KEY, JSON.stringify(settings));
        reminderRef.current = settings;
        setReminder(settings);
        await scheduleReminders();
        return { permissionGranted };
      }),
    [db, exclusive, scheduleReminders],
  );

  const resetProgress = useCallback(
    () =>
      exclusive(async () => {
        await resetAllData(db);
        await setSetting(db, DEBUG_OFFSET_KEY, '0');
        offsetRef.current = 0;
        setDebugDayOffset(0);
        commit(null);
        setPendingLevelUp(null);
        setBossQueue([]);
        setRolloverNotice(null);
        setStatus('onboarding');
        await syncReminders([]);
      }),
    [commit, db, exclusive],
  );

  const refresh = useCallback(() => exclusive(runRollover), [exclusive, runRollover]);

  const markRestDay = useCallback(
    (kind: RestDayKind) =>
      exclusive(async () => {
        await runRollover();
        const current = stateRef.current;
        if (!current) throw new Error('Oyuncu bulunamadı.');
        const todayKey = toDayKey(now());
        const next = markRestDayRule(current, todayKey, kind);
        await saveRestDay(db, next, { dayKey: todayKey, kind, now: now() });
        commit(next);
        await scheduleReminders();
      }),
    [commit, db, exclusive, now, runRollover, scheduleReminders],
  );

  const unmarkRestDay = useCallback(
    () =>
      exclusive(async () => {
        await runRollover();
        const current = stateRef.current;
        if (!current) throw new Error('Oyuncu bulunamadı.');
        const todayKey = toDayKey(now());
        const next = unmarkRestDayRule(current, todayKey);
        if (next === current) return;
        await saveRestDay(db, next, { dayKey: todayKey, kind: null, now: now() });
        commit(next);
        await scheduleReminders();
      }),
    [commit, db, exclusive, now, runRollover, scheduleReminders],
  );

  const debugAdvanceDay = useCallback(
    (days = 1) =>
      exclusive(async () => {
        if (!__DEV__) return;
        const offset = offsetRef.current + days;
        await setSetting(db, DEBUG_OFFSET_KEY, String(offset));
        offsetRef.current = offset;
        setDebugDayOffset(offset);
        await runRollover();
      }),
    [db, exclusive, runRollover],
  );

  // Dev-only (web preview / automated screenshots): window.__solomuscleDev
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web') return;
    const target = globalThis as unknown as Record<string, unknown>;
    target.__solomuscleDev = {
      seed: (name = 'Test Oyuncu', baseline: BaselineTest = { pushups: 15, situps: 20, squats: 25, plankSeconds: 45 }) =>
        completeOnboarding(name, baseline),
      log: (entries: ExerciseEntry[]) => logWorkout(entries),
      advanceDay: (days = 1) => debugAdvanceDay(days),
      allocate: (allocation: Partial<Stats>) => allocatePoints(allocation),
      rest: (kind: RestDayKind = 'rest') => markRestDay(kind),
      getState: () => stateRef.current,
    };
    return () => {
      delete target.__solomuscleDev;
    };
  }, [allocatePoints, completeOnboarding, debugAdvanceDay, logWorkout, markRestDay]);

  const dismissRolloverNotice = useCallback(() => setRolloverNotice(null), []);
  const acknowledgeLevelUp = useCallback(() => setPendingLevelUp(null), []);
  const acknowledgeBoss = useCallback(() => setBossQueue((prev) => prev.slice(1)), []);

  const restDayToday = state ? (findRestDay(state.restDays, today) ?? null) : null;
  const restDayEligibility = state ? getRestDayEligibility(state, today) : null;
  const pendingBoss = bossQueue[0] ?? null;

  const value = useMemo<GameContextValue>(
    () => ({
      status,
      error,
      state,
      today,
      xpLocked: state ? isXpLocked(state) : false,
      reminder,
      rolloverNotice,
      pendingLevelUp,
      pendingBoss,
      restDayToday,
      restDayEligibility,
      dataVersion,
      debugDayOffset,
      completeOnboarding,
      logWorkout,
      allocatePoints,
      takeRankExam,
      updateReminder,
      resetProgress,
      refresh,
      dismissRolloverNotice,
      acknowledgeLevelUp,
      acknowledgeBoss,
      markRestDay,
      unmarkRestDay,
      debugAdvanceDay,
    }),
    [
      status,
      error,
      state,
      today,
      reminder,
      rolloverNotice,
      pendingLevelUp,
      pendingBoss,
      restDayToday,
      restDayEligibility,
      dataVersion,
      debugDayOffset,
      completeOnboarding,
      logWorkout,
      allocatePoints,
      takeRankExam,
      updateReminder,
      resetProgress,
      refresh,
      dismissRolloverNotice,
      acknowledgeLevelUp,
      acknowledgeBoss,
      markRestDay,
      unmarkRestDay,
      debugAdvanceDay,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

/** Convenience for screens rendered only when the player exists. */
export function useGameState(): GameState {
  const { state } = useGame();
  if (!state) throw new Error('useGameState called before onboarding finished');
  return state;
}
