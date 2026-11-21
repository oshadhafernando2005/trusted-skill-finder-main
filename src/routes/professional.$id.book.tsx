import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { z } from "zod";

import {
  LONG_SESSION_MINUTES,
  SESSION_MINUTES,
  joinConsecutiveSlots,
  toLocalISODate,
} from "@/lib/slots";
import {
  getSlotAvailability,
  fetchBookedSlotKeys,
  fetchOccupiedSlots,
  type OccupiedSlot,
} from "@/lib/bookings";
import {
  cancelPendingBooking,
  createBookingCheckout,
  releaseExpiredHolds,
} from "@/lib/payhere.functions";
import { useProfessional } from "@/lib/professional-context";
import {
  formatSlotDate,
  fullDayNames,
  weekdays,
  type ProDetail,
} from "@/lib/professional-profile";

// Posts the signed checkout fields to PayHere — the browser leaves this site
// and comes back via return_url / cancel_url once the customer is done.
function submitPayHereForm(checkoutUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkoutUrl;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

// PayHere sends the customer back to this page (return_url / cancel_url) with
// ?payment=success|cancelled, plus the booking/order ids when cancelled.
type BookSearch = { payment?: string; booking?: string; order?: string };

export const Route = createFileRoute("/professional/$id/book")({
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    ...(typeof search.payment === "string" ? { payment: search.payment } : {}),
    ...(typeof search.booking === "string" ? { booking: search.booking } : {}),
    ...(typeof search.order === "string" ? { order: search.order } : {}),
  }),
  head: () => ({
    meta: [{ title: "Book a session — Booking Pro" }],
  }),
  component: BookingPage,
});

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

// A professional's declared availability is booked up to this many weeks
// ahead — e.g. "every Monday" becomes bookable on the next 2 Mondays, not
// just the single nearest one.
const BOOKING_HORIZON_WEEKS = 2;

// Every calendar date (today or later, within the booking horizon) that
// falls on the given weekday.
function occurrencesWithinHorizon(day: string): string[] {
  const targetDow = weekdays.indexOf(day);
  if (targetDow === -1) return [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const firstOffset = (targetDow - start.getDay() + 7) % 7;
  const dates: string[] = [];
  for (let week = 0; week < BOOKING_HORIZON_WEEKS; week++) {
    const d = new Date(start);
    d.setDate(d.getDate() + firstOffset + week * 7);
    dates.push(toLocalISODate(d));
  }
  return dates;
}

const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";
const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

function BookingPage() {
  const { id } = useParams({ from: "/professional/$id/book" });
  const pro = useProfessional();
  const [bookedSlotKeys, setBookedSlotKeys] = useState<Set<string>>(new Set());
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);

  // Fetch already-booked slots for this professional so the picker never
  // offers a date/time someone else has already taken.
  useEffect(() => {
    let active = true;
    (async () => {
      // Free slots first, so the picker below reflects them: the customer's own
      // cancelled checkout (PayHere sends them back with ?payment=cancelled),
      // and any abandoned checkouts whose hold has run out.
      try {
        const params = new URLSearchParams(window.location.search);
        const bookingId = params.get("booking");
        const orderId = params.get("order");
        if (params.get("payment") === "cancelled" && bookingId && orderId) {
          await cancelPendingBooking({ data: { bookingId, orderId } });
        }
        await releaseExpiredHolds({ data: { professionalId: id } });
      } catch (err) {
        console.error("Failed to release unpaid holds:", err);
      }
      try {
        const [keys, occupied] = await Promise.all([
          fetchBookedSlotKeys(id),
          fetchOccupiedSlots(id),
        ]);
        if (!active) return;
        setBookedSlotKeys(keys);
        setOccupiedSlots(occupied);
      } catch (err) {
        console.error("Failed to load booked slots:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main className="container-page py-10 lg:py-14">
      <Link
        to="/professional/$id"
        params={{ id }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <aside className="rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-28">
          <div className="flex items-center gap-4">
            <img
              src={pro.img}
              alt={pro.name}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 font-display text-2xl leading-tight">
                <span className="truncate">{pro.name}</span>
                {pro.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-gold" />}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pro.profession}
                {pro.specialization ? ` · ${pro.specialization}` : ""}
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-gold" /> {pro.sessionLength} sessions
            </li>
            <li className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 text-gold" /> Choose any open time slot
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-gold" /> Secure payment through PayHere
            </li>
          </ul>

          <Link
            to="/professional/$id"
            params={{ id }}
            className="mt-6 block rounded-full border border-border py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
          >
            Read full profile
          </Link>
        </aside>

        <BookingPanel pro={pro} bookedSlotKeys={bookedSlotKeys} occupiedSlots={occupiedSlots} />
      </div>
    </main>
  );
}

type BookableSlot = {
  key: string;
  mode: "one_to_one" | "one_to_many";
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  name?: string;
  label: string;
};

function slotKey(date: string, startTime: string, endTime: string) {
  return `${date}__${startTime}–${endTime}`;
}

function timeSlotOverlaps(startTime: string, endTime: string, occupied: OccupiedSlot) {
  const [occupiedStart, occupiedEnd] = occupied.timeSlot.split("–");
  const start = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const end = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3));
  const otherStart = Number(occupiedStart.slice(0, 2)) * 60 + Number(occupiedStart.slice(3));
  const otherEnd = Number(occupiedEnd.slice(0, 2)) * 60 + Number(occupiedEnd.slice(3));
  return start < otherEnd && otherStart < end;
}

function isSlotUnavailable(
  date: string,
  startTime: string,
  endTime: string,
  occupiedSlots: OccupiedSlot[],
) {
  return occupiedSlots.some((occupied) => {
    if (occupied.date !== date || occupied.bookedCount <= 0) return false;
    const exact = occupied.timeSlot === `${startTime}–${endTime}`;
    // A partially booked group can accept more customers in its exact same
    // session. Every other overlap is unavailable because the pro can only
    // conduct one session at a time.
    if (exact && occupied.mode === "one_to_many" && occupied.bookedCount < occupied.capacity) {
      return false;
    }
    return timeSlotOverlaps(startTime, endTime, occupied);
  });
}

function buildBookableSlots(
  pro: ProDetail,
  bookedSlotKeys: Set<string>,
  occupiedSlots: OccupiedSlot[],
  mode: "one_to_one" | "one_to_many",
  // 110 = a two-slot service; only neighbouring one-to-one slots can be joined.
  durationMinutes: number = SESSION_MINUTES,
): BookableSlot[] {
  if (mode === "one_to_many" && pro.oneToManySessions.length > 0) {
    return pro.oneToManySessions
      .filter((session) => session.date >= new Date().toISOString().slice(0, 10))
      .filter((session) => !bookedSlotKeys.has(slotKey(session.date, session.startTime, session.endTime)))
      .filter((session) => !isSlotUnavailable(session.date, session.startTime, session.endTime, occupiedSlots))
      .map((session) => ({
        key: `${mode}-${session.date}-${session.startTime}`,
        mode,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        price: session.price,
        name: session.name,
        label: `${session.name ? `${session.name} · ` : ""}${formatSlotDate(session.date)} · ${session.startTime}–${session.endTime} · ${pro.currency} ${session.price}`,
      }));
  }

  const availability = mode === "one_to_one" ? pro.oneToOneAvailability : pro.oneToManyAvailability;
  return availability.flatMap((a) => {
    const times =
      mode === "one_to_one"
        ? durationMinutes === LONG_SESSION_MINUTES
          ? joinConsecutiveSlots(a.slots)
          : a.slots.length > 0
            ? a.slots
            : [{ start: a.startTime, end: a.endTime }]
        : [{ start: a.startTime, end: a.endTime }];
    const today = toLocalISODate(new Date());
    const dates = (a.date ? [a.date] : occurrencesWithinHorizon(a.day)).filter(
      (date) => date >= today,
    );
    return dates.flatMap((date) =>
      times
        .filter((s) => !bookedSlotKeys.has(slotKey(date, s.start, s.end)))
        .filter((s) => !isSlotUnavailable(date, s.start, s.end, occupiedSlots))
        .map((s) => ({
          key: `${mode}-${date}-${s.start}`,
          mode,
          date,
          startTime: s.start,
          endTime: s.end,
          price: pro.fee,
          label: `${a.date ? "Specific date" : fullDayNames[a.day] ?? a.day} · ${formatSlotDate(date)} · ${s.start}–${s.end}`,
        })),
    );
  });
}

function BookingPanel({
  pro,
  bookedSlotKeys,
  occupiedSlots,
}: {
  pro: ProDetail;
  bookedSlotKeys: Set<string>;
  occupiedSlots: OccupiedSlot[];
}) {
  const [values, setValues] = useState({
    sessionMode: pro.sessionModes[0] ?? "one_to_one",
    // "" = the normal session; otherwise the name of one of pro.services.
    serviceName: "",
    slotDay: "",
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmed, setConfirmed] = useState<{ date: string; timeSlot: string; amount: number; sessionName: string } | null>(null);
  const [paymentResult, setPaymentResult] = useState<"success" | "cancelled" | null>(null);

  // PayHere sends the customer back here with ?payment=success|cancelled.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("payment");
    if (result === "success" || result === "cancelled") setPaymentResult(result);
  }, []);

  // Coming back with the browser's Back button from PayHere restores this page
  // mid-"submitting"; make the form usable again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const selectedService =
    values.sessionMode === "one_to_one"
      ? pro.services.find((s) => s.name === values.serviceName)
      : undefined;

  const slots = buildBookableSlots(
    pro,
    bookedSlotKeys,
    occupiedSlots,
    values.sessionMode,
    selectedService?.duration,
  );

  useEffect(() => {
    if (slots.length === 0) {
      if (values.slotDay) set("slotDay", "");
      return;
    }
    if (!slots.some((slot) => slot.key === values.slotDay)) set("slotDay", slots[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.sessionMode, values.serviceName, slots.length, bookedSlotKeys]);

  const selectedSlot = slots.find((s) => s.key === values.slotDay);
  // What the client pays: a group session has its own price, a chosen test has
  // its own price, otherwise the pro's normal session rate.
  const unitPrice =
    values.sessionMode === "one_to_many" && selectedSlot
      ? selectedSlot.price
      : (selectedService?.price ?? pro.fee);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bookingDate = selectedSlot?.date || values.date;
    const bookingTimeSlot = selectedSlot
      ? `${selectedSlot.startTime}–${selectedSlot.endTime}`
      : values.timeSlot;
    const result = bookingSchema.safeParse(values);
    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) next[issue.path[0] as keyof Errors] = issue.message;
    }
    if (!bookingDate) next.date = "Pick a date";
    if (!bookingTimeSlot) next.timeSlot = "Pick a time";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitError("");
    setSubmitting(true);
    try {
      const availability = await getSlotAvailability(pro.id, bookingDate, bookingTimeSlot);
      if (
        availability &&
        (availability.mode !== values.sessionMode ||
          availability.bookedCount >= availability.capacity)
      ) {
        setSubmitError(
          availability.mode === "one_to_many"
            ? "This group session is full — please pick another time."
            : "This time is already booked — please pick another.",
        );
        setSubmitting(false);
        return;
      }
      setConfirmed({
        date: bookingDate,
        timeSlot: bookingTimeSlot,
        amount: unitPrice,
        sessionName:
          values.sessionMode === "one_to_many"
            ? (selectedSlot?.name ?? "")
            : (selectedService?.name ?? ""),
      });
      setShowConfirmModal(true);
    } catch (err) {
      console.error("Failed to check slot availability:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWithPayHere = async () => {
    if (!confirmed) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { checkoutUrl, fields } = await createBookingCheckout({
        data: {
          professionalId: pro.id,
          professionalName: pro.name,
          amount: confirmed.amount,
          currency: pro.currency,
          sessionType: values.sessionType,
          sessionMode: values.sessionMode,
          sessionName: confirmed.sessionName,
          groupCapacity: pro.groupCapacity,
          date: confirmed.date,
          timeSlot: confirmed.timeSlot,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          notes: values.notes,
          origin: window.location.origin,
        },
      });
      // Leaves the site; `submitting` stays on so the button can't be clicked twice.
      submitPayHereForm(checkoutUrl, fields);
    } catch (err) {
      console.error("Failed to start payment:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't start your payment. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const allSlotsTaken = slots.length === 0;
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-8">
      {paymentResult === "success" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p>
            Thank you! Your payment is being confirmed by PayHere. Your booking will show as{" "}
            <span className="font-medium">Confirmed</span> in{" "}
            <Link to="/my-bookings" className="font-medium underline">
              My bookings
            </Link>{" "}
            in a moment.
          </p>
        </div>
      )}
      {paymentResult === "cancelled" && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Payment cancelled — no booking was made and you haven't been charged. You can pick a
          time and try again below.
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
            Book a session
          </p>
          <p className="mt-1 font-display text-3xl">
            {pro.currency} {unitPrice}
            <span className="text-base font-sans text-muted-foreground"> {values.sessionMode === "one_to_many" ? "per group session" : pro.rateUnit}</span>
          </p>
        </div>
        <CalendarDays className="h-6 w-6 text-gold" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={label}>Session section</label>
          <div className="grid grid-cols-2 gap-2">
            {pro.sessionModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => set("sessionMode", mode)}
                className={`rounded-xl border px-3 py-3 text-left text-sm ${values.sessionMode === mode ? "border-gold bg-gold/10" : "border-border bg-card hover:bg-muted"}`}
              >
                <span className="block font-medium">
                  {mode === "one_to_one" ? "Individual Session" : "Group Session"}
                </span>
                {mode === "one_to_many" && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Up to {pro.groupCapacity} people
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {values.sessionMode === "one_to_one" && pro.services.length > 0 && (
          <div>
            <label className={label}>What would you like to book?</label>
            <div className="grid gap-2">
              {[{ name: "", title: "Normal session", price: pro.fee, duration: SESSION_MINUTES }, ...pro.services.map((s) => ({ name: s.name, title: s.name, price: s.price, duration: s.duration }))].map((option) => (
                <button
                  key={option.name || "__normal"}
                  type="button"
                  onClick={() => set("serviceName", option.name)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm ${values.serviceName === option.name ? "border-gold bg-gold/10" : "border-border bg-card hover:bg-muted"}`}
                >
                  <span className="font-medium">
                    {option.title}
                    {option.duration > SESSION_MINUTES && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {option.duration} min
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {pro.currency} {option.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {allSlotsTaken ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm text-muted-foreground">
            {selectedService && selectedService.duration > SESSION_MINUTES
              ? `No ${selectedService.duration}-minute time is free right now (it needs two neighbouring slots) — try another session or check back soon.`
              : "Every listed slot is currently full — please check back soon."}
          </p>
        ) : (
          <div data-error={errors.slotDay ? "true" : undefined}>
            <label className={label}>Available session</label>
            <select
              value={values.slotDay}
              onChange={(e) => set("slotDay", e.target.value)}
              className={field}
            >
              {slots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.label}
                </option>
              ))}
            </select>
            {errors.slotDay && <p className="mt-1.5 text-xs text-destructive">{errors.slotDay}</p>}
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
                  placeholder="you@example.com"
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
                  placeholder="07X XXX XXXX"
                  className={field}
                />
                {errors.customerPhone && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.customerPhone}</p>
                )}
              </div>
            </div>
            <div data-error={errors.notes ? "true" : undefined}>
              <label className={label}>
                Notes{" "}
                <span className="normal-case tracking-normal text-muted-foreground/70">
                  (optional)
                </span>
              </label>
              <textarea
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Anything the professional should know?"
                className={`${field} min-h-24 resize-y`}
              />
              {errors.notes && <p className="mt-1.5 text-xs text-destructive">{errors.notes}</p>}
            </div>
            {submitError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
                </>
              ) : (
                <>
                  Continue to payment <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </>
        )}
      </form>

      {showConfirmModal && confirmed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl">Confirm booking</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You'll pay securely on PayHere. Your session is booked once the payment goes
                  through.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="rounded-full p-2 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-2 rounded-xl bg-surface p-4 text-sm">
              <p>
                <strong>
                  {values.sessionMode === "one_to_one" ? "One-to-one" : "One-to-many"}
                </strong>{" "}
                · {confirmed.date} · {confirmed.timeSlot}
              </p>
              {confirmed.sessionName && <p className="font-medium">{confirmed.sessionName}</p>}
              <p>
                {pro.currency} {confirmed.amount}
              </p>
              {values.sessionMode === "one_to_many" && (
                <p className="text-muted-foreground">Group capacity: {pro.groupCapacity}</p>
              )}
            </div>
            {submitError && <p className="mt-3 text-sm text-destructive">{submitError}</p>}
            <button
              type="button"
              onClick={handlePayWithPayHere}
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Redirecting to PayHere…
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" /> Pay {pro.currency} {confirmed.amount} with
                  PayHere
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
