import { addDays, startOfWeek, subDays } from "date-fns";
import { atHour, dayKey } from "./time";
import type {
  Category,
  Goal,
  LogEntry,
  Profile,
  StreakState,
  Task,
} from "./types";

/**
 * Seed data is deliberately real: these are the actual categories, courses and
 * research threads this is being built for. Nothing here says "Category One".
 */

export const SEED_CATEGORIES: Category[] = [
  { id: "phys", name: "Physics H + HSR", short: "PHYS", color: "olive", weeklyTargetHours: 6 },
  { id: "ml", name: "ML research", short: "ML", color: "teal", weeklyTargetHours: 5 },
  { id: "math", name: "Pre-calc H", short: "MATH", color: "amber", weeklyTargetHours: 4 },
  { id: "hum", name: "AP Lang + APUSH", short: "HUM", color: "plum", weeklyTargetHours: 5 },
  { id: "cs", name: "AP CS", short: "CS", color: "steel", weeklyTargetHours: 3 },
  { id: "sat", name: "SAT + college", short: "SAT", color: "clay", weeklyTargetHours: 3 },
];

export const SEED_PROFILE: Profile = {
  name: "Iason",
  weekStartsOn: 1,
  dayStartHour: 7,
  dayEndHour: 23,
  remindersEnabled: true,
  remindLeadMin: 10,
  calendarConnected: false,
};

let n = 0;
const id = (p: string) => `${p}-${(++n).toString(36)}`;

type Spec = Omit<Task, "id" | "createdAt"> & { id?: string };

export function buildSeed(now: Date) {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const today = now;

  const mk = (s: Spec): Task => ({
    id: s.id ?? id("t"),
    createdAt: subDays(now, 3).toISOString(),
    ...s,
  });

  const sched = (day: Date, h: number, m: number, lengthMin: number) => ({
    scheduledStart: atHour(day, h, m).toISOString(),
    scheduledEnd: new Date(
      atHour(day, h, m).getTime() + lengthMin * 60_000,
    ).toISOString(),
  });

  const tasks: Task[] = [
    /* ── today, scheduled ─────────────────────────────────── */
    mk({
      title: "Rotational dynamics — problems 1–18",
      categoryId: "phys",
      quadrant: "q1",
      estimateMin: 60,
      status: "done",
      completedAt: atHour(today, 8, 5).toISOString(),
      actualMin: 55,
      ...sched(today, 7, 15, 60),
    }),
    mk({
      title: "APUSH ch. 14 — reading + margin notes",
      categoryId: "hum",
      quadrant: "q1",
      estimateMin: 45,
      status: "done",
      completedAt: atHour(today, 9, 40).toISOString(),
      ...sched(today, 8, 45, 45),
    }),
    mk({
      title: "Gamma analysis — rerun DVH feature extraction",
      categoryId: "ml",
      quadrant: "q2",
      estimateMin: 90,
      status: "open",
      goalId: "g-gamma",
      notes:
        "Drop the two outlier plans first. Chang wants the pass-rate spread by energy, not pooled.",
      ...sched(today, 15, 30, 90),
    }),
    mk({
      title: "AP Lang — rhetorical analysis draft",
      categoryId: "hum",
      quadrant: "q2",
      estimateMin: 60,
      status: "open",
      ...sched(today, 17, 30, 60),
    }),
    mk({
      title: "Unit circle problem set",
      categoryId: "math",
      quadrant: "q1",
      estimateMin: 45,
      status: "open",
      ...sched(today, 19, 0, 45),
    }),

    /* ── today, unscheduled queue ─────────────────────────── */
    mk({
      title: "HSR — rewrite Discussion stats paragraph (two-way ANOVA)",
      categoryId: "phys",
      quadrant: "q2",
      estimateMin: 75,
      status: "open",
      goalId: "g-hsr",
      notes: "Interaction term is the whole story — lead with it, not the mains.",
    }),
    mk({
      title: "ArrayList lab — finish the Simon refactor",
      categoryId: "cs",
      quadrant: "q2",
      estimateMin: 60,
      status: "open",
    }),
    mk({
      title: "Timed SAT reading section + review misses",
      categoryId: "sat",
      quadrant: "q2",
      estimateMin: 55,
      status: "open",
      goalId: "g-sat",
    }),
    mk({
      title: "Chase Journalism photo credits before layout",
      categoryId: "hum",
      quadrant: "q3",
      estimateMin: 20,
      status: "open",
    }),
    mk({
      title: "Reorganise the Drive folders",
      categoryId: "cs",
      quadrant: "q4",
      estimateMin: 30,
      status: "open",
    }),
    mk({
      title: "Email Yves about the IBA observation write-up",
      categoryId: "phys",
      quadrant: "q1",
      estimateMin: 15,
      status: "open",
    }),

    /* ── ahead of today (offsets from today, so nothing ever
          collides with the blocks already on today) ────────── */
    mk({
      title: "Chang group Zoom",
      categoryId: "ml",
      quadrant: "q1",
      estimateMin: 60,
      status: "open",
      ...sched(addDays(today, 1), 16, 0, 60),
    }),
    mk({
      title: "Physics H — lab write-up",
      categoryId: "phys",
      quadrant: "q1",
      estimateMin: 75,
      status: "open",
      ...sched(addDays(today, 1), 17, 30, 75),
    }),
    mk({
      title: "Gamma analysis — energy-split plots for Chang",
      categoryId: "ml",
      quadrant: "q2",
      estimateMin: 90,
      status: "open",
      goalId: "g-gamma",
      ...sched(addDays(today, 2), 15, 0, 90),
    }),
    mk({
      title: "SAT webinar",
      categoryId: "sat",
      quadrant: "q3",
      estimateMin: 60,
      status: "open",
      ...sched(addDays(today, 2), 18, 0, 60),
    }),
    mk({
      title: "APUSH DBQ practice, timed",
      categoryId: "hum",
      quadrant: "q2",
      estimateMin: 60,
      status: "open",
      ...sched(addDays(today, 3), 16, 0, 60),
    }),
    mk({
      title: "Pre-calc — trig identities review",
      categoryId: "math",
      quadrant: "q2",
      estimateMin: 45,
      status: "open",
      ...sched(addDays(today, 3), 17, 30, 45),
    }),
    mk({
      title: "HSR — figure 3 remake at 300 dpi",
      categoryId: "phys",
      quadrant: "q2",
      estimateMin: 60,
      status: "open",
      goalId: "g-hsr",
      ...sched(addDays(today, 4), 10, 0, 60),
    }),
    mk({
      title: "Full SAT practice test",
      categoryId: "sat",
      quadrant: "q2",
      estimateMin: 180,
      status: "open",
      goalId: "g-sat",
      ...sched(addDays(today, 5), 9, 0, 180),
    }),

    /* ── earlier this week, banked ────────────────────────── */
    ...bankedEarlierThisWeek(monday, today, mk, sched),
  ];

  const goals: Goal[] = [
    {
      id: "g-hsr",
      title: "HSR paper — Discussion section",
      categoryId: "phys",
      target: 5,
      current: 3,
      unit: "subsections",
      due: addDays(now, 24).toISOString(),
    },
    {
      id: "g-gamma",
      title: "Gamma-analysis model v2",
      categoryId: "ml",
      target: 10,
      current: 6,
      unit: "experiments",
      due: addDays(now, 45).toISOString(),
    },
    {
      id: "g-sat",
      title: "SAT practice tests before November",
      categoryId: "sat",
      target: 8,
      current: 2,
      unit: "tests",
      due: addDays(now, 80).toISOString(),
    },
  ];

  const log: LogEntry[] = [
    {
      id: "l-1",
      date: dayKey(subDays(now, 1)),
      energy: 4,
      body: "Cleared the rotational dynamics set faster than expected — the moment-of-inertia table is finally stuck. Lost the back half of the evening to the Drive reorganisation, which was Q4 and I knew it was Q4 while I was doing it.",
      createdAt: subDays(now, 1).toISOString(),
    },
    {
      id: "l-2",
      date: dayKey(subDays(now, 2)),
      energy: 3,
      body: "Chang call: he wants the pass rates split by beam energy before we say anything about the model. Fair. Two hours of feature extraction is the price.",
      createdAt: subDays(now, 2).toISOString(),
    },
    {
      id: "l-3",
      date: dayKey(subDays(now, 4)),
      energy: 5,
      body: "Discussion section finally reads like a paper and not like notes. The ANOVA interaction paragraph took three attempts.",
      createdAt: subDays(now, 4).toISOString(),
    },
  ];

  const streak: StreakState = {
    current: 11,
    longest: 18,
    freezesUsed: 1,
    freezesPerWeek: 2,
    lastActiveDate: dayKey(now),
    frozenDates: [dayKey(subDays(now, 3))],
  };

  return { tasks, goals, log, streak, xp: 2140 };
}

function bankedEarlierThisWeek(
  monday: Date,
  today: Date,
  mk: (s: Spec) => Task,
  sched: (d: Date, h: number, m: number, l: number) => Partial<Task>,
): Task[] {
  const out: Task[] = [];
  const plan: [number, string, string, Task["quadrant"], number, number][] = [
    [0, "Pre-calc — sequences problem set", "math", "q1", 45, 16],
    [0, "AP Lang — annotate Didion essay", "hum", "q2", 50, 18],
    [0, "Physics H — kinematics review", "phys", "q1", 60, 20],
    [1, "Gamma analysis — clean the plan export", "ml", "q2", 90, 15],
    [1, "APUSH — Ch. 13 outline", "hum", "q1", 45, 19],
    [2, "AP CS — recursion worksheet", "cs", "q2", 60, 17],
    [2, "HSR — statistics rewrite pass 1", "phys", "q2", 75, 19],
    [3, "Pre-calc — quiz corrections", "math", "q1", 30, 16],
  ];
  for (const [offset, title, categoryId, quadrant, len, hour] of plan) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + offset);
    if (dayKey(day) >= dayKey(today)) continue;
    out.push(
      mk({
        title,
        categoryId,
        quadrant,
        estimateMin: len,
        status: "done",
        completedAt: new Date(
          atHour(day, hour).getTime() + len * 60_000,
        ).toISOString(),
        ...sched(day, hour, 0, len),
      }),
    );
  }
  return out;
}
