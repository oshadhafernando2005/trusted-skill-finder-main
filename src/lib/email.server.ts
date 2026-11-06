import { getAdmin } from "@/lib/firebase-admin.server";
import { SHOW_MEETING_LINK } from "@/lib/features";

// Server-side booking emails via EmailJS's REST API. The browser SDK in
// email.ts can't be used here (no window), and sending from the server means
// the mail goes out even if the client closes the tab right after paying.
//
// Setup in EmailJS: Account -> Security -> enable "Allow EmailJS API for
// non-browser applications", then copy the *private key* into
// EMAILJS_PRIVATE_KEY. Service ID / public key fall back to the ones already
// used in email.ts.

const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID?.trim() || "service_042u64s";
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY?.trim() || "suR-80SR-om21gCzS";
const PRIVATE_KEY = "your_private_key_here";
const CLIENT_TEMPLATE_ID = "template_xxxxxxx";
const PRO_TEMPLATE_ID = "template_yyyyyyy"; // set to "" to skip emailing the professional

async function sendEmailJs(templateId: string, templateParams: Record<string, string>) {
  const res = await fetch(EMAILJS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: templateId,
      user_id: PUBLIC_KEY,
      accessToken: PRIVATE_KEY,
      template_params: templateParams,
    }),
  });
  if (!res.ok) {
    throw new Error(`EmailJS ${res.status}: ${await res.text()}`);
  }
}

type BookingData = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Sends the "your session is booked" email to the client and (optionally) a
// "new booking" email to the professional. Never throws — a failed email must
// not make PayHere think the payment notification failed.
export async function sendBookingEmails(bookingId: string, booking: BookingData) {
  if (!PRIVATE_KEY || (!CLIENT_TEMPLATE_ID && !PRO_TEMPLATE_ID)) {
    console.warn("EmailJS booking emails aren't configured — skipping.");
    return;
  }

  const amountLabel = `${str(booking.currency)} ${Number(booking.amount || 0).toLocaleString("en-LK")}`;
  const sessionLabel = str(booking.sessionName) || str(booking.sessionType);
  const shared = {
    professional_name: str(booking.professionalName),
    session_date: str(booking.date),
    session_time: str(booking.timeSlot),
    session_type: sessionLabel,
    amount: amountLabel,
    customer_name: str(booking.customerName),
    customer_phone: str(booking.customerPhone),
    notes: str(booking.notes) || "-",
    meeting_link:
      (SHOW_MEETING_LINK && str(booking.meetingLink)) ||
      "Your professional will share the meeting link with you.",
    booking_id: bookingId,
  };

  const jobs: Promise<unknown>[] = [];

  if (CLIENT_TEMPLATE_ID && str(booking.customerEmail)) {
    jobs.push(
      sendEmailJs(CLIENT_TEMPLATE_ID, {
        ...shared,
        to_email: str(booking.customerEmail),
        to_name: str(booking.customerName),
      }),
    );
  }

  if (PRO_TEMPLATE_ID) {
    try {
      const { db } = await getAdmin();
      const proSnap = await db
        .collection("professionals")
        .doc(str(booking.professionalId))
        .get();
      const proEmail = str(proSnap.data()?.email);
      if (proEmail) {
        jobs.push(
          sendEmailJs(PRO_TEMPLATE_ID, {
            ...shared,
            to_email: proEmail,
            to_name: str(booking.professionalName),
          }),
        );
      }
    } catch (err) {
      console.error("Couldn't look up professional email:", err);
    }
  }

  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.error("Booking email failed:", r.reason);
  }

  // Marker so we can see in Firestore which bookings got their mail.
  if (results.some((r) => r.status === "fulfilled")) {
    try {
      const { db, FieldValue } = await getAdmin();
      await db
        .collection("bookings")
        .doc(bookingId)
        .update({ confirmationEmailSentAt: FieldValue.serverTimestamp() });
    } catch (err) {
      console.error("Couldn't record email-sent marker:", err);
    }
  }
}
