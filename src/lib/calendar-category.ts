import type { CalendarRule, CatColor } from "./types";

/**
 * Reading meaning out of your Google Calendar.
 *
 * Time you booked on your own calendar is still time you planned, so it should
 * count toward the reality score — but the app has no idea what "Robotics
 * 4:00–5:30" belongs to. Rather than guess, you keep a short list of keywords,
 * each carrying a colour and the category its time counts toward.
 *
 * One list does both jobs on purpose. A calendar that looks right and a
 * calendar that scores right should not be two separate things to maintain —
 * the moment they are, one of them goes stale.
 *
 * An event matching nothing is left alone: no colour, and no place in the
 * reality score. A denominator should only hold time you meant as work, and
 * sweeping in every dentist appointment would quietly punish you for having a
 * life, which is the opposite of what the score is for.
 */

/**
 * Just the category, for the scoring path.
 *
 * Miscellaneous events are coloured but never counted: "Doctor Appointment"
 * is not work you planned and skipping it is not a broken promise, so it has
 * no business in the reality score's denominator.
 */
export function categorizeEvent(
  summary: string,
  rules: CalendarRule[],
): string | null {
  const rule = firstMatchingRule(summary, rules);
  return rule?.categoryId ? rule.categoryId : null;
}

/** Events that matched a rule carrying a category, tagged with it. */
export function categorizedEvents<T extends { summary: string }>(
  events: T[],
  rules: CalendarRule[],
): Array<T & { categoryId: string }> {
  const out: Array<T & { categoryId: string }> = [];
  for (const event of events) {
    const categoryId = categorizeEvent(event.summary, rules);
    if (categoryId) out.push({ ...event, categoryId });
  }
  return out;
}

/** The swatches available to a rule, in band order, neutral last. */
export const RULE_COLORS: CatColor[] = [
  "amber",
  "clay",
  "olive",
  "teal",
  "steel",
  "plum",
  "slate",
];

/** What an event with no matching rule is called. */
export const MISC_LABEL = "MISCELLANEOUS";

/** Used when the profile has no miscellaneous colour set yet. */
export const DEFAULT_MISC_COLOR: CatColor = "slate";

export interface EventStyle {
  color: CatColor;
  /** The keyword that claimed it, or MISC_LABEL. */
  label: string;
  /** Category the time counts toward; empty for miscellaneous or colour-only rules. */
  categoryId: string;
  misc: boolean;
}

/**
 * The one place an event's colour is decided.
 *
 * Every calendar block on every screen calls this rather than reaching for a
 * palette of its own — the whole point of a configurable rule list is that
 * changing a colour in Settings changes it everywhere, which stops being true
 * the moment one component hardcodes its own answer.
 *
 * Nothing matching is a classification too, not a failure: the event becomes
 * MISCELLANEOUS and takes the colour configured for it, so an unclassified
 * event still reads as deliberate rather than broken.
 */
export function resolveEventStyle(
  summary: string,
  rules: CalendarRule[],
  miscColor: CatColor = DEFAULT_MISC_COLOR,
): EventStyle {
  const rule = firstMatchingRule(summary, rules);
  if (!rule) {
    return { color: miscColor, label: MISC_LABEL, categoryId: "", misc: true };
  }
  return {
    color: rule.color,
    label: rule.keyword.trim() || MISC_LABEL,
    categoryId: rule.categoryId,
    misc: false,
  };
}

/** The winning rule for a title: first in list order, so order is priority. */
export function firstMatchingRule(
  summary: string,
  rules: CalendarRule[],
): CalendarRule | null {
  const haystack = summary.toLowerCase();
  for (const rule of rules) {
    const needle = rule.keyword.trim().toLowerCase();
    if (needle && haystack.includes(needle)) return rule;
  }
  return null;
}
