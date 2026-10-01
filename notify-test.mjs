import { createHash } from "node:crypto";

const [orderId, amount, currency] = process.argv.slice(2);
const md5 = (s) => createHash("md5").update(s).digest("hex");
const merchantId = process.env.PAYHERE_MERCHANT_ID;
const statusCode = "2";
const secretDigest = md5(process.env.PAYHERE_MERCHANT_SECRET).toUpperCase();
const md5sig = md5(
  `${merchantId}${orderId}${amount}${currency}${statusCode}${secretDigest}`,
).toUpperCase();

const body = new URLSearchParams({
  merchant_id: merchantId,
  order_id: orderId,
  payhere_amount: amount,
  payhere_currency: currency,
  status_code: statusCode,
  md5sig,
  payment_id: "TEST123",
});

const res = await fetch("https://www.bookingpro.lk/api/payhere-notify", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
console.log(res.status, await res.text());