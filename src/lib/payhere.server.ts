import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";

// PayHere merchant credentials must never reach the client — this file only
// ever runs on the server (createServerFn strips it from the client bundle).
const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID ?? "";
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET ?? "";
const SANDBOX = (process.env.PAYHERE_MODE ?? "sandbox").toLowerCase() !== "live";

function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

// PayHere's documented hash formula:
// upper(md5(merchant_id + order_id + amount + currency + upper(md5(merchant_secret))))
function buildHash(orderId: string, amount: string, currency: string) {
  const secretDigest = md5(MERCHANT_SECRET).toUpperCase();
  return md5(`${MERCHANT_ID}${orderId}${amount}${currency}${secretDigest}`).toUpperCase();
}

export type CreateBookingCheckoutInput = {
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

export const createBookingCheckout = createServerFn({ method: "POST" })
  .validator((data: CreateBookingCheckoutInput) => data)
  .handler(async ({ data }) => {
    if (!MERCHANT_ID || !MERCHANT_SECRET) {
      throw new Error(
        "PayHere isn't configured yet. Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET on the server.",
      );
    }

    const orderId = `BOOK-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const amount = data.amount.toFixed(2);

    const bookingRef = await addDoc(collection(db, "bookings"), {
      orderId,
      professionalId: data.professionalId,
      professionalName: data.professionalName,
      amount: Number(amount),
      currency: data.currency,
      sessionType: data.sessionType,
      date: data.date,
      timeSlot: data.timeSlot,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      notes: data.notes ?? "",
      status: "pending_payment",
      createdAt: serverTimestamp(),
    });

    return {
      bookingId: bookingRef.id,
      orderId,
      amount,
      currency: data.currency,
      merchantId: MERCHANT_ID,
      sandbox: SANDBOX,
      hash: buildHash(orderId, amount, data.currency),
    };
  });
