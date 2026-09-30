import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  runTransaction,
  where,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { toMinutes } from "@/lib/slots";

// Shared shape for a booking as shown in both the professional's "My
// bookings" tab and a client's "My bookings" page.
export type BookingRecord = {
  id: string;
  professionalId: string;
  professionalName: string;
  date: string;
  timeSlot: string;
  sessionType: string;
  sessionMode: "one_to_one" | "one_to_many";
  sessionName: string;
  groupCapacity: number;
  groupBookedCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  amount: number;
  currency: string;
  status: string;
};

export function toBookingRecord(id: string, d: DocumentData): BookingRecord {
  return {
    id,
    professionalId: typeof d.professionalId === "string" ? d.professionalId : "",
    professionalName: typeof d.professionalName === "string" ? d.professionalName : "",
    date: typeof d.date === "string" ? d.date : "",
    timeSlot: typeof d.timeSlot === "string" ? d.timeSlot : "",
    sessionType: typeof d.sessionType === "string" ? d.sessionType : "",
    sessionMode: d.sessionMode === "one_to_many" ? "one_to_many" : "one_to_one",
    sessionName: typeof d.sessionName === "string" ? d.sessionName : "",
    groupCapacity: Math.max(1, Number(d.groupCapacity) || 1),
    groupBookedCount: Math.max(0, Number(d.groupBookedCount) || 0),
    customerName: typeof d.customerName === "string" ? d.customerName : "",
    customerEmail: typeof d.customerEmail === "string" ? d.customerEmail : "",
    customerPhone: typeof d.customerPhone === "string" ? d.customerPhone : "",
    notes: typeof d.notes === "string" ? d.notes : "",
    amount: Number(d.amount) || 0,
    currency: typeof d.currency === "string" ? d.currency : "",
    status: typeof d.status === "string" ? d.status : "booked",
  };
}

// A client's own booking history, matched by the email on their account.
// Works even for bookings made before they had an account, as long as they
// used the same email at checkout.
export async function fetchBookingsByEmail(email: string): Promise<BookingRecord[]> {
  const snap = await getDocs(
    query(collection(db, "bookings"), where("customerEmail", "==", email.toLowerCase())),
  );
  return snap.docs.map((d) => toBookingRecord(d.id, d.data()));
}

export type CreateBookingInput = {
  professionalId: string;
  professionalName: string;
  amount: number;
  currency: string;
  sessionType: string;
  sessionMode: "one_to_one" | "one_to_many";
  // Name the professional gave the group session (one-to-many only).
  sessionName?: string;
  groupCapacity: number;
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

// Returns the current occupancy for a professional/date/time. A slot is either
// running as a one-to-one session (capacity 1) or a one-to-many session (shared
// by up to groupCapacity customers). The mode is stored on the lock so the two
// modes cannot accidentally be booked on top of each other.
export async function getSlotAvailability(
  professionalId: string,
  date: string,
  timeSlot: string,
): Promise<{ mode: "one_to_one" | "one_to_many"; capacity: number; bookedCount: number } | null> {
  const snap = await getDoc(doc(db, "slot-locks", slotLockId(professionalId, date, timeSlot)));
  if (!snap.exists()) return null;
  const d = snap.data();
  const bookedCount = Math.max(0, Number(d.bookedCount ?? 1));
  // A lock whose bookings were all released is free again.
  if (bookedCount === 0) return null;
  return {
    mode: d.mode === "one_to_many" ? "one_to_many" : "one_to_one",
    capacity: Math.max(1, Number(d.capacity) || 1),
    // Locks created before group sessions existed have no bookedCount — they
    // were single-use, so a missing count means "already taken".
    bookedCount,
  };
}

// Legacy helper retained for callers that only need to know whether a slot is
// completely unavailable. Group slots remain available until their capacity is met.
export async function isSlotTaken(professionalId: string, date: string, timeSlot: string) {
  const availability = await getSlotAvailability(professionalId, date, timeSlot);
  return !!availability && availability.bookedCount >= availability.capacity;
}

export async function fetchBookedSlotKeys(professionalId: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(collection(db, "slot-locks"), where("professionalId", "==", professionalId)),
  );
  return new Set(
    snap.docs
      .filter((d) => {
        const data = d.data();
        return Number(data.bookedCount ?? 1) >= Number(data.capacity ?? 1);
      })
      .map((d) => slotKey(String(d.data().date), String(d.data().timeSlot))),
  );
}

// Atomically claims a one-to-one slot or consumes one seat in a one-to-many
// session. Firestore's transaction prevents two customers from taking the last
// group seat at the same time. Once a slot has a mode, the other mode cannot
// book that same professional/date/time.
export type OccupiedSlot = {
  date: string;
  timeSlot: string;
  mode: "one_to_one" | "one_to_many";
  capacity: number;
  bookedCount: number;
};

function parseTimeSlot(timeSlot: string) {
  const [startTime, endTime] = timeSlot.split("–");
  return { startTime, endTime };
}

export function timeSlotsOverlap(a: string, b: string) {
  const aParts = parseTimeSlot(a);
  const bParts = parseTimeSlot(b);
  const aStart = toMinutes(aParts.startTime);
  const aEnd = toMinutes(aParts.endTime);
  const bStart = toMinutes(bParts.startTime);
  const bEnd = toMinutes(bParts.endTime);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

export async function fetchOccupiedSlots(professionalId: string): Promise<OccupiedSlot[]> {
  const snap = await getDocs(
    query(collection(db, "slot-locks"), where("professionalId", "==", professionalId)),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      date: String(data.date ?? ""),
      timeSlot: String(data.timeSlot ?? ""),
      mode: data.mode === "one_to_many" ? "one_to_many" : "one_to_one",
      capacity: Math.max(1, Number(data.capacity) || 1),
      bookedCount: Math.max(0, Number(data.bookedCount ?? 1)),
    };
  });
}

export type PendingBookingExtra = {
  orderId: string;
  // How long an unpaid booking may hold its slot before it is released.
  holdMinutes: number;
};

// Atomically reserves the slot (or one group seat) and writes the booking in
// `pending_payment` state. The reservation is released again if PayHere reports
// a failed/cancelled payment, or if the hold expires without payment.
export async function createPendingPayHereBooking(
  data: CreateBookingInput,
  extra: PendingBookingExtra,
) {
  const lockRef = doc(db, "slot-locks", slotLockId(data.professionalId, data.date, data.timeSlot));
  const bookingRef = doc(collection(db, "bookings"));
  const sessionName =
    data.sessionMode === "one_to_many" ? (data.sessionName ?? "").trim().slice(0, 80) : "";
  const capacity =
    data.sessionMode === "one_to_many" ? Math.max(2, Math.floor(data.groupCapacity)) : 1;

  // Firestore client transactions can only read single documents, not
  // queries, so the overlap check runs just before the transaction. Two
  // people booking the exact same slot is still fully atomic below; only two
  // *different but overlapping* slots booked in the same instant could slip
  // through.
  const dayLocks = await getDocs(
    query(collection(db, "slot-locks"), where("professionalId", "==", data.professionalId)),
  );
  const conflictingLock = dayLocks.docs.find((lock) => {
    if (lock.id === lockRef.id) return false;
    const lockData = lock.data();
    const bookedCount = Math.max(0, Number(lockData.bookedCount ?? 1));
    return (
      String(lockData.date ?? "") === data.date &&
      bookedCount > 0 &&
      timeSlotsOverlap(String(lockData.timeSlot ?? ""), data.timeSlot)
    );
  });
  if (conflictingLock) {
    throw new Error(
      "This time overlaps another booked session for this professional. Please pick another time.",
    );
  }

  const bookingFields = (groupBookedCount: number) => ({
    ...data,
    sessionName,
    customerEmail: data.customerEmail.trim().toLowerCase(),
    notes: data.notes ?? "",
    groupBookedCount,
    orderId: extra.orderId,
    paymentMethod: "payhere",
    status: "pending_payment",
    holdExpiresAt: Date.now() + extra.holdMinutes * 60 * 1000,
    createdAt: serverTimestamp(),
  });

  try {
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(lockRef);

      if (!existing.exists()) {
        transaction.set(lockRef, {
          professionalId: data.professionalId,
          date: data.date,
          timeSlot: data.timeSlot,
          mode: data.sessionMode,
          capacity,
          bookedCount: 1,
          createdAt: serverTimestamp(),
        });
        transaction.set(bookingRef, bookingFields(1));
        return;
      }

      const current = existing.data();
      const currentMode = current.mode === "one_to_many" ? "one_to_many" : "one_to_one";
      const currentCapacity = Math.max(1, Number(current.capacity) || 1);
      const currentCount = Math.max(0, Number(current.bookedCount ?? 1));

      // A lock whose bookings were all released is free again, whatever mode
      // it was last used in.
      if (currentCount === 0) {
        transaction.update(lockRef, { mode: data.sessionMode, capacity, bookedCount: 1 });
        transaction.set(bookingRef, bookingFields(1));
        return;
      }

      if (currentMode !== data.sessionMode) {
        throw new Error(
          "This time is already being used for another session type. Please pick another time.",
        );
      }
      if (currentCount >= currentCapacity) {
        throw new Error(
          data.sessionMode === "one_to_many"
            ? "This group session is full — please pick another time."
            : "This slot was just booked by someone else — please pick another.",
        );
      }

      const groupBookedCount = currentCount + 1;
      transaction.update(lockRef, { bookedCount: groupBookedCount });
      transaction.set(bookingRef, bookingFields(groupBookedCount));
    });
  } catch (err) {
    console.error("Failed to claim slot capacity:", err);
    throw err instanceof Error
      ? err
      : new Error("This slot is no longer available — please pick another.");
  }

  return { bookingId: bookingRef.id };
}

// Moves a booking that is still `pending_payment` to a terminal unpaid status
// (cancelled / failed / expired) and gives its slot or group seat back — in one
// transaction, so a payment confirmation arriving at the same moment can never
// be half-applied. Returns false when the booking was no longer pending.
export async function releasePendingBooking(
  bookingId: string,
  newStatus: "cancelled" | "failed" | "expired",
): Promise<boolean> {
  const bookingRef = doc(db, "bookings", bookingId);
  return runTransaction(db, async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) return false;
    const booking = bookingSnap.data();
    if (booking.status !== "pending_payment") return false;

    const lockRef = doc(
      db,
      "slot-locks",
      slotLockId(String(booking.professionalId), String(booking.date), String(booking.timeSlot)),
    );
    const lockSnap = await transaction.get(lockRef);

    transaction.update(bookingRef, { status: newStatus });
    if (lockSnap.exists()) {
      const count = Math.max(0, Number(lockSnap.data().bookedCount ?? 1));
      transaction.update(lockRef, { bookedCount: Math.max(0, count - 1) });
    }
    return true;
  });
}
