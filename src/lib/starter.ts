import type { Category, Profile } from "./types";

/**
 * What a brand-new account starts with.
 *
 * Deliberately NOT the demo seed in seed.ts — that one is full of one specific
 * person's coursework (Physics H, the Chang research thread, APUSH). Great as a
 * showcase on the signed-out landing path, actively confusing as the first thing
 * a stranger sees in their own account.
 *
 * So: neutral categories broad enough that most people can rename rather than
 * rebuild, an empty board, and a zeroed score. No fake streak, no borrowed XP —
 * the numbers should be honestly theirs from the first task.
 */
export const STARTER_CATEGORIES: Category[] = [
  { id: "deep", name: "Deep work", short: "DEEP", color: "olive", weeklyTargetHours: 8 },
  { id: "study", name: "Study", short: "STUDY", color: "teal", weeklyTargetHours: 6 },
  { id: "admin", name: "Admin", short: "ADMIN", color: "steel", weeklyTargetHours: 2 },
  { id: "health", name: "Training", short: "TRAIN", color: "amber", weeklyTargetHours: 4 },
  { id: "read", name: "Reading", short: "READ", color: "plum", weeklyTargetHours: 3 },
  { id: "side", name: "Side project", short: "SIDE", color: "clay", weeklyTargetHours: 4 },
];

export function starterProfile(name?: string | null): Profile {
  return {
    name: name ?? "",
    weekStartsOn: 1,
    dayStartHour: 7,
    dayEndHour: 23,
    remindersEnabled: true,
    remindLeadMin: 10,
    calendarConnected: false,
  };
}

export function buildStarter(name?: string | null) {
  return {
    categories: STARTER_CATEGORIES,
    profile: starterProfile(name),
    tasks: [],
    goals: [],
    log: [],
    events: [],
    streak: {
      current: 0,
      longest: 0,
      freezesUsed: 0,
      freezesPerWeek: 2,
      frozenDates: [],
    },
    xp: 0,
  };
}
