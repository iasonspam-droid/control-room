export type Quadrant = "q1" | "q2" | "q3" | "q4";

export type CatColor =
  | "amber"
  | "clay"
  | "olive"
  | "teal"
  | "steel"
  | "plum"
  | "slate";

export interface Category {
  id: string;
  name: string;
  /** 3–8 chars. Used under rings and in the week grid, where names don't fit. */
  short: string;
  color: CatColor;
  /** Hours you intend to put in per week. Drives the ring on Today and Week. */
  weeklyTargetHours: number;
  archived?: boolean;
}

/**
 * One rule for reading your Google Calendar.
 *
 * A keyword does two jobs at once: it gives the event a colour on the
 * timeline, and it says which category the time counts toward. Both come from
 * the same row so a calendar that looks right is also scored right — two
 * separate lists would drift apart the first time you edited one of them.
 */
export interface CalendarRule {
  id: string;
  /** Matched case-insensitively anywhere in the event title. */
  keyword: string;
  color: CatColor;
  /** Empty means "show it in this colour, but don't count it as planned work". */
  categoryId: string;
}

export type TaskStatus = "open" | "done" | "skipped";

export interface Task {
  id: string;
  title: string;
  categoryId: string;
  quadrant: Quadrant;
  estimateMin: number;
  /** ISO datetime. Present once the task has been dropped onto the calendar. */
  scheduledStart?: string;
  scheduledEnd?: string;
  /** Google Calendar event id, once the block has been written out. */
  calendarEventId?: string;
  status: TaskStatus;
  completedAt?: string;
  /** Minutes actually spent, if it differed from the estimate. */
  actualMin?: number;
  goalId?: string;
  notes?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  categoryId: string;
  target: number;
  current: number;
  unit: string;
  due?: string;
  done?: boolean;
}

export interface LogEntry {
  id: string;
  /** YYYY-MM-DD, local. One entry per day is what earns XP. */
  date: string;
  body: string;
  energy?: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}

export interface StreakState {
  current: number;
  longest: number;
  /** Freeze days spent this week. */
  freezesUsed: number;
  freezesPerWeek: number;
  /** YYYY-MM-DD of the last day that counted. */
  lastActiveDate?: string;
  /** Days covered by a freeze rather than real activity. */
  frozenDates: string[];
}

export interface Profile {
  name: string;
  weekStartsOn: 0 | 1;
  dayStartHour: number;
  dayEndHour: number;
  remindersEnabled: boolean;
  remindLeadMin: number;
  calendarConnected: boolean;
  calendarId?: string;
  /** Keyword → colour → category, in match order. See CalendarRule. */
  calendarRules?: CalendarRule[];
  /** Colour for events no rule claims — the MISCELLANEOUS bucket. */
  calendarMiscColor?: CatColor;
  /**
   * Google Calendar event ids ticked off as actually done.
   *
   * The app never writes to an event it didn't create, so completion for
   * external blocks has to live on this side. Without it a booked hour would
   * always count as an hour worked, and the reality score would only ever be
   * able to say 100%.
   */
  completedEventIds?: string[];
}
