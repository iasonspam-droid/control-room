import { DEFAULT_MISC_COLOR } from "./calendar-category";
import type { CalendarRule, Category, Profile } from "./types";

/**
 * What a brand-new account starts with.
 *
 * Deliberately NOT the demo seed in seed.ts — that one is full of one specific
 * person's coursework (Physics H, the Chang research thread, APUSH). Great as a
 * showcase on the signed-out landing path, actively confusing as the first thing
 * a stranger sees in their own account.
 *
 * So: the two categories the whole app is pitched around — School and ECs —
 * an empty board, and a zeroed score. No fake streak, no borrowed XP; the
 * numbers should be honestly theirs from the first task. Both are ordinary
 * categories, renameable and deletable like any other, and nothing stops
 * someone adding a third.
 */
export const STARTER_CATEGORIES: Category[] = [
  {
    id: "school",
    name: "School",
    short: "SCHOOL",
    color: "olive",
    weeklyTargetHours: 20,
  },
  { id: "ecs", name: "ECs", short: "ECS", color: "teal", weeklyTargetHours: 10 },
];

/**
 * Enough calendar rules to make the first sync look like something, ordered
 * specific-before-general since the first match wins. All of them are meant to
 * be edited — they are a starting point, not a taxonomy.
 */
export const STARTER_CALENDAR_RULES: CalendarRule[] = [
  { id: "r-class", keyword: "class", color: "olive", categoryId: "school" },
  { id: "r-lecture", keyword: "lecture", color: "olive", categoryId: "school" },
  { id: "r-exam", keyword: "exam", color: "clay", categoryId: "school" },
  { id: "r-study", keyword: "study", color: "steel", categoryId: "school" },
  { id: "r-lab", keyword: "lab", color: "teal", categoryId: "school" },
  { id: "r-research", keyword: "research", color: "plum", categoryId: "ecs" },
  { id: "r-robotics", keyword: "robotics", color: "amber", categoryId: "ecs" },
  { id: "r-club", keyword: "club", color: "amber", categoryId: "ecs" },
  { id: "r-practice", keyword: "practice", color: "clay", categoryId: "ecs" },
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
    calendarRules: STARTER_CALENDAR_RULES,
    calendarMiscColor: DEFAULT_MISC_COLOR,
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
