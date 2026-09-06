import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type CreateBankTransferBookingInput = {
  professionalId: string;
  professionalName: string;
  amount: number;
  currency: string;
  sessionType: string;
  date: string;
  timeSlot: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
};

// True if this exact professional + date + time is already booked by someone else.
export async function isSlotTaken(professionalId: string, date: string, timeSlot: string) {
  const snap = await getDocs(
    query(
      collection(db, "bookings"),
      where("professionalId", "==", professionalId),
      where("date", "==", date),
      where("timeSlot", "==", timeSlot),
      where("status", "==", "booked"),
      limit(1),
    ),
  );
  return !snap.empty;
}

// Every already-booked "date__timeSlot" key for a professional, so the
// booking page can hide taken slots before the customer even picks one.
export async function fetchBookedSlotKeys(professionalId: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(
      collection(db, "bookings"),
      where("professionalId", "==", professionalId),
      where("status", "==", "booked"),
    ),
  );
  return new Set(snap.docs.map((d) => `${String(d.data().date)}__${String(d.data().timeSlot)}`));
}

// Re-checks the slot is still free, then writes the booking as already
// confirmed (bank transfers are settled outside the app, so there's no
// separate "pending payment" state — once the customer says they've sent
// the transfer, the slot is theirs).
export async function createBankTransferBooking(data: CreateBankTransferBookingInput) {
  if (await isSlotTaken(data.professionalId, data.date, data.timeSlot)) {
    throw new Error("This slot was just booked by someone else — please pick another.");
  }

  const ref = await addDoc(collection(db, "bookings"), {
    ...data,
    notes: data.notes ?? "",
    paymentMethod: "bank_transfer",
    status: "booked",
    createdAt: serverTimestamp(),
  });

  return { bookingId: ref.id };
}
