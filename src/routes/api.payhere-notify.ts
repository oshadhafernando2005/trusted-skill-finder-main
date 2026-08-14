import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { collection, getDocs, query, updateDoc, where } from "firebase/firestore";

import { db } from "@/lib/firebase";

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

        if (!MERCHANT_SECRET || !isValidSignature(params)) {
          return new Response("Invalid signature", { status: 400 });
        }

        const orderId = params.get("order_id") ?? "";
        const statusCode = params.get("status_code") ?? "";
        // 2 = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargedback
        const status =
          statusCode === "2" ? "paid" : statusCode === "0" ? "pending_payment" : "failed";

        const bookingsQuery = query(collection(db, "bookings"), where("orderId", "==", orderId));
        const snapshot = await getDocs(bookingsQuery);
        await Promise.all(snapshot.docs.map((docSnap) => updateDoc(docSnap.ref, { status })));

        return new Response("OK", { status: 200 });
      },
    },
  },
});
