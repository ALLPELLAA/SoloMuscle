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
  compareDayKeys,
  createInitialState,
  findRestDay,
  getRestDayEligibility,
  isExerciseId,
  isValidReminderTime,
  isValidRpe,
  isXpLocked,
  markRestDay as markRestDayRule,
  msUntilNextMidnight,
  rolloverDay,
  splitSetsAtDayChange,
  submitRankExam,
  toDayKey,
  unmarkRestDay as unmarkRestDayRule,
  validateExerciseAmount,
  withBaselineRecords,
  type BaselineTest,
  type DayKey,
  type ExerciseEntry,
  type ExerciseId,
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
  /** Sets of an unfinished workout that were saved to the previous day at the day change (docs §9). */
  autoSavedSets: number;
}

/** One set of the in-progress workout (persisted as a draft, docs §9). */
export interface DraftSet {
  key: number;
  exerciseId: ExerciseId;
  amount: number;
  /** null when the RPE was skipped. */
  rpe: number | null;
  /** Epoch ms (game clock) when the set was added — decides which day it counts for. */
  at: number;
}

export interface WorkoutDraft {
  /** Epoch ms of the first set (null while empty). */
  startedAt: number | null;
  sets: DraftSet[];
  nextKey: number;
}

export const EMPTY_DRAFT: WorkoutDraft = { startedAt: null, sets: [], nextKey: 1 };

/** Draft set in game-logic shape (rpe omitted when skipped). */
export function draftEntry({ exerciseId, amount, rpe }: Pick<DraftSet, 'exerciseId' | 'amount' | 'rpe'>): ExerciseEntry {
  return rpe === null ? { exerciseId, amount } : { exerciseId, amount, rpe };
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
  /** In-progress workout, persisted so it survives app restarts and the day change. */
  workoutDraft: WorkoutDraft;

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
  addDraftSet(set: Pick<DraftSet, 'exerciseId' | 'amount' | 'rpe'>): Promise<void>;
  removeDraftSet(key: number): Promise<void>;
  clearDraft(): Promise<void>;
  /** Dev-only: advance the simulated clock by `days` (to test rollover/penalty). */
  debugAdvanceDay(days?: number): Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

const REMINDER_KEY = 'reminder';
const DEBUG_OFFSET_KEY = 'debug_day_offset';
const DRAFT_KEY = 'workout_draft';
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

function parseDraft(text: string | null): WorkoutDraft {
  if (!text) return EMPTY_DRAFT;
  try {
    const raw = JSON.parse(text) as Partial<WorkoutDraft>;
    const sets: DraftSet[] = [];
    for (const item of Array.isArray(raw.sets) ? raw.sets : []) {
      if (!item || typeof item !== 'object') continue;
      const { key, exerciseId, amount, rpe, at } = item as Partial<DraftSet>;
      if (typeof exerciseId !== 'string' || !isExerciseId(exerciseId)) continue;
      if (typeof amount !== 'number' || validateExerciseAmount(exerciseId, amount) !== null) continue;
      if (typeof at !== 'number' || !Number.isFinite(at)) continue;
      sets.push({
        key: typeof key === 'number' ? key : sets.length + 1,
        exerciseId,
        amount,
        rpe: isValidRpe(rpe) ? rpe : null,
        at,
      });
    }
    const nextKey = Math.max(typeof raw.nextKey === 'number' ? raw.nextKey : 1, ...sets.map((s) => s.key + 1));
    return { sets, nextKey, startedAt: sets.length > 0 ? (typeof raw.startedAt === 'number' ? raw.startedAt : sets[0].at) : null };
  } catch {
    return EMPTY_DRAFT;
  }
}

function noticeFromEvents(events: RolloverEvent[], autoSavedSets = 0): RolloverNotice | null {
  const notice: RolloverNotice = {
    failedDaily: false,
    excusedDaily: false,
    daysSkipped: 0,
    penaltyStarted: false,
    penaltyContinues: false,
    streakLost: 0,
    autoSavedSets,
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
    notice.streakLost > 0 ||
    notice.autoSavedSets > 0;
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
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft>(EMPTY_DRAFT);

  // Refs hold the latest values for async actions (avoid stale closures).
  const stateRef = useRef<GameState | null>(null);
  const reminderRef = useRef<ReminderSettings>(DEFAULT_REMINDER);
  const offsetRef = useRef(0);
  const draftRef = useRef<WorkoutDraft>(EMPTY_DRAFT);
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

  const persistDraft = useCallback(
    async (next: WorkoutDraft) => {
      draftRef.current = next;
      setWorkoutDraft(next);
      await setSetting(db, DRAFT_KEY, JSON.stringify(next));
    },
    [db],
  );

  /**
   * Applies sets to the current game day, stores them as one workout session and queues
   * the resulting popups (bosses, level-up). Caller must hold the `exclusive` lock.
   */
  const recordSets = useCallback(
    async (current: GameState, entries: ExerciseEntry[], startedAt: number, endedAt: number): Promise<LogResult> => {
      const result = applyExerciseLogs(current, entries, endedAt);
      await saveWorkout(db, result.state, {
        dayKey: current.lastRolloverDay,
        startedAt,
        endedAt,
        entries,
        entryXp: result.entryXp,
        entryRecord: result.entryRecord,
        entryBoss: result.entryBoss,
        xpLocked: result.xpLocked,
      });
      commit(result.state);
      const bosses = result.recordEvents.filter((e) => e.boss);
      if (bosses.length > 0) setBossQueue((prev) => [...prev, ...bosses]);
      if (result.levelsGained > 0) {
        const event = { fromLevel: result.fromLevel, toLevel: result.toLevel, pointsGained: result.pointsGained };
        setPendingLevelUp((prev) => mergeLevelUp(prev, event));
      }
      return result;
    },
    [commit, db],
  );

  /** Applies the day rollover for the current (possibly simulated) day and persists it. */
  const runRollover = useCallback(async () => {
    let current = stateRef.current;
    const todayKey = toDayKey(now());
    setToday(todayKey);
    if (!current) return;

    // Sets of an unfinished workout count for the day they were added (docs §9):
    // save the previous day's sets before that day is closed.
    let autoSavedSets = 0;
    const draft = draftRef.current;
    if (compareDayKeys(todayKey, current.lastRolloverDay) > 0 && draft.sets.length > 0) {
      const { closing, remaining } = splitSetsAtDayChange(draft.sets, current.lastRolloverDay);
      if (closing.length > 0) {
        await recordSets(current, closing.map(draftEntry), draft.startedAt ?? closing[0].at, closing[closing.length - 1].at);
        current = stateRef.current ?? current;
        await persistDraft({ ...draft, sets: remaining, startedAt: remaining[0]?.at ?? null });
        autoSavedSets = closing.length;
      }
    }

    const result = rolloverDay(current, todayKey);
    if (!result.changed) return;
    await saveGameState(db, result.state, { archived: result.archived, now: now() });
    commit(result.state);
    const notice = noticeFromEvents(result.events, autoSavedSets);
    if (notice) setRolloverNotice(notice);
    await scheduleReminders();
  }, [commit, db, now, persistDraft, recordSets, scheduleReminders]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    void exclusive(async () => {
      try {
        const [stored, reminderText, offsetText, draftText] = await Promise.all([
          loadGameState(db),
          getSetting(db, REMINDER_KEY),
          getSetting(db, DEBUG_OFFSET_KEY),
          getSetting(db, DRAFT_KEY),
        ]);
        if (cancelled) return;
        let loaded = stored;
        if (loaded) {
          // Players from schema v1 have no records yet: seed them from the onboarding test (docs §10).
          const player = withBaselineRecords(loaded.player);
          if (player !== loaded.player) {
            loaded = { ...loaded, player };
            await saveGameState(db, loaded, { now: Date.now() });
          }
        }
        const draft = parseDraft(draftText);
        draftRef.current = draft;
        setWorkoutDraft(draft);
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
      if (next !== 'active') return;
      // Also re-plan reminders: permission may have been granted in system settings meanwhile.
      void exclusive(async () => {
        await runRollover();
        await scheduleReminders();
      });
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
  }, [exclusive, now, runRollover, scheduleReminders, status]);

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
        const result = await recordSets(current, entries, startedAt ?? endedAt, endedAt);
        if (result.completedQuests.length > 0) await scheduleReminders();
        return result;
      }),
    [exclusive, now, recordSets, runRollover, scheduleReminders],
  );

  const addDraftSet = useCallback(
    (set: Pick<DraftSet, 'exerciseId' | 'amount' | 'rpe'>) =>
      exclusive(async () => {
        const draft = draftRef.current;
        const at = now();
        await persistDraft({
          sets: [...draft.sets, { ...set, key: draft.nextKey, at }],
          startedAt: draft.startedAt ?? at,
          nextKey: draft.nextKey + 1,
        });
      }),
    [exclusive, now, persistDraft],
  );

  const removeDraftSet = useCallback(
    (key: number) =>
      exclusive(async () => {
        const draft = draftRef.current;
        const sets = draft.sets.filter((set) => set.key !== key);
        await persistDraft({ ...draft, sets, startedAt: sets.length > 0 ? draft.startedAt : null });
      }),
    [exclusive, persistDraft],
  );

  const clearDraft = useCallback(
    () => exclusive(() => persistDraft({ ...EMPTY_DRAFT, nextKey: draftRef.current.nextKey })),
    [exclusive, persistDraft],
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
        await persistDraft(EMPTY_DRAFT);
        setRolloverNotice(null);
        setStatus('onboarding');
        await syncReminders([]);
      }),
    [commit, db, exclusive, persistDraft],
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
      workoutDraft,
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
      addDraftSet,
      removeDraftSet,
      clearDraft,
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
      workoutDraft,
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
      addDraftSet,
      removeDraftSet,
      clearDraft,
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
