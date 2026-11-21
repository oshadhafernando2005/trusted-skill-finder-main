import { z } from "zod";

import {
  TRIAL_MINUTES,
  generateSlots,
  toLocalISODate,
  toMinutes,
  toTimeString,
  weekdayShortFromDate,
  windowsOverlap,
  type TimeSlot,
} from "@/lib/slots";

// A trial session is a free, 15-minute one-to-one session a professional offers
// so a client can meet them before paying for a full session. The professional
// sets a window (a date plus a start and end time); it's cut into back-to-back
// 15-minute blocks, and each block is booked on its own without payment.
export type TrialSession = { date: string; startTime: string; endTime: string };

// How many trial bookings one client (matched by email) may hold with the same
// professional. Raise it, or set it to Infinity, to allow more.
export const MAX_TRIAL_BOOKINGS_PER_CLIENT = 1;

// "09:00"–"10:00" -> 09:00–09:15, 09:15–09:30, 09:30–09:45, 09:45–10:00.
export function generateTrialSlots(startTime: string, endTime: string): TimeSlot[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots: TimeSlot[] = [];
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return slots;
  for (let cursor = start; cursor + TRIAL_MINUTES <= end; cursor += TRIAL_MINUTES) {
    slots.push({ start: toTimeString(cursor), end: toTimeString(cursor + TRIAL_MINUTES) });
  }
  return slots;
}

export const trialSessionsSchema = z
  .array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date for each trial session"),
      startTime: z.string().min(1, "Set a start time for each trial session"),
      endTime: z.string().min(1, "Set an end time for each trial session"),
    }),
  )
  .max(30, "You can add up to 30 trial session windows")
  .superRefine((items, ctx) => {
    const today = toLocalISODate(new Date());
    for (const item of items) {
      if (item.date < today) {
        ctx.addIssue({ code: "custom", message: "Trial session dates can't be in the past" });
        return;
      }
      if (generateTrialSlots(item.startTime, item.endTime).length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `Each trial session window must be at least ${TRIAL_MINUTES} minutes long`,
        });
        return;
      }
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (windowsOverlap(items[i], items[j])) {
          ctx.addIssue({
            code: "custom",
            message: `Two trial session windows overlap on ${items[i].date}`,
          });
          return;
        }
      }
    }
  })
  .default([]);

// Reads the saved list back from Firestore, dropping anything malformed.
export function normalizeTrialSessions(raw: unknown): TrialSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      date: typeof item.date === "string" ? item.date : "",
      startTime: typeof item.startTime === "string" ? item.startTime : "",
      endTime: typeof item.endTime === "string" ? item.endTime : "",
    }))
    .filter(
      (item) =>
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        generateTrialSlots(item.startTime, item.endTime).length > 0,
    );
}

// A professional can only run one session at a time, so a trial window must not
// overlap their one-to-one slots or group sessions. Returns a readable message
// for the first clash, or null.
export function findTrialScheduleConflict(
  trialSessions: TrialSession[],
  oneToOneAvailability: Array<{
    day: string;
    date?: string;
    startTime: string;
    endTime: string;
    removedSlots?: string[];
    slots?: TimeSlot[];
  }>,
  groupSessions: Array<{ date: string; startTime: string; endTime: string }>,
): string | null {
  for (const trial of trialSessions) {
    const weekday = weekdayShortFromDate(trial.date);
    for (const day of oneToOneAvailability) {
      if (day.date ? day.date !== trial.date : day.day !== weekday) continue;
      const slots = day.slots?.length ? day.slots : generateSlots(day.startTime, day.endTime);
      const removed = new Set(day.removedSlots ?? []);
      const clash = slots.find(
        (slot) =>
          !removed.has(slot.start) &&
          windowsOverlap(trial, { date: trial.date, startTime: slot.start, endTime: slot.end }),
      );
      if (clash) {
        return `The trial session on ${trial.date} (${trial.startTime}–${trial.endTime}) overlaps your one-to-one slot ${clash.start}–${clash.end}.`;
      }
    }
    for (const group of groupSessions) {
      if (windowsOverlap(trial, group)) {
        return `The trial session on ${trial.date} (${trial.startTime}–${trial.endTime}) overlaps your group session at ${group.startTime}–${group.endTime}.`;
      }
    }
  }
  return null;
}
