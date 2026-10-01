import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getAdmin } from "@/lib/firebase-admin.server";
import { releasePendingBookingAdmin } from "@/lib/bookings.server";

function getCreds() {
  return {
    merchantId: (process.env.PAYHERE_MERCHANT_ID ?? "").trim(),
    merchantSecret: (process.env.PAYHERE_MERCHANT_SECRET ?? "").trim(),
  };
}

function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

// Verifies the md5 signature PayHere attaches to every IPN callback so we
// never trust a "paid" status without proving it came from PayHere.
function isValidSignature(params: URLSearchParams, merchantSecret: string) {
  const merchantId = params.get("merchant_id") ?? "";
  const orderId = params.get("order_id") ?? "";
  const amount = params.get("payhere_amount") ?? "";
  const currency = params.get("payhere_currency") ?? "";
  const statusCode = params.get("status_code") ?? "";
  const receivedSig = params.get("md5sig") ?? "";

  const secretDigest = md5(merchantSecret).toUpperCase();
  const expected = md5(
    `${merchantId}${orderId}${amount}${currency}${statusCode}${secretDigest}`,
  ).toUpperCase();

  return receivedSig.toUpperCase() === expected;
}

export const Route = createFileRoute("/api/payhere-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { merchantId, merchantSecret } = getCreds();
        const params = new URLSearchParams(await request.text());

        const merchantOk = params.get("merchant_id") === merchantId;
        const sigOk = isValidSignature(params, merchantSecret);
        console.log("PayHere notify:", {
          order: params.get("order_id"),
          status: params.get("status_code"),
          amount: params.get("payhere_amount"),
          currency: params.get("payhere_currency"),
          hasSecret: !!merchantSecret,
          merchantOk,
          sigOk,
        });

        if (!merchantSecret || !merchantOk || !sigOk) {
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          const orderId = params.get("order_id") ?? "";
          const statusCode = params.get("status_code") ?? "";
          console.log("PayHere notify:", { order: orderId, status: statusCode });

            // Admin SDK: the server has no signed-in user, so the client SDK is
            // (correctly) blocked by the Firestore rules on `bookings`.
            const { db, FieldValue } = await getAdmin();
            const snapshot = await db
              .collection("bookings")
              .where("orderId", "==", orderId)
              .limit(1)
              .get();
            const bookingDoc = snapshot.docs[0];
            if (!bookingDoc) return new Response("Unknown order", { status: 404 });
            const booking = bookingDoc.data();
            const bookingRef = bookingDoc.ref;

            // 2 = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargedback
            if (statusCode === "2") {
              // The signature proves PayHere sent this, but also make sure the
              // amount actually paid matches the booking's fee.
              const paidAmount = Number(params.get("payhere_amount"));
              if (
                Math.abs(paidAmount - Number(booking.amount)) > 0.001 ||
                params.get("payhere_currency") !== booking.currency
              ) {
                console.error("PayHere amount mismatch for order", orderId, {
                  paid: params.get("payhere_amount"),
                  stored: booking.amount,
                  paidCurrency: params.get("payhere_currency"),
                  storedCurrency: booking.currency,
                });
                return new Response("Amount mismatch", { status: 400 });
              }

              await db.runTransaction(async (tx) => {
                const fresh = await tx.get(bookingRef);
                const previous = String(fresh.data()?.status ?? "");
                if (previous === "paid") return;
                tx.update(bookingRef, {
                  status: "paid",
                  paidAt: FieldValue.serverTimestamp(),
                  paymentId: params.get("payment_id") ?? "",
                  // Money arrived after the hold was released (customer paid very
                  // late) — the slot may have been re-booked, so flag it for a
                  // manual look instead of silently double-booking.
                  ...(previous !== "pending_payment"
                    ? { needsReview: true, statusBeforePayment: previous }
                    : {}),
                });
                if (previous !== "pending_payment") {
                  console.error(
                    `PayHere payment for order ${orderId} arrived while booking was ${previous}`,
                  );
                }
              });
            } else if (statusCode === "-1") {
              await releasePendingBookingAdmin(bookingDoc.id, "cancelled");
            } else if (statusCode === "-2") {
              await releasePendingBookingAdmin(bookingDoc.id, "failed");
            } else if (statusCode === "-3") {
              await bookingRef.update({ status: "chargedback" });
            }
            // status 0 (pending): nothing to do, the booking is already pending_payment.

            return new Response("OK", { status: 200 });
        } catch (err) {
          console.error("PayHere notify failed:", err);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
