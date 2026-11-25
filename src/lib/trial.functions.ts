import { createServerFn } from "@tanstack/react-start";

import { bookTrialSession, type CreateTrialBookingInput } from "@/lib/trial-booking.server";

export type { CreateTrialBookingInput };

// Books a free 30-minute trial session — no payment step. See
// trial-booking.server.ts for the checks.
export const createTrialBooking = createServerFn({ method: "POST" })
  .inputValidator((data: CreateTrialBookingInput) => data)
  .handler(async ({ data }) => bookTrialSession(data));
