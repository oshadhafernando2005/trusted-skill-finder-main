import emailjs from "@emailjs/browser";

// EmailJS lets the browser send email directly — no backend needed. The
// "public key" really is public (it's designed to be shipped in client
// code), same as a Firebase apiKey; it only authorizes sending through
// your configured EmailJS service/template, nothing more sensitive.
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

export type BankDetailsEmailInput = {
  toEmail: string;
  toName: string;
  professionalName: string;
  date: string;
  timeSlot: string;
  sessionType: string;
  amountLabel: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  whatsappNumber: string;
};

// Fire-and-forget-ish: caller decides whether a failure here should block
// anything (it shouldn't — the booking itself already succeeded by the time
// this runs, so a failed email is a soft failure, not a rollback trigger).
export async function sendBankDetailsEmail(data: BankDetailsEmailInput) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("EmailJS isn't configured — skipping booking confirmation email.");
    return;
  }

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: data.toEmail,
      to_name: data.toName,
      professional_name: data.professionalName,
      session_date: data.date,
      session_time: data.timeSlot,
      session_type: data.sessionType,
      amount: data.amountLabel,
      bank_name: data.bankName,
      bank_account_number: data.bankAccountNumber,
      bank_branch: data.bankBranch,
      whatsapp_number: data.whatsappNumber,
    },
    { publicKey: PUBLIC_KEY },
  );
}
