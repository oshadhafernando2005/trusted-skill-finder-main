import { FieldValue } from "firebase-admin/firestore";

import {
  timeSlotsOverlap,
  type CreateBookingInput,
  type PendingBookingExtra,
} from "@/lib/bookings";
import { adminDb } from "@/lib/firebase-admin.server";

// Server-only versions of the booking writes used by the PayHere flow. They go
// through the Firebase Admin SDK, so they work with strict Firestore rules (the
// server has no signed-in user, which the client SDK would need).

// Must match slotLockId() in bookings.ts — the browser reads the same lock docs.
function slotLockId(professionalId: string, date: string, timeSlot: string) {
  return `${professionalId}__${date}__${timeSlot}`.replace(/\//g, "_");
}

// Atomically reserves the slot (or one group seat) and writes the booking in
// `pending_payment` state.
export async function createPendingPayHereBookingAdmin(
  data: CreateBookingInput,
  extra: PendingBookingExtra,
) {
  const db = adminDb();
  const lockRef = db
    .collection("slot-locks")
    .doc(slotLockId(data.professionalId, data.date, data.timeSlot));
  const bookingRef = db.collection("bookings").doc();
  const sessionName =
    data.sessionMode === "one_to_many" ? (data.sessionName ?? "").trim().slice(0, 80) : "";
  const capacity =
    data.sessionMode === "one_to_many" ? Math.max(2, Math.floor(data.groupCapacity)) : 1;

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
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    await db.runTransaction(async (tx) => {
      // All reads first (Firestore requires reads before writes in a transaction).
      const existing = await tx.get(lockRef);
      const dayLocks = await tx.get(
        db.collection("slot-locks").where("professionalId", "==", data.professionalId),
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

      if (!existing.exists) {
        tx.set(lockRef, {
          professionalId: data.professionalId,
          date: data.date,
          timeSlot: data.timeSlot,
          mode: data.sessionMode,
          capacity,
          bookedCount: 1,
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.set(bookingRef, bookingFields(1));
        return;
      }

      const current = existing.data() ?? {};
      const currentMode = current.mode === "one_to_many" ? "one_to_many" : "one_to_one";
      const currentCapacity = Math.max(1, Number(current.capacity) || 1);
      const currentCount = Math.max(0, Number(current.bookedCount ?? 1));

      // A lock whose bookings were all released is free again, whatever mode
      // it was last used in.
      if (currentCount === 0) {
        tx.update(lockRef, { mode: data.sessionMode, capacity, bookedCount: 1 });
        tx.set(bookingRef, bookingFields(1));
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
      tx.update(lockRef, { bookedCount: groupBookedCount });
      tx.set(bookingRef, bookingFields(groupBookedCount));
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
// (cancelled / failed / expired) and gives its slot or group seat back, in one
// transaction. Returns false when the booking was no longer pending.
export async function releasePendingBookingAdmin(
  bookingId: string,
  newStatus: "cancelled" | "failed" | "expired",
): Promise<boolean> {
  const db = adminDb();
  const bookingRef = db.collection("bookings").doc(bookingId);
  return db.runTransaction(async (tx) => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) return false;
    const booking = bookingSnap.data() ?? {};
    if (booking.status !== "pending_payment") return false;

    const lockRef = db
      .collection("slot-locks")
      .doc(
        slotLockId(String(booking.professionalId), String(booking.date), String(booking.timeSlot)),
      );
    const lockSnap = await tx.get(lockRef);

    tx.update(bookingRef, { status: newStatus });
    if (lockSnap.exists) {
      const count = Math.max(0, Number(lockSnap.data()?.bookedCount ?? 1));
      tx.update(lockRef, { bookedCount: Math.max(0, count - 1) });
    }
    return true;
  });
}
