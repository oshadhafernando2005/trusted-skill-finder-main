import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { createPendingPayHereBooking, releasePendingBooking } from "@/lib/bookings";
import {
  HOLD_MINUTES,
  MERCHANT_ID,
  MERCHANT_SECRET,
  SANDBOX,
  SITE_URL,
  buildHash,
} from "@/lib/payhere.server";

export type CreateBookingCheckoutInput = {
  professionalId: string;
  professionalName: string;
  amount: number;
  currency: string;
  sessionType: string;
  sessionMode: "one_to_one" | "one_to_many";
  sessionName?: string;
  groupCapacity: number;
  date: string;
  timeSlot: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  // window.location.origin of the page the customer is booking from. Only used
  // when SITE_URL isn't set on the server.
  origin: string;
};

// Reserves the slot, saves the booking as `pending_payment`, and returns the
// signed fields the browser posts to PayHere's checkout page. The booking only
// becomes `paid` when PayHere's server-to-server notification arrives.
export const createBookingCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: CreateBookingCheckoutInput) => data)
  .handler(async ({ data }) => {
    if (!MERCHANT_ID || !MERCHANT_SECRET) {
      throw new Error(
        "Online payment isn't available right now. Please try again later or contact support.",
      );
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new Error("Invalid session fee.");
    }

    const siteUrl = SITE_URL || data.origin.replace(/\/+$/, "");
    const orderId = `BOOK-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const amount = data.amount.toFixed(2);

    const { bookingId } = await createPendingPayHereBooking(
      {
        professionalId: data.professionalId,
        professionalName: data.professionalName,
        amount: Number(amount),
        currency: data.currency,
        sessionType: data.sessionType,
        sessionMode: data.sessionMode,
        sessionName: data.sessionName,
        groupCapacity: data.groupCapacity,
        date: data.date,
        timeSlot: data.timeSlot,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        notes: data.notes,
      },
      { orderId, holdMinutes: HOLD_MINUTES },
    );

    const proPage = `${siteUrl}/professional/${encodeURIComponent(data.professionalId)}`;
    const nameParts = data.customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const itemName = `${data.sessionName || data.sessionType} with ${data.professionalName}`;

    return {
      checkoutUrl: SANDBOX
        ? "https://sandbox.payhere.lk/pay/checkout"
        : "https://www.payhere.lk/pay/checkout",
      // Every field below is posted to PayHere as-is (see submitPayHereForm).
      fields: {
        merchant_id: MERCHANT_ID,
        return_url: `${proPage}?payment=success`,
        cancel_url: `${proPage}?payment=cancelled&booking=${bookingId}&order=${orderId}`,
        notify_url: `${siteUrl}/api/payhere-notify`,
        order_id: orderId,
        items: itemName.slice(0, 120),
        currency: data.currency,
        amount,
        first_name: firstName,
        last_name: lastName,
        email: data.customerEmail.trim().toLowerCase(),
        phone: data.customerPhone,
        // PayHere requires these; we don't collect a postal address for online sessions.
        address: "Online consultation",
        city: "Colombo",
        country: "Sri Lanka",
        custom_1: bookingId,
        hash: buildHash(orderId, amount, data.currency),
      } as Record<string, string>,
    };
  });

// Called when the customer comes back from PayHere via "Cancel": frees the slot
// straight away instead of waiting for the hold to expire. The random orderId
// acts as the proof that the caller is the customer who started this checkout.
export const cancelPendingBooking = createServerFn({ method: "POST" })
  .inputValidator((data: { bookingId: string; orderId: string }) => data)
  .handler(async ({ data }) => {
    const snap = await getDoc(doc(db, "bookings", data.bookingId));
    if (!snap.exists() || snap.data().orderId !== data.orderId) return { released: false };
    return { released: await releasePendingBooking(data.bookingId, "cancelled") };
  });

// Releases slots held by checkouts that were abandoned (tab closed, never
// paid). Run whenever a professional's page loads so freed slots show up.
export const releaseExpiredHolds = createServerFn({ method: "POST" })
  .inputValidator((data: { professionalId: string }) => data)
  .handler(async ({ data }) => {
    const snap = await getDocs(
      query(collection(db, "bookings"), where("professionalId", "==", data.professionalId)),
    );
    const now = Date.now();
    const stale = snap.docs.filter((d) => {
      const b = d.data();
      return (
        b.status === "pending_payment" &&
        typeof b.holdExpiresAt === "number" &&
        b.holdExpiresAt < now
      );
    });
    const results = await Promise.all(stale.map((d) => releasePendingBooking(d.id, "expired")));
    return { released: results.filter(Boolean).length };
  });
