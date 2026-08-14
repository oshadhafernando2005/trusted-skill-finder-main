import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { z } from "zod";

import { db } from "@/lib/firebase";
import { createBookingCheckout } from "@/lib/payhere.server";
import proTeacher from "@/assets/pro-teacher.jpg";

declare global {
  interface Window {
    payhere?: {
      onCompleted?: (orderId: string) => void;
      onDismissed?: () => void;
      onError?: (error: string) => void;
      startPayment: (payment: Record<string, unknown>) => void;
    };
  }
}

export const Route = createFileRoute("/professional/$id")({
  head: () => ({
    meta: [{ title: "Book a session — Consulta" }],
  }),
  component: ProfessionalDetail,
});

type ProDetail = {
  id: string;
  img: string;
  name: string;
  profession: string;
  specialization: string;
  bio: string;
  years: number;
  fee: number;
  currency: string;
  rateUnit: string;
  sessionLength: string;
  location: string;
  availability: DayAvailability[];
  sessionType: string[];
  verified: boolean;
};

// One working day with its own hours — matches the "join as professional" form.
type DayAvailability = {
  day: string;
  startTime: string;
  endTime: string;
};

function normalizeAvailability(raw: unknown): DayAvailability[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      day: typeof item.day === "string" ? item.day : "",
      startTime: typeof item.startTime === "string" ? item.startTime : "",
      endTime: typeof item.endTime === "string" ? item.endTime : "",
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
  const [payhereReady, setPayhereReady] = useState(false);

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
          img: proTeacher, // TODO: swap for a real uploaded photo per professional
          name: typeof d.fullName === "string" ? d.fullName : "Unnamed professional",
          profession: typeof d.profession === "string" ? d.profession : "Professional",
          specialization: typeof d.specialization === "string" ? d.specialization : "",
          bio: typeof d.bio === "string" ? d.bio : "",
          years: Number(d.experience) || 0,
          fee: Number(d.rate) || 0,
          currency: typeof d.currency === "string" ? d.currency : "USD",
          rateUnit: typeof d.rateUnit === "string" ? d.rateUnit : "per hour",
          sessionLength: typeof d.sessionLength === "string" ? d.sessionLength : "60 min",
          location: typeof d.location === "string" ? d.location : "Remote",
          availability: normalizeAvailability(d.availability),
          sessionType: Array.isArray(d.sessionType) ? (d.sessionType as string[]) : [],
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

  // Load the PayHere onsite checkout SDK once.
  useEffect(() => {
    if (window.payhere) {
      setPayhereReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.payhere.lk/lib/payhere.js";
    script.async = true;
    script.onload = () => setPayhereReady(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4 text-gold" />
            </span>
            <span className="font-display text-2xl tracking-tight">Consulta</span>
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
            <img src={pro.img} alt={pro.name} className="h-64 w-full object-cover" />
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

              {pro.availability.length > 0 && (
                <div>
                  <p className={label}>Available days</p>
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

        <BookingPanel pro={pro} payhereReady={payhereReady} />
      </main>
    </div>
  );
}

function BookingPanel({ pro, payhereReady }: { pro: ProDetail; payhereReady: boolean }) {
  const slots = pro.availability.map((a) => {
    const date = nextOccurrence(a.day);
    return {
      key: a.day,
      date,
      startTime: a.startTime,
      endTime: a.endTime,
      label: `${fullDayNames[a.day] ?? a.day} · ${formatSlotDate(date)} · ${a.startTime}–${a.endTime}`,
    };
  });
  const hasSlots = slots.length > 0;

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
  const [paid, setPaid] = useState(false);
  const [confirmed, setConfirmed] = useState({ date: "", timeSlot: "" });

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

    if (!payhereReady || !window.payhere) {
      setSubmitError("Payment provider is still loading — please try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      const checkout = await createBookingCheckout({
        data: {
          professionalId: pro.id,
          professionalName: pro.name,
          amount: pro.fee,
          currency: pro.currency,
          sessionType: values.sessionType,
          date: bookingDate ?? "",
          timeSlot: bookingTimeSlot ?? "",
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          notes: values.notes,
        },
      });
      setConfirmed({ date: bookingDate ?? "", timeSlot: bookingTimeSlot ?? "" });

      const [firstName, ...rest] = values.customerName.trim().split(" ");

      window.payhere.onCompleted = async () => {
        try {
          const { doc, updateDoc } = await import("firebase/firestore");
          await updateDoc(doc(db, "bookings", checkout.bookingId), { status: "paid" });
        } catch (err) {
          console.error("Failed to update booking after payment:", err);
        }
        setPaid(true);
        setSubmitting(false);
      };
      window.payhere.onDismissed = () => {
        setSubmitting(false);
      };
      window.payhere.onError = (error) => {
        console.error("PayHere error:", error);
        setSubmitError("Payment failed. Please try again.");
        setSubmitting(false);
      };

      window.payhere.startPayment({
        sandbox: checkout.sandbox,
        merchant_id: checkout.merchantId,
        return_url: undefined,
        cancel_url: undefined,
        notify_url: `${window.location.origin}/api/payhere-notify`,
        order_id: checkout.orderId,
        items: `${pro.profession} session with ${pro.name}`,
        amount: checkout.amount,
        currency: checkout.currency,
        hash: checkout.hash,
        first_name: firstName || values.customerName,
        last_name: rest.join(" ") || ".",
        email: values.customerEmail,
        phone: values.customerPhone,
        address: pro.location,
        city: pro.location,
        country: "Sri Lanka",
      });
    } catch (err) {
      console.error("Failed to start checkout:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't start checkout. Please try again.",
      );
      setSubmitting(false);
    }
  };

  if (paid) {
    return (
      <section className="rounded-[1.75rem] border border-border bg-card p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface">
          <CheckCircle2 className="h-7 w-7 text-gold" />
        </span>
        <h2 className="mt-6 font-display text-2xl">Booking confirmed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your session with {pro.name} is booked for {confirmed.date} at {confirmed.timeSlot}. A
          confirmation has been sent to {values.customerEmail}.
        </p>
        <Link
          to="/find-professionals"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Find another professional <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
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
        {hasSlots ? (
          <div data-error={errors.slotDay ? "true" : undefined}>
            <label className={label}>Available time</label>
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
              Only the days and hours {pro.name.split(" ")[0]} has listed as available are shown.
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
          disabled={submitting || !payhereReady}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              Pay {pro.currency} {pro.fee} with PayHere <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Secure checkout powered by PayHere. You'll be charged only after confirming payment.
        </p>
      </form>
    </section>
  );
}
