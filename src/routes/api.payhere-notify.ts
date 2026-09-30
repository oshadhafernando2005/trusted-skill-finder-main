import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { releasePendingBooking } from "@/lib/bookings";

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID ?? "";
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET ?? "";

function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

// Verifies the md5 signature PayHere attaches to every IPN callback so we
// never trust a "paid" status without proving it came from PayHere.
function isValidSignature(params: URLSearchParams) {
  const merchantId = params.get("merchant_id") ?? "";
  const orderId = params.get("order_id") ?? "";
  const amount = params.get("payhere_amount") ?? "";
  const currency = params.get("payhere_currency") ?? "";
  const statusCode = params.get("status_code") ?? "";
  const receivedSig = params.get("md5sig") ?? "";

  const secretDigest = md5(MERCHANT_SECRET).toUpperCase();
  const expected = md5(
    `${merchantId}${orderId}${amount}${currency}${statusCode}${secretDigest}`,
  ).toUpperCase();

  return receivedSig.toUpperCase() === expected;
}

export const Route = createFileRoute("/api/payhere-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const params = new URLSearchParams(await request.text());

        if (
          !MERCHANT_SECRET ||
          params.get("merchant_id") !== MERCHANT_ID ||
          !isValidSignature(params)
        ) {
          return new Response("Invalid signature", { status: 400 });
        }

        const orderId = params.get("order_id") ?? "";
        const statusCode = params.get("status_code") ?? "";

        const snapshot = await getDocs(
          query(collection(db, "bookings"), where("orderId", "==", orderId)),
        );
        const bookingDoc = snapshot.docs[0];
        if (!bookingDoc) return new Response("Unknown order", { status: 404 });
        const booking = bookingDoc.data();

        // 2 = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargedback
        if (statusCode === "2") {
          // The signature proves PayHere sent this, but also make sure the
          // amount actually paid matches the booking's fee.
          const paidAmount = Number(params.get("payhere_amount"));
          if (
            Math.abs(paidAmount - Number(booking.amount)) > 0.001 ||
            params.get("payhere_currency") !== booking.currency
          ) {
            console.error("PayHere amount mismatch for order", orderId);
            return new Response("Amount mismatch", { status: 400 });
          }

          await runTransaction(db, async (transaction) => {
            const ref = doc(db, "bookings", bookingDoc.id);
            const fresh = await transaction.get(ref);
            const previous = String(fresh.data()?.status ?? "");
            if (previous === "paid") return;
            transaction.update(ref, {
              status: "paid",
              paidAt: serverTimestamp(),
              paymentId: params.get("payment_id") ?? "",
              // Money arrived after the hold was released (customer paid very
              // late) — the slot may have been re-booked, so flag it for a
              // manual look instead of silently double-booking.
              ...(previous !== "pending_payment"
                ? { needsReview: true, statusBeforePayment: previous }
                : {}),
            });
            if (previous !== "pending_payment") {
              console.error(`PayHere payment for order ${orderId} arrived while booking was ${previous}`);
            }
          });
        } else if (statusCode === "-1") {
          await releasePendingBooking(bookingDoc.id, "cancelled");
        } else if (statusCode === "-2") {
          await releasePendingBooking(bookingDoc.id, "failed");
        } else if (statusCode === "-3") {
          await runTransaction(db, async (transaction) => {
            transaction.update(doc(db, "bookings", bookingDoc.id), { status: "chargedback" });
          });
        }
        // status 0 (pending): nothing to do, the booking is already pending_payment.

        return new Response("OK", { status: 200 });
      },
    },
  },
});
