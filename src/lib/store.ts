"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildSeed, SEED_CATEGORIES, SEED_PROFILE } from "./seed";
import { dayKey } from "./time";
import type {
  Category,
  Goal,
  LogEntry,
  Profile,
  Quadrant,
  StreakState,
  Task,
} from "./types";
import { LOG_ENTRY_XP, taskXp } from "./xp";

export interface XpEvent {
  id: string;
  at: string;
  amount: number;
  label: string;
  kind: "task" | "log" | "goal";
}

/** "local" = signed-out demo in this browser. "cloud" = a real account. */
export type StoreMode = "local" | "cloud";
export type SyncStatus = "idle" | "loading" | "saving" | "error";

interface State {
  ready: boolean;
  mode: StoreMode;
  /** Whose data is loaded, so a second sign-in on the same browser can't inherit it. */
  ownerId: string | null;
  syncStatus: SyncStatus;
  syncMessage?: string;

  profile: Profile;
  categories: Category[];
  tasks: Task[];
  goals: Goal[];
  log: LogEntry[];
  streak: StreakState;
  xp: number;
  events: XpEvent[];

  hydrate: () => void;
  reseed: () => void;
  /** Replace everything with a signed-in user's server state. */
  adoptRemote: (
    userId: string,
    data: Partial<
      Pick<
        State,
        "profile" | "categories" | "tasks" | "goals" | "log" | "streak" | "xp" | "events"
      >
    >,
  ) => void;
  /** Drop back to the signed-out demo, wiping whatever the account had loaded. */
  releaseRemote: () => void;
  setSync: (status: SyncStatus, message?: string) => void;

  addTask: (t: Partial<Task> & { title: string; categoryId: string }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string, actualMin?: number) => void;
  uncompleteTask: (id: string) => void;
  setQuadrant: (id: string, q: Quadrant) => void;
  schedule: (id: string, startIso: string, minutes: number) => void;
  unschedule: (id: string) => void;

  saveLog: (date: string, body: string, energy?: LogEntry["energy"]) => void;

  addGoal: (g: Omit<Goal, "id">) => void;
  bumpGoal: (id: string, delta: number) => void;
  removeGoal: (id: string) => void;

  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;

  setProfile: (patch: Partial<Profile>) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function award(
  state: State,
  amount: number,
  label: string,
  kind: XpEvent["kind"],
) {
  return {
    xp: state.xp + amount,
    events: [
      { id: uid(), at: new Date().toISOString(), amount, label, kind },
      ...state.events,
    ].slice(0, 60),
  };
}

/** A day counts toward the streak if anything was finished or written. */
function recomputeStreak(state: State, streak: StreakState): StreakState {
  const today = dayKey(new Date());
  if (streak.lastActiveDate === today) return streak;
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  const continues =
    streak.lastActiveDate === yesterday ||
    streak.frozenDates.includes(yesterday);
  const current = continues ? streak.current + 1 : 1;
  return {
    ...streak,
    current,
    longest: Math.max(streak.longest, current),
    lastActiveDate: today,
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ready: false,
      mode: "local" as StoreMode,
      ownerId: null,
      syncStatus: "idle" as SyncStatus,
      profile: SEED_PROFILE,
      categories: SEED_CATEGORIES,
      tasks: [],
      goals: [],
      log: [],
      streak: {
        current: 0,
        longest: 0,
        freezesUsed: 0,
        freezesPerWeek: 2,
        frozenDates: [],
      },
      xp: 0,
      events: [],

      adoptRemote: (userId, data) =>
        set({
          mode: "cloud",
          ownerId: userId,
          ready: true,
          syncStatus: "idle",
          syncMessage: undefined,
          ...data,
        }),

      releaseRemote: () => {
        const s = buildSeed(new Date());
        set({
          mode: "local",
          ownerId: null,
          syncStatus: "idle",
          syncMessage: undefined,
          categories: SEED_CATEGORIES,
          profile: SEED_PROFILE,
          tasks: s.tasks,
          goals: s.goals,
          log: s.log,
          streak: s.streak,
          xp: s.xp,
          events: [],
          ready: true,
        });
      },

      setSync: (syncStatus, syncMessage) => set({ syncStatus, syncMessage }),

      hydrate: () => {
        // In cloud mode the server is authoritative; the sync hook fills state in.
        if (get().mode === "cloud") return;
        if (get().ready) return;
        if (get().tasks.length === 0) {
          const s = buildSeed(new Date());
          set({
            tasks: s.tasks,
            goals: s.goals,
            log: s.log,
            streak: s.streak,
            xp: s.xp,
            ready: true,
          });
        } else {
          set({ ready: true });
        }
      },

      reseed: () => {
        const s = buildSeed(new Date());
        set({
          categories: SEED_CATEGORIES,
          profile: SEED_PROFILE,
          tasks: s.tasks,
          goals: s.goals,
          log: s.log,
          streak: s.streak,
          xp: s.xp,
          events: [],
          ready: true,
        });
      },

      addTask: (t) =>
        set((s) => ({
          tasks: [
            {
              id: uid(),
              quadrant: "q2",
              estimateMin: 30,
              status: "open",
              createdAt: new Date().toISOString(),
              ...t,
            } as Task,
            ...s.tasks,
          ],
        })),

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      completeTask: (id, actualMin) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task || task.status === "done") return {};
          const minutes = actualMin ?? task.estimateMin;
          const amount = taskXp(minutes, task.quadrant);
          return {
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: "done",
                    completedAt: new Date().toISOString(),
                    actualMin: minutes,
                  }
                : t,
            ),
            streak: recomputeStreak(s, s.streak),
            ...award(s, amount, task.title, "task"),
          };
        }),

      uncompleteTask: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task || task.status !== "done") return {};
          const amount = taskXp(task.actualMin ?? task.estimateMin, task.quadrant);
          return {
            tasks: s.tasks.map((t) =>
              t.id === id
                ? { ...t, status: "open", completedAt: undefined }
                : t,
            ),
            xp: Math.max(0, s.xp - amount),
          };
        }),

      setQuadrant: (id, q) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, quadrant: q } : t)),
        })),

      schedule: (id, startIso, minutes) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  scheduledStart: startIso,
                  scheduledEnd: new Date(
                    new Date(startIso).getTime() + minutes * 60_000,
                  ).toISOString(),
                }
              : t,
          ),
        })),

      unschedule: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  scheduledStart: undefined,
                  scheduledEnd: undefined,
                  calendarEventId: undefined,
                }
              : t,
          ),
        })),

      saveLog: (date, body, energy) =>
        set((s) => {
          const existing = s.log.find((l) => l.date === date);
          if (existing) {
            return {
              log: s.log.map((l) =>
                l.date === date ? { ...l, body, energy } : l,
              ),
            };
          }
          return {
            log: [
              {
                id: uid(),
                date,
                body,
                energy,
                createdAt: new Date().toISOString(),
              },
              ...s.log,
            ],
            streak: recomputeStreak(s, s.streak),
            ...award(s, LOG_ENTRY_XP, "Log entry", "log"),
          };
        }),

      addGoal: (g) => set((s) => ({ goals: [...s.goals, { id: uid(), ...g }] })),

      bumpGoal: (id, delta) =>
        set((s) => {
          const goal = s.goals.find((g) => g.id === id);
          if (!goal) return {};
          const current = Math.max(0, Math.min(goal.target, goal.current + delta));
          const justFinished = current >= goal.target && !goal.done;
          return {
            goals: s.goals.map((g) =>
              g.id === id ? { ...g, current, done: current >= g.target } : g,
            ),
            ...(justFinished ? award(s, 100, `Goal: ${goal.title}`, "goal") : {}),
          };
        }),

      removeGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addCategory: (c) =>
        set((s) => ({ categories: [...s.categories, { id: uid(), ...c }] })),

      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),

      removeCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          tasks: s.tasks.filter((t) => t.categoryId !== id),
        })),

      setProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),
    }),
    {
      name: "control-room-v1",
      /**
       * Only the signed-out demo is written to localStorage. A real account's
       * tasks must never be left behind on a shared or borrowed browser — and
       * if they were, the next person to sign in here would start from a stale
       * blob of someone else's week before the server response landed.
       */
      partialize: (state) =>
        state.mode === "cloud"
          ? ({ mode: "cloud" } as unknown as State)
          : (({ ready: _ready, syncStatus: _s, syncMessage: _m, ...rest }) => rest)(
              state,
            ),
    },
  ),
);
