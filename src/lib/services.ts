import { z } from "zod";

// A named one-to-one test/service a professional offers at its own price, next
// to their normal session rate (e.g. "Test 1" at LKR 1000). Clients pick one
// of these, or the normal session, when they book.
export type OneToOneService = { name: string; price: number };

export const oneToOneServicesSchema = z
  .array(
    z.object({
      name: z
        .string()
        .trim()
        .min(1, "Give each test a name")
        .max(80, "Keep test names under 80 characters"),
      price: z.coerce.number().min(1, "Enter a price for each test").max(100000),
    }),
  )
  .max(20, "You can add up to 20 tests")
  .refine(
    (items) => new Set(items.map((i) => i.name.trim().toLowerCase())).size === items.length,
    "Each test needs a different name",
  )
  .default([]);

// Reads the saved list back from Firestore, dropping anything malformed.
export function normalizeServices(raw: unknown): OneToOneService[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      price: Number(item.price) || 0,
    }))
    .filter((item) => item.name && item.price > 0);
}
