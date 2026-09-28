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

export type CreateBankTransferBookingInput = {
  professionalId: string;
  professionalName: string;
  amount: number;
  currency: string;
  sessionType: string;
  sessionMode: "one_to_one" | "one_to_many";
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
  return {
    mode: d.mode === "one_to_many" ? "one_to_many" : "one_to_one",
    capacity: Math.max(1, Number(d.capacity) || 1),
    // Locks created before group sessions existed have no bookedCount — they
    // were single-use, so a missing count means "already taken".
    bookedCount: Math.max(0, Number(d.bookedCount ?? 1)),
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

export async function createBankTransferBooking(data: CreateBankTransferBookingInput) {
  const lockRef = doc(db, "slot-locks", slotLockId(data.professionalId, data.date, data.timeSlot));
  const bookingRef = doc(collection(db, "bookings"));
  const capacity =
    data.sessionMode === "one_to_many" ? Math.max(2, Math.floor(data.groupCapacity)) : 1;
  let groupBookedCount = 0;

  try {
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(lockRef);
      const locksQuery = query(
        collection(db, "slot-locks"),
        where("professionalId", "==", data.professionalId),
      );
      const dayLocks = await transaction.get(locksQuery);
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

      if (!existing.exists()) {
        groupBookedCount = 1;
        transaction.set(lockRef, {
          professionalId: data.professionalId,
          date: data.date,
          timeSlot: data.timeSlot,
          mode: data.sessionMode,
          capacity,
          bookedCount: 1,
          createdAt: serverTimestamp(),
        });
        transaction.set(bookingRef, {
          ...data,
          customerEmail: data.customerEmail.trim().toLowerCase(),
          notes: data.notes ?? "",
          groupBookedCount: 1,
          paymentMethod: "bank_transfer",
          status: "booked",
          createdAt: serverTimestamp(),
        });
        return;
      }

      const current = existing.data();
      const currentMode = current.mode === "one_to_many" ? "one_to_many" : "one_to_one";
      const currentCapacity = Math.max(1, Number(current.capacity) || 1);
      const currentCount = Math.max(0, Number(current.bookedCount ?? 1));

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

      groupBookedCount = currentCount + 1;
      transaction.update(lockRef, { bookedCount: groupBookedCount });
      transaction.set(bookingRef, {
        ...data,
        customerEmail: data.customerEmail.trim().toLowerCase(),
        notes: data.notes ?? "",
        groupBookedCount,
        paymentMethod: "bank_transfer",
        status: "booked",
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    console.error("Failed to claim slot capacity:", err);
    throw err instanceof Error
      ? err
      : new Error("This slot is no longer available — please pick another.");
  }

  return { bookingId: bookingRef.id };
}
