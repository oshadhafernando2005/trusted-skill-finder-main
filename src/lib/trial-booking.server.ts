import { z } from "zod";

import { createFreeTrialBookingAdmin } from "@/lib/bookings.server";
import { sendBookingEmails } from "@/lib/email.server";
import { getAdmin } from "@/lib/firebase-admin.server";
import {
  MAX_TRIAL_BOOKINGS_PER_CLIENT,
  generateTrialSlots,
  normalizeTrialSessions,
} from "@/lib/trial-sessions";

// Server-only: the checks and writes behind booking a free trial session. Kept
// apart from trial.functions.ts so the rules can be tested on their own.

export type CreateTrialBookingInput = {
  professionalId: string;
  date: string;
  timeSlot: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
};

const inputSchema = z.object({
  professionalId: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().regex(/^\d{2}:\d{2}–\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2, "Enter your full name").max(80),
  customerEmail: z.string().trim().email("Enter a valid email").max(255),
  customerPhone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  notes: z.string().trim().max(500).optional(),
});

// Nothing is trusted from the browser except who is booking and which slot: the
// professional, their trial windows, the price (always free) and the 30-minute
// length all come from the server, so this can't be used to book a paid slot
// for free.
export async function bookTrialSession(raw: CreateTrialBookingInput) {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Please check your details.");
  }
  const data = parsed.data;
  const email = data.customerEmail.toLowerCase();

  const { db } = await getAdmin();
  const proSnap = await db.collection("professionals").doc(data.professionalId).get();
  const pro = proSnap.data();
  if (!proSnap.exists || !pro || pro.status !== "approved") {
    throw new Error("This professional is no longer available.");
  }

  // The slot must be one of the 30-minute blocks inside a trial window the
  // professional really offers.
  const [slotStart, slotEnd] = data.timeSlot.split("–");
  const offered = normalizeTrialSessions(pro.trialSessions).some(
    (window) =>
      window.date === data.date &&
      generateTrialSlots(window.startTime, window.endTime).some(
        (s) => s.start === slotStart && s.end === slotEnd,
      ),
  );
  if (!offered) {
    throw new Error("That trial session isn't offered. Please refresh and pick a time again.");
  }

  // Times are Sri Lanka time (UTC+05:30) — see zoom.server.ts.
  if (new Date(`${data.date}T${slotStart}:00+05:30`).getTime() <= Date.now()) {
    throw new Error("That time has already started. Please pick a later trial session.");
  }

  // Soft limit so one client can't hoard every free slot.
  const earlier = await db
    .collection("bookings")
    .where("professionalId", "==", data.professionalId)
    .where("customerEmail", "==", email)
    .where("isTrial", "==", true)
    .get();
  const activeTrials = earlier.docs.filter((d) => d.data().status === "confirmed").length;
  if (activeTrials >= MAX_TRIAL_BOOKINGS_PER_CLIENT) {
    throw new Error(
      "You've already booked a free trial with this professional. Book a full session to continue.",
    );
  }

  const professionalName = typeof pro.fullName === "string" ? pro.fullName : "Professional";
  const currency = typeof pro.currency === "string" && pro.currency ? pro.currency : "LKR";
  const sessionType =
    Array.isArray(pro.sessionType) && typeof pro.sessionType[0] === "string"
      ? pro.sessionType[0]
      : "Online video";

  const { bookingId } = await createFreeTrialBookingAdmin({
    professionalId: data.professionalId,
    professionalName,
    amount: 0,
    currency,
    sessionType,
    sessionMode: "one_to_one",
    sessionName: "Trial session",
    groupCapacity: 1,
    date: data.date,
    timeSlot: data.timeSlot,
    customerName: data.customerName,
    customerEmail: email,
    customerPhone: data.customerPhone,
    notes: data.notes ?? "",
  });

  // Never throws — a mail problem must not undo a booking that succeeded.
  await sendBookingEmails(bookingId, {
    professionalId: data.professionalId,
    professionalName,
    date: data.date,
    timeSlot: data.timeSlot,
    sessionName: "Trial session",
    sessionType,
    amount: 0,
    currency,
    customerName: data.customerName,
    customerEmail: email,
    customerPhone: data.customerPhone,
    notes: data.notes ?? "",
    meetingLink: null,
    isTrial: true,
  });

  return { bookingId };
}
