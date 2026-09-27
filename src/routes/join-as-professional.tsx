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
  ImagePlus,
  Loader2,
  ListChecks,
  Plus,
  X,
} from "lucide-react";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { generateSlots } from "@/lib/slots";
import { validatePhotoFile, uploadProfessionalPhoto, makeOwnerKey } from "@/lib/photo-upload";
import { Logo } from "@/components/logo";

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

const professions = ["Accountant", "Engineer", "Consultant", "Other"];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Day-of-month of the next upcoming occurrence of this weekday, so "Working
// days" can show e.g. "22 Mon" instead of just "Mon".
function nextOccurrenceDayOfMonth(day: string): number {
  const targetDow = weekdayIndex[day];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((targetDow - d.getDay() + 7) % 7));
  return d.getDate();
}

const sessionTypes = ["Online video"];

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
  company: z.string().trim().max(120).optional().or(z.literal("")),
  profession: z.string().min(1, "Select your profession"),
  specialization: z.string().trim().max(120).optional().or(z.literal("")),
  experience: z.coerce.number().min(0, "Enter years of experience").max(60),
  license: z.string().trim().max(80).optional().or(z.literal("")),
  rate: z.coerce.number().min(1, "Enter your rate").max(100000),
  sessionModes: z.array(z.enum(["one_to_one", "one_to_many"])).min(1, "Choose at least one session type"),
  groupCapacity: z.coerce.number().int().min(2, "Group capacity must be at least 2").max(100, "Group capacity cannot exceed 100"),
  oneToOneAvailability: z.array(
    z.object({ day: z.string(), startTime: z.string().min(1), endTime: z.string().min(1), removedSlots: z.array(z.string()).default([]) }),
  ),
  oneToManyAvailability: z.array(
    z.object({ day: z.string(), startTime: z.string().min(1), endTime: z.string().min(1), removedSlots: z.array(z.string()).default([]) }),
  ),
  availability: z
    .array(
      z.object({
        day: z.string(),
        startTime: z.string().min(1, "Set a start time"),
        endTime: z.string().min(1, "Set an end time"),
        removedSlots: z.array(z.string()).default([]),
      }),
    )
    .min(1, "Pick at least one working day"),
  sessionType: z.array(z.string()).min(1, "Pick at least one session type"),
  workAreas: z.array(z.string().trim().min(1).max(80)).max(30),
  bio: z.string().trim().min(40, "Tell clients a bit more (min 40 characters)").max(4000),
  terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

// Rate & session terms are fixed for now — every professional bills in LKR
// per session, matching the 50-min auto-generated slots. Only the rate
// amount itself is entered by the professional.
const FIXED_CURRENCY = "LKR";
const FIXED_RATE_UNIT = "per session";
const FIXED_SESSION_LENGTH = "50 min";

type Errors = Partial<Record<string, string>>;

const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";
const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

function JoinAsProfessional() {
  const { user, loading: authLoading } = useAuth();
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    company: "",
    profession: "",
    specialization: "",
    experience: "",
    license: "",
    rate: "",
    sessionModes: [] as ("one_to_one" | "one_to_many")[],
    groupCapacity: 10,
    availability: [] as { day: string; startTime: string; endTime: string; removedSlots: string[] }[],
    oneToOneAvailability: [] as { day: string; startTime: string; endTime: string; removedSlots: string[] }[],
    oneToManyAvailability: [] as { day: string; startTime: string; endTime: string; removedSlots: string[] }[],
    sessionType: [] as string[],
    workAreas: [] as string[],
    bio: "",
    terms: false,
  });
  const [workAreaInput, setWorkAreaInput] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uploadStage, setUploadStage] = useState<"idle" | "photo" | "saving">("idle");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [photoError, setPhotoError] = useState("");

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validatePhotoFile(file);
    if (error) {
      setPhotoError(error);
      return;
    }
    setPhotoError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  const addWorkArea = () => {
    const next = workAreaInput.trim();
    if (!next) return;
    setValues((v) =>
      v.workAreas.includes(next) || v.workAreas.length >= 30
        ? v
        : { ...v, workAreas: [...v.workAreas, next] },
    );
    setWorkAreaInput("");
  };

  const removeWorkArea = (area: string) => {
    setValues((v) => ({ ...v, workAreas: v.workAreas.filter((a) => a !== area) }));
  };

  // Prefill the email field if the applicant is already signed in.
  useEffect(() => {
    if (user?.email) {
      setValues((v) => (v.email ? v : { ...v, email: user.email as string }));
    }
  }, [user]);

  const toggleDay = (mode: "one_to_one" | "one_to_many", day: string) => {
    const key = mode === "one_to_one" ? "oneToOneAvailability" : "oneToManyAvailability";
    setValues((v) => {
      const list = v[key];
      const exists = list.some((item) => item.day === day);
      return {
        ...v,
        [key]: exists
          ? list.filter((item) => item.day !== day)
          : [...list, { day, startTime: "09:00", endTime: "17:00", removedSlots: [] }],
      };
    });
  };

  const updateAvailability = (mode: "one_to_one" | "one_to_many", day: string, field: "startTime" | "endTime", value: string) => {
    const key = mode === "one_to_one" ? "oneToOneAvailability" : "oneToManyAvailability";
    setValues((v) => ({
      ...v,
      [key]: v[key].map((item) =>
        item.day === day ? { ...item, [field]: value, removedSlots: [] } : item,
      ),
    }));
  };

  const toggleSlot = (day: string, slotStart: string) => {
    setValues((v) => ({
      ...v,
      oneToOneAvailability: v.oneToOneAvailability.map((item) =>
        item.day === day
          ? {
              ...item,
              removedSlots: item.removedSlots.includes(slotStart)
                ? item.removedSlots.filter((s) => s !== slotStart)
                : [...item.removedSlots, slotStart],
            }
          : item,
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
    const activeModes = [
      ...(values.oneToOneAvailability.length > 0 ? ["one_to_one" as const] : []),
      ...(values.oneToManyAvailability.length > 0 ? ["one_to_many" as const] : []),
    ];
    const result = schema.safeParse({
      ...values,
      sessionModes: activeModes,
      availability: values.oneToOneAvailability.length > 0 ? values.oneToOneAvailability : values.oneToManyAvailability,
    });
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

    if (result.data.sessionModes.includes("one_to_one")) {
      const tooShort = result.data.oneToOneAvailability.find(
        (item) => generateSlots(item.startTime, item.endTime).length === 0,
      );
      if (tooShort) {
        setErrors({ availability: `${tooShort.day}'s one-to-one window is too short to fit a 50-minute session with a 10-minute break.` });
        return;
      }
      const emptyDay = result.data.oneToOneAvailability.find((item) =>
        generateSlots(item.startTime, item.endTime).filter((s) => !item.removedSlots.includes(s.start)).length === 0,
      );
      if (emptyDay) {
        setErrors({ availability: `You've removed every one-to-one session on ${emptyDay.day}.` });
        return;
      }
    }

    // The two schedules are intentionally independent, but their time windows
    // must never overlap on the same day. A time cannot be both private and group.
    for (const one of result.data.oneToOneAvailability) {
      const oneStart = Number(one.startTime.replace(":", ""));
      const oneEnd = Number(one.endTime.replace(":", ""));
      const overlap = result.data.oneToManyAvailability.find((many) => {
        if (many.day !== one.day) return false;
        const manyStart = Number(many.startTime.replace(":", ""));
        const manyEnd = Number(many.endTime.replace(":", ""));
        return oneStart < manyEnd && manyStart < oneEnd;
      });
      if (overlap) {
        setErrors({ availability: `${one.day} has overlapping one-to-one and one-to-many times. Use separate time windows.` });
        return;
      }
    }

    if (result.data.oneToOneAvailability.length === 0 && result.data.oneToManyAvailability.length === 0) {
      setErrors({ availability: "Add at least one one-to-one or one-to-many availability window." });
      return;
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      let photoURL: string | null = null;
      if (photoFile) {
        setUploadStage("photo");
        try {
          photoURL = await uploadProfessionalPhoto(photoFile, makeOwnerKey(user?.uid));
        } catch (err) {
          console.error("Failed to upload photo:", err);
          setSubmitError("Couldn't upload your photo. Please try again.");
          setSubmitting(false);
          setUploadStage("idle");
          return;
        }
      }

      setUploadStage("saving");
      const oneToOneAvailability = result.data.oneToOneAvailability.map(({ removedSlots, ...item }) => ({
        ...item,
        slots: generateSlots(item.startTime, item.endTime).filter((s) => !removedSlots.includes(s.start)),
      }));
      const oneToManyAvailability = result.data.oneToManyAvailability.map(({ removedSlots, ...item }) => item);
      const availability = oneToOneAvailability.length > 0 ? oneToOneAvailability : oneToManyAvailability;

      await addDoc(collection(db, "professionals"), {
        ...result.data,
        sessionMode: result.data.sessionModes.length === 1 ? result.data.sessionModes[0] : "one_to_many",
        availability,
        oneToOneAvailability,
        oneToManyAvailability,
        currency: FIXED_CURRENCY,
        rateUnit: FIXED_RATE_UNIT,
        sessionLength: FIXED_SESSION_LENGTH,
        photoURL,
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
      setUploadStage("idle");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      {authLoading ? (
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !user ? (
        <SignInRequired />
      ) : submitted ? (
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
                <div className="mb-6">
                  <span className={label}>Profile photo (optional)</span>
                  <div className="flex items-center gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Profile preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="photo"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        {photoFile ? "Change photo" : "Upload photo"}
                      </label>
                      <input
                        id="photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={handlePhotoChange}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        JPG, PNG or WEBP, up to 5MB.
                      </p>
                      {photoError && <ErrorText>{photoError}</ErrorText>}
                    </div>
                  </div>
                </div>

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
                      placeholder="+94 12 002 4555"
                      value={values.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </Field>
                  <Field id="location" label="City / country" error={errors.location}>
                    <input
                      id="location"
                      className={field}
                      placeholder="Colombo, Sri Lanka"
                      value={values.location}
                      onChange={(e) => set("location", e.target.value)}
                    />
                  </Field>
                  <Field
                    id="company"
                    label="Company / organization (optional)"
                    error={errors.company}
                  >
                    <input
                      id="company"
                      className={field}
                      placeholder=""
                      value={values.company}
                      onChange={(e) => set("company", e.target.value)}
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
                <Field id="rate" label="Your rate per session" error={errors.rate}>
                  <div className="flex gap-2">
                    <span className="flex w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-2 py-3 text-sm text-muted-foreground">
                      LKR
                    </span>
                    <input
                      id="rate"
                      type="number"
                      min={1}
                      className={field}
                      placeholder="3000"
                      value={values.rate}
                      onChange={(e) => set("rate", e.target.value)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Every session is a fixed 50-minute slot, billed per session in LKR.
                  </p>
                </Field>
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
                <div className="grid gap-8">
                  {([
                    { mode: "one_to_one" as const, title: "One-to-one availability", text: "Private 50-minute sessions. These times are only for individual clients." },
                    { mode: "one_to_many" as const, title: "One-to-many availability", text: "Group sessions. These times are kept separate from private sessions." },
                  ]).map(({ mode, title, text }) => {
                    const key = mode === "one_to_one" ? "oneToOneAvailability" : "oneToManyAvailability";
                    const list = values[key];
                    return (
                      <section key={mode} className="rounded-2xl border border-border bg-surface/60 p-5">
                        <div className="mb-4">
                          <h3 className="font-display text-xl">{title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                        </div>
                        {mode === "one_to_many" && (
                          <div className="mb-5">
                            <label className={label}>Maximum people in a group</label>
                            <input type="number" min={2} max={100} className={field} value={values.groupCapacity} onChange={(e) => set("groupCapacity", Number(e.target.value))} />
                          </div>
                        )}
                        <span className={label}>Working days</span>
                        <div className="flex flex-wrap gap-2">
                          {days.map((day) => {
                            const selected = list.some((item) => item.day === day);
                            return <Chip key={day} active={selected} onClick={() => toggleDay(mode, day)}>{nextOccurrenceDayOfMonth(day)} {day}</Chip>;
                          })}
                        </div>
                        {list.length > 0 && (
                          <div className="mt-5 grid gap-4">
                            {list.map((item) => (
                              <div key={item.day} className="rounded-xl border border-border bg-card p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="font-medium">{nextOccurrenceDayOfMonth(item.day)} {item.day}</span>
                                  <button type="button" onClick={() => toggleDay(mode, item.day)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div><label className={label}>Available from</label><input type="time" className={field} value={item.startTime} onChange={(e) => updateAvailability(mode, item.day, "startTime", e.target.value)} /></div>
                                  <div><label className={label}>Available until</label><input type="time" className={field} value={item.endTime} onChange={(e) => updateAvailability(mode, item.day, "endTime", e.target.value)} /></div>
                                </div>
                                {mode === "one_to_one" && (
                                  <div className="mt-4">
                                    <p className="mb-2 text-xs text-muted-foreground">Tap a session to remove it, for example for a lunch break.</p>
                                    <div className="flex flex-wrap gap-2">
                                      {generateSlots(item.startTime, item.endTime).map((slot) => {
                                        const removed = item.removedSlots.includes(slot.start);
                                        return <button key={slot.start} type="button" onClick={() => toggleSlot(item.day, slot.start)} className={`rounded-full border px-3 py-1 text-xs ${removed ? "border-border bg-muted text-muted-foreground line-through" : "border-gold/50 bg-gold/10"}`}>{slot.start}–{slot.end}</button>;
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
                {errors.availability && <ErrorText>{errors.availability}</ErrorText>}
              </Card>

              <Card icon={ListChecks} title="Work areas" step="05">
                <p className="mb-4 text-sm text-muted-foreground">
                  Add the specific areas you work in — e.g. "Australian Accounting", "US Tax
                  Filing", "GST Registration". Add as many as you like; clients see these on your
                  profile.
                </p>
                <div className="flex gap-2">
                  <input
                    className={field}
                    placeholder="e.g. Australian Accounting"
                    value={workAreaInput}
                    onChange={(e) => setWorkAreaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addWorkArea();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addWorkArea}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                {values.workAreas.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {values.workAreas.map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 py-1.5 pl-4 pr-2 text-sm"
                      >
                        {area}
                        <button
                          type="button"
                          onClick={() => removeWorkArea(area)}
                          aria-label={`Remove ${area}`}
                          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {errors.workAreas && <ErrorText>{errors.workAreas}</ErrorText>}
              </Card>

              <Card icon={Sparkles} title="About you" step="06">
                <Field id="bio" label="Professional bio" error={errors.bio}>
                  <textarea
                    id="bio"
                    rows={9}
                    className={`${field} resize-none`}
                    placeholder="Describe your background, approach and who you help best…"
                    value={values.bio}
                    onChange={(e) => set("bio", e.target.value)}
                  />
                </Field>
                <p className="mt-2 text-xs text-muted-foreground">
                  {values.bio.trim().length}/4000 characters
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
                  {uploadStage === "photo"
                    ? "Uploading photo…"
                    : submitting
                      ? "Submitting…"
                      : "Submit application"}{" "}
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
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-display text-2xl leading-tight">
                      {values.fullName || "Your name"}
                    </p>
                    {values.company && (
                      <p className="text-xs text-muted-foreground">{values.company}</p>
                    )}
                  </div>
                </div>
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
                    {values.rate ? `LKR ${values.rate} per session` : "Your rate"}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    {FIXED_SESSION_LENGTH}
                  </span>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  {values.oneToOneAvailability.length === 0 && values.oneToManyAvailability.length === 0 ? (
                    "Availability"
                  ) : (
                    <div className="grid gap-2">
                      {values.oneToOneAvailability.length > 0 && <ScheduleGrid availability={values.oneToOneAvailability} />}
                      {values.oneToManyAvailability.map((item) => <span key={`group-${item.day}`}>Group · {item.day} {item.startTime}–{item.endTime}</span>)}
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
  availability: { day: string; startTime: string; endTime: string; removedSlots: string[] }[];
}) {
  return (
    <div
      className="grid gap-3 text-left"
      style={{ gridTemplateColumns: `repeat(${availability.length}, minmax(56px, 1fr))` }}
    >
      {availability.map((item) => {
        const slots = generateSlots(item.startTime, item.endTime).filter(
          (s) => !item.removedSlots.includes(s.start),
        );
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

function SignInRequired() {
  return (
    <section className="container-page flex min-h-[70vh] items-center py-20">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-surface">
          <User className="h-8 w-8 text-gold" />
        </span>
        <h1 className="mt-8 text-4xl md:text-5xl">Sign in to get listed.</h1>
        <p className="mt-4 text-muted-foreground">
          Create a free account or sign in first — that's how we link your application to your
          dashboard, so you can track your status and edit your profile later.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Sign up <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/sign-in"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
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
