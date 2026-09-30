import { createHash } from "node:crypto";

// Server-only PayHere helpers. Never import this file from client code — the
// server functions in payhere.functions.ts are the browser-facing entry points.

// PayHere merchant credentials must never reach the client.
export const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID ?? "";
export const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET ?? "";
export const SANDBOX = (process.env.PAYHERE_MODE ?? "sandbox").toLowerCase() !== "live";
// Public https URL of the site (e.g. https://bookingpro.lk). PayHere calls
// `${SITE_URL}/api/payhere-notify` server-to-server, so it can't be localhost.
export const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

// An unpaid booking holds its slot this long, then the slot is released.
export const HOLD_MINUTES = 30;

export function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

// PayHere's documented hash formula:
// upper(md5(merchant_id + order_id + amount + currency + upper(md5(merchant_secret))))
export function buildHash(orderId: string, amount: string, currency: string) {
  const secretDigest = md5(MERCHANT_SECRET).toUpperCase();
  return md5(`${MERCHANT_ID}${orderId}${amount}${currency}${secretDigest}`).toUpperCase();
}
