// One-to-one sessions are auto-split into fixed 50-min blocks with a 10-min
// break between each, across whatever window the pro sets per day.
export const SESSION_MINUTES = 50;
export const BREAK_MINUTES = 10;

export type TimeSlot = { start: string; end: string };

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toTimeString(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateSlots(startTime: string, endTime: string): TimeSlot[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots: TimeSlot[] = [];
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return slots;
  let cursor = start;
  while (cursor + SESSION_MINUTES <= end) {
    const slotEnd = cursor + SESSION_MINUTES;
    slots.push({ start: toTimeString(cursor), end: toTimeString(slotEnd) });
    cursor = slotEnd + BREAK_MINUTES;
  }
  return slots;
}

// Diffs the full auto-generated set for a window against what was actually
// saved, to figure out which slot start times a pro had clicked to remove.
// Used when loading an existing profile back into an editable form.
export function findRemovedSlotStarts(
  startTime: string,
  endTime: string,
  savedSlots: TimeSlot[],
): string[] {
  const savedStarts = new Set(savedSlots.map((s) => s.start));
  return generateSlots(startTime, endTime)
    .filter((s) => !savedStarts.has(s.start))
    .map((s) => s.start);
}


// ---------------------------------------------------------------------------
// 14-day (two week) booking window for one-to-one availability.
// Pros pick specific calendar dates instead of recurring weekdays.
// ---------------------------------------------------------------------------
export const BOOKING_HORIZON_DAYS = 14;

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Local (not UTC) YYYY-MM-DD, so dates don't shift by a day in timezones
// ahead of UTC such as Sri Lanka.
export function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type UpcomingDate = {
  date: string; // YYYY-MM-DD
  day: string; // "Mon"
  label: string; // "25 Monday"
  month: string; // "September"
};

function describeDate(d: Date): UpcomingDate {
  return {
    date: toLocalISODate(d),
    day: SHORT_WEEKDAYS[d.getDay()],
    label: `${d.getDate()} ${FULL_WEEKDAYS[d.getDay()]}`,
    month: d.toLocaleDateString("en-US", { month: "long" }),
  };
}

// Today plus the next 13 days (14 in total).
export function upcomingDates(count = BOOKING_HORIZON_DAYS): UpcomingDate[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return describeDate(d);
  });
}

// "25 Monday" for a YYYY-MM-DD string.
export function formatDateLabel(iso: string) {
  return describeDate(new Date(`${iso}T00:00:00`)).label;
}

export function weekdayShortFromDate(iso: string) {
  return SHORT_WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()];
}

// Dates inside the 14-day window that fall on the given weekday ("Mon").
// Used to convert older recurring-weekday availability into dated entries.
export function datesForWeekday(day: string, count = BOOKING_HORIZON_DAYS): string[] {
  return upcomingDates(count)
    .filter((d) => d.day === day)
    .map((d) => d.date);
}

// Key that identifies an availability entry: its date when it has one,
// otherwise the legacy weekday.
export function availabilityKey(a: { day: string; date?: string }) {
  return a.date ?? a.day;
}

export function availabilityLabel(a: { day: string; date?: string }) {
  return a.date ? formatDateLabel(a.date) : a.day;
}

export function sortByDate<T extends { day: string; date?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => availabilityKey(a).localeCompare(availabilityKey(b)));
}

export type SessionWindow = {
  date: string;
  startTime: string;
  endTime: string;
};

export function windowsOverlap(a: SessionWindow, b: SessionWindow) {
  if (a.date !== b.date) return false;
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function weekdayFromDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

// Returns a human-readable conflict when a professional's one-to-one slots
// overlap a group session, or when two group sessions overlap each other.
// One-to-one slots are generated from the recurring weekly availability, so
// the check also works for a group session entered for a specific date.
export function findSessionScheduleConflict(
  oneToOneAvailability: Array<{
    day: string;
    date?: string;
    startTime: string;
    endTime: string;
    removedSlots?: string[];
    slots?: TimeSlot[];
  }>,
  oneToManySessions: SessionWindow[],
): string | null {
  for (let i = 0; i < oneToManySessions.length; i++) {
    const session = oneToManySessions[i];
    const sessionDay = weekdayFromDate(session.date);

    for (const day of oneToOneAvailability) {
      if (day.date ? day.date !== session.date : day.day !== sessionDay) continue;
      const slots = day.slots?.length
        ? day.slots
        : generateSlots(day.startTime, day.endTime);
      const removed = new Set(day.removedSlots ?? []);
      const conflictingSlot = slots.find(
        (slot) =>
          !removed.has(slot.start) &&
          windowsOverlap(session, {
            date: session.date,
            startTime: slot.start,
            endTime: slot.end,
          }),
      );
      if (conflictingSlot) {
        return `${session.date} ${session.startTime}–${session.endTime} overlaps the one-to-one slot ${conflictingSlot.start}–${conflictingSlot.end}.`;
      }
    }

    for (let j = i + 1; j < oneToManySessions.length; j++) {
      const other = oneToManySessions[j];
      if (windowsOverlap(session, other)) {
        return `${session.date} ${session.startTime}–${session.endTime} overlaps another group session at ${other.startTime}–${other.endTime}.`;
      }
    }
  }
  return null;
}
