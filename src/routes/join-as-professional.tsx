import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Briefcase,
  User,
} from "lucide-react";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { generateSlots } from "@/lib/slots";

export const Route = createFileRoute("/join-as-professional")({
  head: () => ({
    meta: [
      { title: "Become a Professional — Register on Booking Pro" },
      {
        name: "description",
        content:
          "Create your Booking Pro professional profile: add your name, profession, experience, hourly rate, availability and service details to start receiving bookings.",
      },
      { property: "og:title", content: "Become a Professional — Register on Booking Pro" },
      {
        property: "og:description",
        content:
          "Join 12,000+ verified experts. Register your profession, rate and availability and start getting booked on Booking Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinAsProfessional,
});

const professions = [
  "Doctor",
  "Teacher / Tutor",
  "Lawyer",
  "Accountant",
  "Engineer",
  "Therapist",
  "Consultant",
  "Designer",
  "Other",
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const sessionTypes = ["In person", "Online video", "Phone call", "Home visit"];

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(255)
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  location: z.string().trim().min(2, "Enter your city / country").max(120),
  profession: z.string().min(1, "Select your profession"),
  specialization: z.string().trim().max(120).optional().or(z.literal("")),
  experience: z.coerce.number().min(0, "Enter years of experience").max(60),
  license: z.string().trim().max(80).optional().or(z.literal("")),
  rate: z.coerce.number().min(1, "Enter your rate").max(100000),
  currency: z.string().min(1),
  rateUnit: z.string().min(1),
  sessionLength: z.string().min(1),
  sessionMode: z.enum(["one_to_one", "one_to_many"], {
    errorMap: () => ({ message: "Choose how you take sessions" }),
  }),
  availability: z
    .array(
      z.object({
        day: z.string(),
        startTime: z.string().min(1, "Set a start time"),
        endTime: z.string().min(1, "Set an end time"),
      }),
    )
    .min(1, "Pick at least one working day"),
  sessionType: z.array(z.string()).min(1, "Pick at least one session type"),
  bio: z.string().trim().min(40, "Tell clients a bit more (min 40 characters)").max(1000),
  terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

type Errors = Partial<Record<string, string>>;

const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";
const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

function JoinAsProfessional() {
  const { user } = useAuth();
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    profession: "",
    specialization: "",
    experience: "",
    license: "",
    rate: "",
    currency: "LKR",
    rateUnit: "per hour",
    sessionLength: "60 min",
    sessionMode: "one_to_many" as "one_to_one" | "one_to_many",
    availability: [] as {
      day: string;
      startTime: string;
      endTime: string;
    }[],
    sessionType: [] as string[],
    bio: "",
    terms: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  // Prefill the email field if the applicant is already signed in.
  useEffect(() => {
    if (user?.email) {
      setValues((v) => (v.email ? v : { ...v, email: user.email as string }));
    }
  }, [user]);

  const toggleDay = (day: string) => {
    setValues((v) => {
      const exists = v.availability.some((item) => item.day === day);

      if (exists) {
        return {
          ...v,
          availability: v.availability.filter((item) => item.day !== day),
        };
      }

      return {
        ...v,
        availability: [
          ...v.availability,
          {
            day,
            startTime: "09:00",
            endTime: "17:00",
          },
        ],
      };
    });
  };

  const updateAvailability = (day: string, field: "startTime" | "endTime", value: string) => {
    setValues((v) => ({
      ...v,
      availability: v.availability.map((item) =>
        item.day === day ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const toggle = (key: "sessionType", value: string) => {
    setValues((v) => ({
      ...v,
      [key]: v[key].includes(value) ? v[key].filter((item) => item !== value) : [...v[key], value],
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const k = String(issue.path[0]);
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      const first = document.querySelector<HTMLElement>("[data-error='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});

    if (result.data.sessionMode === "one_to_one") {
      const tooShort = result.data.availability.find(
        (item) => generateSlots(item.startTime, item.endTime).length === 0,
      );
      if (tooShort) {
        setErrors({
          availability: `${tooShort.day}'s window is too short to fit a 50-minute session with a 10-minute break.`,
        });
        const first = document.querySelector<HTMLElement>("[data-error='true']");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      const availability =
        result.data.sessionMode === "one_to_one"
          ? result.data.availability.map((item) => ({
              ...item,
              slots: generateSlots(item.startTime, item.endTime),
            }))
          : result.data.availability;

      await addDoc(collection(db, "professionals"), {
        ...result.data,
        availability,
        uid: user?.uid ?? null, // links this application to a Booking Pro login, if signed in
        status: "pending", // pending | approved | rejected — for your verification workflow
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Failed to submit professional application:", err);
      setSubmitError("Something went wrong submitting your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4 text-gold" />
            </span>
            <span className="font-display text-2xl tracking-tight">Booking Pro</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      {submitted ? (
        <Success name={values.fullName} />
      ) : (
        <>
          <section className="relative overflow-hidden border-b border-border">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-40 -right-32 h-[440px] w-[440px] rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle, var(--gold), transparent 70%)" }}
            />
            <div className="container-page py-16 lg:py-20">
              <p className="text-xs uppercase tracking-[0.18em] text-gold">For professionals</p>
              <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] md:text-6xl">
                Register your <span className="italic text-gold">professional profile</span>.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                Tell us who you are, what you do, how much you charge and when you're available.
                Verified profiles usually go live within 48 hours.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {["Zero listing fees", "Verified badge", "Weekly payouts"].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
                  >
                    <BadgeCheck className="h-4 w-4 text-gold" /> {t}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <form
            onSubmit={onSubmit}
            noValidate
            className="container-page grid gap-8 py-16 lg:grid-cols-[1.6fr_1fr] lg:items-start"
          >
            <div className="grid gap-8">
              <Card icon={User} title="Personal details" step="01">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="fullName" label="Full name" error={errors.fullName}>
                    <input
                      id="fullName"
                      className={field}
                      placeholder="Dr. Amelia Reyes"
                      value={values.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                    />
                  </Field>
                  <Field id="email" label="Email address" error={errors.email}>
                    <input
                      id="email"
                      type="email"
                      className={field}
                      placeholder="you@example.com"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>
                  <Field id="phone" label="Phone number" error={errors.phone}>
                    <input
                      id="phone"
                      className={field}
                      placeholder="+1 555 000 1234"
                      value={values.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </Field>
                  <Field id="location" label="City / country" error={errors.location}>
                    <input
                      id="location"
                      className={field}
                      placeholder="New York, USA"
                      value={values.location}
                      onChange={(e) => set("location", e.target.value)}
                    />
                  </Field>
                </div>
              </Card>

              <Card icon={Briefcase} title="Profession & experience" step="02">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="profession" label="Profession" error={errors.profession}>
                    <select
                      id="profession"
                      className={field}
                      value={values.profession}
                      onChange={(e) => set("profession", e.target.value)}
                    >
                      <option value="">Select a profession</option>
                      {professions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id="specialization"
                    label="Specialization (optional)"
                    error={errors.specialization}
                  >
                    <input
                      id="specialization"
                      className={field}
                      placeholder="Cardiology, Tax law, Algebra…"
                      value={values.specialization}
                      onChange={(e) => set("specialization", e.target.value)}
                    />
                  </Field>
                  <Field id="experience" label="Years of experience" error={errors.experience}>
                    <input
                      id="experience"
                      type="number"
                      min={0}
                      className={field}
                      placeholder="8"
                      value={values.experience}
                      onChange={(e) => set("experience", e.target.value)}
                    />
                  </Field>
                  <Field
                    id="license"
                    label="License / registration no. (optional)"
                    error={errors.license}
                  >
                    <input
                      id="license"
                      className={field}
                      placeholder="e.g. MD-482913"
                      value={values.license}
                      onChange={(e) => set("license", e.target.value)}
                    />
                  </Field>
                </div>
              </Card>

              <Card icon={DollarSign} title="Rate & session" step="03">
                <div className="grid gap-5 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Field id="rate" label="Your rate" error={errors.rate}>
                      <div className="flex gap-2">
                        <select
                          aria-label="Currency"
                          className={`${field} w-28`}
                          value={values.currency}
                          onChange={(e) => set("currency", e.target.value)}
                        >
                          {["LKR", "USD", "EUR", "GBP", "INR", "AED"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                        <input
                          id="rate"
                          type="number"
                          min={1}
                          className={field}
                          placeholder="120"
                          value={values.rate}
                          onChange={(e) => set("rate", e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>
                  <Field id="rateUnit" label="Billing" error={errors.rateUnit}>
                    <select
                      id="rateUnit"
                      className={field}
                      value={values.rateUnit}
                      onChange={(e) => set("rateUnit", e.target.value)}
                    >
                      {["per hour", "per session", "per day", "per project"].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </Field>
                  <Field id="sessionLength" label="Session length" error={errors.sessionLength}>
                    <select
                      id="sessionLength"
                      className={field}
                      value={values.sessionLength}
                      onChange={(e) => set("sessionLength", e.target.value)}
                    >
                      {["30 min", "45 min", "60 min", "90 min", "120 min"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-5" data-error={errors.sessionType ? "true" : undefined}>
                  <span className={label}>Session types</span>
                  <div className="flex flex-wrap gap-2">
                    {sessionTypes.map((s) => (
                      <Chip
                        key={s}
                        active={values.sessionType.includes(s)}
                        onClick={() => toggle("sessionType", s)}
                      >
                        {s}
                      </Chip>
                    ))}
                  </div>
                  {errors.sessionType && <ErrorText>{errors.sessionType}</ErrorText>}
                </div>
              </Card>

              <Card icon={Clock} title="Availability" step="04">
                <div className="mb-6" data-error={errors.sessionMode ? "true" : undefined}>
                  <span className={label}>How do you take sessions?</span>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      active={values.sessionMode === "one_to_many"}
                      onClick={() => set("sessionMode", "one_to_many")}
                    >
                      One-to-many (group / flexible)
                    </Chip>
                    <Chip
                      active={values.sessionMode === "one_to_one"}
                      onClick={() => set("sessionMode", "one_to_one")}
                    >
                      One-to-one (auto 50-min slots)
                    </Chip>
                  </div>
                  {values.sessionMode === "one_to_one" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Set your available window per day below — it'll automatically split into
                      50-minute sessions with a 10-minute break between each.
                    </p>
                  )}
                  {errors.sessionMode && <ErrorText>{errors.sessionMode}</ErrorText>}
                </div>

                <div data-error={errors.availability ? "true" : undefined}>
                  <span className={label}>Working days</span>

                  <div className="flex flex-wrap gap-2">
                    {days.map((day) => {
                      const selected = values.availability.some((item) => item.day === day);

                      return (
                        <Chip key={day} active={selected} onClick={() => toggleDay(day)}>
                          {day}
                        </Chip>
                      );
                    })}
                  </div>

                  {errors.availability && <ErrorText>{errors.availability}</ErrorText>}
                </div>

                {values.availability.length > 0 && (
                  <div className="mt-6 grid gap-4">
                    <span className={label}>Availability for each day</span>

                    {values.availability.map((item) => (
                      <div
                        key={item.day}
                        className="rounded-2xl border border-border bg-surface p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="font-medium">{item.day}</span>

                          <button
                            type="button"
                            onClick={() => toggleDay(item.day)}
                            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`${item.day}-start`} className={label}>
                              Available from
                            </label>

                            <input
                              id={`${item.day}-start`}
                              type="time"
                              className={field}
                              value={item.startTime}
                              onChange={(e) =>
                                updateAvailability(item.day, "startTime", e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label htmlFor={`${item.day}-end`} className={label}>
                              Available until
                            </label>

                            <input
                              id={`${item.day}-end`}
                              type="time"
                              className={field}
                              value={item.endTime}
                              onChange={(e) =>
                                updateAvailability(item.day, "endTime", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        {values.sessionMode === "one_to_one" && (
                          <div className="mt-4">
                            <p className="mb-2 text-xs text-muted-foreground">
                              Auto-generated sessions (50 min, 10-min breaks)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {generateSlots(item.startTime, item.endTime).map((slot) => (
                                <span
                                  key={slot.start}
                                  className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                                >
                                  {slot.start}–{slot.end}
                                </span>
                              ))}
                              {generateSlots(item.startTime, item.endTime).length === 0 && (
                                <span className="text-xs text-destructive">
                                  Window too short for a session
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card icon={Sparkles} title="About you" step="05">
                <Field id="bio" label="Professional bio" error={errors.bio}>
                  <textarea
                    id="bio"
                    rows={5}
                    className={`${field} resize-none`}
                    placeholder="Describe your background, approach and who you help best…"
                    value={values.bio}
                    onChange={(e) => set("bio", e.target.value)}
                  />
                </Field>
                <p className="mt-2 text-xs text-muted-foreground">
                  {values.bio.trim().length}/1000 characters
                </p>
                <div className="mt-6" data-error={errors.terms ? "true" : undefined}>
                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[var(--gold)]"
                      checked={values.terms}
                      onChange={(e) => set("terms", e.target.checked)}
                    />
                    <span>
                      I confirm the information above is accurate and I accept Booking Pro's
                      professional terms, verification checks and privacy policy.
                    </span>
                  </label>
                  {errors.terms && <ErrorText>{errors.terms}</ErrorText>}
                </div>
                {submitError && <ErrorText>{submitError}</ErrorText>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {submitting ? "Submitting…" : "Submit application"}{" "}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </Card>
            </div>

            <aside className="sticky top-28 grid gap-4 rounded-[1.75rem] bg-surface p-8">
              <h2 className="font-display text-3xl">Profile preview</h2>
              <p className="text-sm text-muted-foreground">
                This is roughly how clients will see you in search results.
              </p>
              <div className="mt-2 rounded-2xl border border-border bg-card p-5">
                <p className="font-display text-2xl">{values.fullName || "Your name"}</p>
                <p className="text-sm text-gold">
                  {values.profession || "Profession"}
                  {values.specialization ? ` · ${values.specialization}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {values.location || "City, Country"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-3 py-1">
                    {values.experience ? `${values.experience} yrs exp.` : "Experience"}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    {values.rate
                      ? `${values.currency} ${values.rate} ${values.rateUnit}`
                      : "Your rate"}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    {values.sessionLength}
                  </span>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  {values.availability.length === 0 ? (
                    "Working days"
                  ) : values.sessionMode === "one_to_one" ? (
                    <ScheduleGrid availability={values.availability} />
                  ) : (
                    <div className="grid gap-1">
                      {values.availability.map((item) => (
                        <span key={item.day}>
                          {item.day} {item.startTime}–{item.endTime}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <ul className="grid gap-3 text-sm">
                {[
                  "Verification usually takes 24–48 hours",
                  "You can edit your rate and hours anytime",
                  "Only pay a fee when you get booked",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {t}
                  </li>
                ))}
              </ul>
            </aside>
          </form>
        </>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  step,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface">
          <Icon className="h-5 w-5 text-gold" />
        </span>
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
            Step {step}
          </p>
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label: text,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-error={error ? "true" : undefined}>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-destructive">{children}</p>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? "border-gold bg-gold text-gold-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ScheduleGrid({
  availability,
}: {
  availability: { day: string; startTime: string; endTime: string }[];
}) {
  return (
    <div
      className="grid gap-3 text-left"
      style={{ gridTemplateColumns: `repeat(${availability.length}, minmax(56px, 1fr))` }}
    >
      {availability.map((item) => {
        const slots = generateSlots(item.startTime, item.endTime);
        return (
          <div key={item.day}>
            <p className="mb-2 font-medium text-foreground">{item.day}</p>
            <div className="grid gap-1.5">
              {slots.length === 0 && <span className="text-muted-foreground">—</span>}
              {slots.map((s) => (
                <span key={s.start} className="underline decoration-border underline-offset-2">
                  {s.start}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Success({ name }: { name: string }) {
  return (
    <section className="container-page flex min-h-[70vh] items-center py-20">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-surface">
          <CheckCircle2 className="h-8 w-8 text-gold" />
        </span>
        <h1 className="mt-8 text-4xl md:text-5xl">Application received.</h1>
        <p className="mt-4 text-muted-foreground">
          Thanks{name ? `, ${name.split(" ")[0]}` : ""} — our verification team is reviewing your
          profile. You'll hear from us within 48 hours, and your listing goes live right after
          approval.
        </p>
        <Link
          to="/"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          Back to home <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
