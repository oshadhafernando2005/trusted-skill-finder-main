import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
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

// `bookings` holds customer contact details and isn't publicly readable, so
// availability is tracked separately in `slot-locks` — just
// professionalId + date + timeSlot, safe for anyone to read. The doc ID is
// deterministic, so Firestore rules can allow the *first* write to a given
// slot ("create") while rejecting every write after it ("update") — that
// makes double-booking impossible at the database level, not just a
// best-effort check.
function slotLockId(professionalId: string, date: string, timeSlot: string) {
  return `${professionalId}__${date}__${timeSlot}`.replace(/\//g, "_");
}

function slotKey(date: string, timeSlot: string) {
  return `${date}__${timeSlot}`;
}

// True if this exact professional + date + time is already booked by someone else.
export async function isSlotTaken(professionalId: string, date: string, timeSlot: string) {
  const snap = await getDoc(doc(db, "slot-locks", slotLockId(professionalId, date, timeSlot)));
  return snap.exists();
}

// Every already-booked "date__timeSlot" key for a professional, so the
// booking page can hide taken slots before the customer even picks one.
export async function fetchBookedSlotKeys(professionalId: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(collection(db, "slot-locks"), where("professionalId", "==", professionalId)),
  );
  return new Set(snap.docs.map((d) => slotKey(String(d.data().date), String(d.data().timeSlot))));
}

// Claims the slot lock first — Firestore rules reject this write outright if
// someone else claimed it a moment earlier, which is what actually prevents
// double-booking (the isSlotTaken() checks elsewhere are just for a fast,
// friendly error before this point). Only once the lock succeeds do we write
// the private booking record with the customer's details.
export async function createBankTransferBooking(data: CreateBankTransferBookingInput) {
  const lockRef = doc(db, "slot-locks", slotLockId(data.professionalId, data.date, data.timeSlot));
  try {
    await setDoc(lockRef, {
      professionalId: data.professionalId,
      date: data.date,
      timeSlot: data.timeSlot,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to claim slot lock:", err);
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
