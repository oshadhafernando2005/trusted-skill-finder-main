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
