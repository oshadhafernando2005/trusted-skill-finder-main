import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { z } from "zod";

import { db } from "@/lib/firebase";
import { createBankTransferBooking, fetchBookedSlotKeys, isSlotTaken } from "@/lib/bookings";
import { sendBankDetailsEmail } from "@/lib/email";
import { Logo } from "@/components/logo";
import proTeacher from "@/assets/pro-teacher.jpg";

// Where the customer is told to send the bank transfer receipt.
// Payments are collected into one fixed platform account (not per-professional).
const PAYMENT_BANK_ACCOUNT_NUMBER = "200505303777";
const PAYMENT_BANK_ACCOUNT_NAME = "B O k Fernando";
const PAYMENT_BANK_NAME = "BOC";
const PAYMENT_BANK_BRANCH = "Panadura";
const WHATSAPP_RECEIPT_NUMBER = "078 574 2630";

export const Route = createFileRoute("/professional/$id")({
  head: () => ({
    meta: [{ title: "Book a session — Booking Pro" }],
  }),
  component: ProfessionalDetail,
});

type ProDetail = {
  id: string;
  img: string;
  name: string;
  profession: string;
  specialization: string;
  company: string;
  bio: string;
  years: number;
  fee: number;
  currency: string;
  rateUnit: string;
  sessionLength: string;
  location: string;
  sessionMode: "one_to_one" | "one_to_many";
  availability: DayAvailability[];
  sessionType: string[];
  workAreas: string[];
  verified: boolean;
};

// A single bookable block within a day — only present for one-to-one pros.
type TimeSlot = {
  start: string;
  end: string;
};

// One working day with its own hours — matches the "join as professional" form.
// `slots` holds the auto-generated 50-min blocks when sessionMode is one_to_one.
type DayAvailability = {
  day: string;
  startTime: string;
  endTime: string;
  slots: TimeSlot[];
};

function normalizeSlots(raw: unknown): TimeSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      start: typeof item.start === "string" ? item.start : "",
      end: typeof item.end === "string" ? item.end : "",
    }))
    .filter((item) => item.start && item.end);
}

function normalizeAvailability(raw: unknown): DayAvailability[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      day: typeof item.day === "string" ? item.day : "",
      startTime: typeof item.startTime === "string" ? item.startTime : "",
      endTime: typeof item.endTime === "string" ? item.endTime : "",
      slots: normalizeSlots(item.slots),
    }))
    .filter((item) => item.day);
}

const bookingSchema = z.object({
  slotDay: z.string().optional(),
  date: z.string().optional(),
  timeSlot: z.string().optional(),
  sessionType: z.string().min(1, "Choose a session type"),
  customerName: z.string().trim().min(2, "Enter your full name").max(80),
  customerEmail: z.string().trim().email("Enter a valid email"),
  customerPhone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

type Errors = Partial<Record<keyof z.infer<typeof bookingSchema>, string>>;

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fullDayNames: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

// Next upcoming calendar date (today or later) that falls on the given weekday.
function nextOccurrence(day: string): string {
  const targetDow = weekdays.indexOf(day);
  if (targetDow === -1) return "";
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((targetDow - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

function formatSlotDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";
const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

function ProfessionalDetail() {
  const { id } = useParams({ from: "/professional/$id" });
  const [pro, setPro] = useState<ProDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bookedSlotKeys, setBookedSlotKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    getDoc(doc(db, "professionals", id))
      .then((snap) => {
        if (!active) return;
        if (!snap.exists() || snap.data().status !== "approved") {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        setPro({
          id: snap.id,
          img: typeof d.photoURL === "string" && d.photoURL ? d.photoURL : proTeacher,
          name: typeof d.fullName === "string" ? d.fullName : "Unnamed professional",
          profession: typeof d.profession === "string" ? d.profession : "Professional",
          specialization: typeof d.specialization === "string" ? d.specialization : "",
          company: typeof d.company === "string" ? d.company : "",
          bio: typeof d.bio === "string" ? d.bio : "",
          years: Number(d.experience) || 0,
          fee: Number(d.rate) || 0,
          currency: typeof d.currency === "string" ? d.currency : "USD",
          rateUnit: typeof d.rateUnit === "string" ? d.rateUnit : "per hour",
          sessionLength: typeof d.sessionLength === "string" ? d.sessionLength : "60 min",
          location: typeof d.location === "string" ? d.location : "Remote",
          sessionMode: d.sessionMode === "one_to_one" ? "one_to_one" : "one_to_many",
          availability: normalizeAvailability(d.availability),
          sessionType: Array.isArray(d.sessionType) ? (d.sessionType as string[]) : [],
          workAreas: Array.isArray(d.workAreas) ? (d.workAreas as string[]) : [],
          verified: d.status === "approved",
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load professional:", err);
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Fetch already-booked slots for this professional so the picker never
  // offers a date/time someone else has already taken.
  useEffect(() => {
    let active = true;
    fetchBookedSlotKeys(id)
      .then((keys) => {
        if (active) setBookedSlotKeys(keys);
      })
      .catch((err) => console.error("Failed to load booked slots:", err));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !pro) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
        <div>
          <h1 className="font-display text-3xl">Professional not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This profile may have been removed or is pending approval.
          </p>
          <Link
            to="/find-professionals"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/find-professionals"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back to search
          </Link>
        </div>
      </header>

      <main className="container-page grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <section>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <img src={pro.img} alt={pro.name} className="h-96 w-full object-cover" />
            <div className="space-y-5 p-8">
              <div>
                <h1 className="flex items-center gap-2 font-display text-3xl leading-tight">
                  {pro.name}
                  {pro.verified && <BadgeCheck className="h-5 w-5 text-gold" />}
                </h1>
                <p className="mt-1 text-muted-foreground">
                  {pro.profession}
                  {pro.specialization ? ` · ${pro.specialization}` : ""}
                </p>
                {pro.company && <p className="text-sm text-muted-foreground">{pro.company}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" /> {pro.years} yrs experience
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {pro.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {pro.sessionLength} sessions
                </span>
              </div>

              {pro.bio && <p className="leading-relaxed text-foreground/90">{pro.bio}</p>}

              {pro.workAreas.length > 0 && (
                <div>
                  <p className={label}>Work areas</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {pro.workAreas.map((area) => (
                      <li
                        key={area}
                        className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pro.availability.length > 0 && (
                <div>
                  <p className={label}>
                    {pro.sessionMode === "one_to_one" ? "Available time slots" : "Available days"}
                  </p>
                  {pro.sessionMode === "one_to_one" ? (
                    <div className="grid gap-3">
                      {pro.availability.map((a) => (
                        <div key={a.day} className="rounded-xl border border-border bg-surface p-3">
                          <p className="mb-2 text-sm font-medium">{fullDayNames[a.day] ?? a.day}</p>
                          <div className="flex flex-wrap gap-2">
                            {a.slots.length > 0 ? (
                              a.slots.map((s) => (
                                <span
                                  key={s.start}
                                  className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-foreground"
                                >
                                  {s.start}–{s.end}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {a.startTime} – {a.endTime}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pro.availability.map((a) => (
                        <div
                          key={a.day}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{a.day}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.startTime} – {a.endTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {pro.sessionType.length > 0 && (
                <div>
                  <p className={label}>Session types</p>
                  <div className="flex flex-wrap gap-2">
                    {pro.sessionType.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <BookingPanel pro={pro} bookedSlotKeys={bookedSlotKeys} />
      </main>
    </div>
  );
}

type BookableSlot = {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
};

function slotKey(date: string, startTime: string, endTime: string) {
  return `${date}__${startTime}–${endTime}`;
}

function buildBookableSlots(pro: ProDetail, bookedSlotKeys: Set<string>): BookableSlot[] {
  if (pro.sessionMode === "one_to_one") {
    return pro.availability.flatMap((a) => {
      const date = nextOccurrence(a.day);
      return a.slots
        .filter((s) => !bookedSlotKeys.has(slotKey(date, s.start, s.end)))
        .map((s) => ({
          key: `${a.day}-${s.start}`,
          date,
          startTime: s.start,
          endTime: s.end,
          label: `${fullDayNames[a.day] ?? a.day} · ${formatSlotDate(date)} · ${s.start}–${s.end}`,
        }));
    });
  }
  return pro.availability
    .filter((a) => {
      const date = nextOccurrence(a.day);
      return !bookedSlotKeys.has(slotKey(date, a.startTime, a.endTime));
    })
    .map((a) => {
      const date = nextOccurrence(a.day);
      return {
        key: a.day,
        date,
        startTime: a.startTime,
        endTime: a.endTime,
        label: `${fullDayNames[a.day] ?? a.day} · ${formatSlotDate(date)} · ${a.startTime}–${a.endTime}`,
      };
    });
}

function BookingPanel({ pro, bookedSlotKeys }: { pro: ProDetail; bookedSlotKeys: Set<string> }) {
  const slots = buildBookableSlots(pro, bookedSlotKeys);
  const hasSlots = slots.length > 0;
  const allSlotsTaken = buildBookableSlots(pro, new Set()).length > 0 && slots.length === 0;

  const [values, setValues] = useState({
    slotDay: slots[0]?.key ?? "",
    date: "",
    timeSlot: "",
    sessionType: pro.sessionType[0] ?? "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showBankModal, setShowBankModal] = useState(false);
  const [booked, setBooked] = useState(false);
  const [confirmed, setConfirmed] = useState<{ date: string; timeSlot: string } | null>(null);
  const [showReminder, setShowReminder] = useState(false);

  // Auto-dismiss the payment reminder popup after 10 seconds.
  useEffect(() => {
    if (!showReminder) return;
    const timer = setTimeout(() => setShowReminder(false), 10000);
    return () => clearTimeout(timer);
  }, [showReminder]);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const today = new Date().toISOString().slice(0, 10);
  const selectedSlot = slots.find((s) => s.key === values.slotDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const bookingDate = hasSlots ? selectedSlot?.date : values.date;
    const bookingTimeSlot = hasSlots
      ? selectedSlot
        ? `${selectedSlot.startTime}–${selectedSlot.endTime}`
        : ""
      : values.timeSlot;

    const result = bookingSchema.safeParse(values);
    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        next[issue.path[0] as keyof Errors] = issue.message;
      }
    }
    if (hasSlots && !selectedSlot) next.slotDay = "Pick an available time";
    if (!hasSlots && !bookingDate) next.date = "Pick a date";
    if (!hasSlots && !bookingTimeSlot) next.timeSlot = "Pick a time";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitError("");

    setSubmitting(true);
    try {
      // Re-check right before showing bank details — someone else may have
      // taken this exact slot moments ago.
      const taken = await isSlotTaken(pro.id, bookingDate ?? "", bookingTimeSlot ?? "");
      if (taken) {
        setSubmitError("This slot was just booked by someone else — please pick another.");
        setSubmitting(false);
        return;
      }
      setConfirmed({ date: bookingDate ?? "", timeSlot: bookingTimeSlot ?? "" });
      setShowBankModal(true);
    } catch (err) {
      console.error("Failed to check slot availability:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!confirmed) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await createBankTransferBooking({
        professionalId: pro.id,
        professionalName: pro.name,
        amount: pro.fee,
        currency: pro.currency,
        sessionType: values.sessionType,
        date: confirmed.date,
        timeSlot: confirmed.timeSlot,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        notes: values.notes,
      });
      setShowBankModal(false);
      setBooked(true);
      setShowReminder(true);

      // Best-effort — the booking is already confirmed either way, so a
      // failed email shouldn't block or roll back anything.
      sendBankDetailsEmail({
        toEmail: values.customerEmail,
        toName: values.customerName,
        professionalName: pro.name,
        date: confirmed.date,
        timeSlot: confirmed.timeSlot,
        sessionType: values.sessionType,
        amountLabel: `${pro.currency} ${pro.fee}`,
        bankName: PAYMENT_BANK_NAME,
        bankAccountNumber: PAYMENT_BANK_ACCOUNT_NUMBER,
        bankBranch: PAYMENT_BANK_BRANCH,
        whatsappNumber: WHATSAPP_RECEIPT_NUMBER,
      }).catch((err) => console.error("Failed to send booking confirmation email:", err));
    } catch (err) {
      console.error("Failed to create booking:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't confirm your booking. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (booked && confirmed) {
    return (
      <>
        <section className="rounded-[1.75rem] border border-border bg-card p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface">
            <CheckCircle2 className="h-7 w-7 text-gold" />
          </span>
          <h2 className="mt-6 font-display text-2xl">Booking confirmed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your session with {pro.name} is booked for {confirmed.date} at {confirmed.timeSlot}.
            They'll confirm your bank transfer receipt shortly.
          </p>
          <Link
            to="/find-professionals"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Find another professional <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
        {showReminder && <PaymentReminderPopup onClose={() => setShowReminder(false)} />}
      </>
    );
  }

  return (
    <section className="sticky top-28 rounded-[1.75rem] border border-border bg-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
            Book a session
          </p>
          <p className="mt-1 font-display text-3xl">
            {pro.currency} {pro.fee}
            <span className="text-base font-sans text-muted-foreground"> {pro.rateUnit}</span>
          </p>
        </div>
        <CalendarDays className="h-6 w-6 text-gold" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {allSlotsTaken ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm text-muted-foreground">
            Every listed slot with {pro.name.split(" ")[0]} is already booked — check back soon.
          </p>
        ) : hasSlots ? (
          <div data-error={errors.slotDay ? "true" : undefined}>
            <label className={label}>
              {pro.sessionMode === "one_to_one" ? "Available session" : "Available time"}
            </label>
            <select
              value={values.slotDay}
              onChange={(e) => set("slotDay", e.target.value)}
              className={field}
            >
              {slots.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.slotDay && <p className="mt-1.5 text-xs text-destructive">{errors.slotDay}</p>}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {pro.sessionMode === "one_to_one"
                ? `Each session is a fixed 50-minute slot with ${pro.name.split(" ")[0]}.`
                : `Only the days and hours ${pro.name.split(" ")[0]} has listed as available are shown.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div data-error={errors.date ? "true" : undefined}>
              <label className={label}>Date</label>
              <input
                type="date"
                min={today}
                value={values.date}
                onChange={(e) => set("date", e.target.value)}
                className={field}
              />
              {errors.date && <p className="mt-1.5 text-xs text-destructive">{errors.date}</p>}
            </div>
            <div data-error={errors.timeSlot ? "true" : undefined}>
              <label className={label}>Time</label>
              <input
                type="time"
                value={values.timeSlot}
                onChange={(e) => set("timeSlot", e.target.value)}
                className={field}
              />
              {errors.timeSlot && (
                <p className="mt-1.5 text-xs text-destructive">{errors.timeSlot}</p>
              )}
            </div>
          </div>
        )}

        {!allSlotsTaken && (
          <>
            <div data-error={errors.sessionType ? "true" : undefined}>
              <label className={label}>Session type</label>
              <select
                value={values.sessionType}
                onChange={(e) => set("sessionType", e.target.value)}
                className={field}
              >
                {(pro.sessionType.length ? pro.sessionType : ["Online video"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.sessionType && (
                <p className="mt-1.5 text-xs text-destructive">{errors.sessionType}</p>
              )}
            </div>

            <div data-error={errors.customerName ? "true" : undefined}>
              <label className={label}>Full name</label>
              <input
                value={values.customerName}
                onChange={(e) => set("customerName", e.target.value)}
                placeholder="Your name"
                className={field}
              />
              {errors.customerName && (
                <p className="mt-1.5 text-xs text-destructive">{errors.customerName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div data-error={errors.customerEmail ? "true" : undefined}>
                <label className={label}>Email</label>
                <input
                  type="email"
                  value={values.customerEmail}
                  onChange={(e) => set("customerEmail", e.target.value)}
                  placeholder="you@email.com"
                  className={field}
                />
                {errors.customerEmail && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.customerEmail}</p>
                )}
              </div>
              <div data-error={errors.customerPhone ? "true" : undefined}>
                <label className={label}>Phone</label>
                <input
                  value={values.customerPhone}
                  onChange={(e) => set("customerPhone", e.target.value)}
                  placeholder="07XXXXXXXX"
                  className={field}
                />
                {errors.customerPhone && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.customerPhone}</p>
                )}
              </div>
            </div>

            <div>
              <label className={label}>Notes (optional)</label>
              <textarea
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Anything the professional should know beforehand"
                rows={3}
                className={field}
              />
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
                </>
              ) : (
                <>
                  Do a bank transfer <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              You'll get our bank details to complete a direct transfer.
            </p>
          </>
        )}
      </form>

      {showBankModal && confirmed && (
        <BankTransferModal
          amountLabel={`${pro.currency} ${pro.fee}`}
          submitting={submitting}
          error={submitError}
          onClose={() => setShowBankModal(false)}
          onDone={handleConfirmTransfer}
        />
      )}
    </section>
  );
}

function CopyField({ label: text, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{text}</p>
        <p className="truncate text-sm font-medium">{value || "—"}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-gold" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
    </div>
  );
}

function PaymentReminderPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-destructive/40 bg-card p-6 text-center shadow-elegant">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10">
          <Clock className="h-6 w-6 text-destructive" />
        </span>
        <h3 className="mt-4 font-display text-xl">Complete your payment</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete the transfer within <span className="font-medium text-foreground">24 hours</span>
          . Your booking is only confirmed once payment is received — after that, the slot may be
          released to someone else.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function BankTransferModal({
  amountLabel,
  submitting,
  error,
  onClose,
  onDone,
}: {
  amountLabel: string;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface">
              <Landmark className="h-5 w-5 text-gold" />
            </span>
            <div>
              <h3 className="font-display text-xl leading-tight">Bank transfer details</h3>
              <p className="text-xs text-muted-foreground">
                Transfer {amountLabel} to complete your booking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2">
          <CopyField label="Bank" value={PAYMENT_BANK_NAME} />
          <CopyField label="Name" value={PAYMENT_BANK_ACCOUNT_NAME} />
          <CopyField label="Account number" value={PAYMENT_BANK_ACCOUNT_NUMBER} />
          <CopyField label="Branch" value={PAYMENT_BANK_BRANCH} />
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-sm">
            Do the bank payment and send the receipt to{" "}
            <span className="font-medium">{WHATSAPP_RECEIPT_NUMBER}</span> through WhatsApp.
          </p>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={onDone}
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Confirm
            </>
          )}
        </button>
      </div>
    </div>
  );
}
