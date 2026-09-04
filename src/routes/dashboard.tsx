import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Clock,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  Sparkles,
} from "lucide-react";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { z } from "zod";

import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { generateSlots, findRemovedSlotStarts } from "@/lib/slots";
import { validatePhotoFile, uploadProfessionalPhoto, makeOwnerKey } from "@/lib/photo-upload";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "My profile — Booking Pro" }] }),
  component: Dashboard,
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

const editSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  location: z.string().trim().min(2, "Enter your city / country").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  profession: z.string().min(1, "Select your profession"),
  specialization: z.string().trim().max(120).optional().or(z.literal("")),
  experience: z.coerce.number().min(0, "Enter years of experience").max(60),
  license: z.string().trim().max(80).optional().or(z.literal("")),
  rate: z.coerce.number().min(1, "Enter your rate").max(100000),
  currency: z.string().min(1),
  rateUnit: z.string().min(1),
  sessionLength: z.string().min(1),
  sessionMode: z.enum(["one_to_one", "one_to_many"]),
  photoURL: z.string().nullable(),
  availability: z
    .array(
      z.object({
        day: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        removedSlots: z.array(z.string()).default([]),
      }),
    )
    .min(1, "Pick at least one working day"),
  sessionType: z.array(z.string()).min(1, "Pick at least one session type"),
  bio: z.string().trim().min(40, "Tell clients a bit more (min 40 characters)").max(1000),
});

type EditValues = z.infer<typeof editSchema>;
type Errors = Partial<Record<string, string>>;

const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";
const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

function toEditValues(d: DocumentData): EditValues {
  return {
    fullName: typeof d.fullName === "string" ? d.fullName : "",
    phone: typeof d.phone === "string" ? d.phone : "",
    location: typeof d.location === "string" ? d.location : "",
    company: typeof d.company === "string" ? d.company : "",
    profession: typeof d.profession === "string" ? d.profession : "",
    specialization: typeof d.specialization === "string" ? d.specialization : "",
    experience: Number(d.experience) || 0,
    license: typeof d.license === "string" ? d.license : "",
    rate: Number(d.rate) || 0,
    currency: typeof d.currency === "string" ? d.currency : "LKR",
    rateUnit: typeof d.rateUnit === "string" ? d.rateUnit : "per hour",
    sessionLength: typeof d.sessionLength === "string" ? d.sessionLength : "60 min",
    sessionMode: d.sessionMode === "one_to_one" ? "one_to_one" : "one_to_many",
    photoURL: typeof d.photoURL === "string" ? d.photoURL : null,
    availability: Array.isArray(d.availability)
      ? d.availability.map((a: DocumentData) => {
          const startTime = typeof a.startTime === "string" ? a.startTime : "09:00";
          const endTime = typeof a.endTime === "string" ? a.endTime : "17:00";
          const savedSlots = Array.isArray(a.slots)
            ? a.slots
                .filter((s: DocumentData) => typeof s.start === "string" && typeof s.end === "string")
                .map((s: DocumentData) => ({ start: s.start, end: s.end }))
            : [];
          return {
            day: typeof a.day === "string" ? a.day : "",
            startTime,
            endTime,
            // Reconstruct which auto-generated slots were previously removed —
            // whatever isn't in the saved `slots` list was clicked off.
            removedSlots:
              d.sessionMode === "one_to_one" && savedSlots.length > 0
                ? findRemovedSlotStarts(startTime, endTime, savedSlots)
                : [],
          };
        })
      : [],
    sessionType: Array.isArray(d.sessionType) ? d.sessionType : [],
    bio: typeof d.bio === "string" ? d.bio : "",
  };
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [docId, setDocId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<EditValues | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }

    let active = true;
    (async () => {
      // Prefer a doc already linked to this login.
      let snap = await getDocs(
        query(collection(db, "professionals"), where("uid", "==", user.uid), limit(1)),
      );

      // Fall back to matching by email (covers applications submitted before
      // this account existed) and self-heal by linking it going forward.
      if (snap.empty && user.email) {
        snap = await getDocs(
          query(
            collection(db, "professionals"),
            where("email", "==", user.email.toLowerCase()),
            limit(1),
          ),
        );
        if (!snap.empty) {
          await updateDoc(doc(db, "professionals", snap.docs[0].id), { uid: user.uid });
        }
      }

      if (!active) return;
      if (snap.empty) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const docSnap = snap.docs[0];
      setDocId(docSnap.id);
      setStatus(typeof docSnap.data().status === "string" ? docSnap.data().status : "pending");
      setValues(toEditValues(docSnap.data()));
      setLoading(false);
    })().catch((err) => {
      console.error("Failed to load professional profile:", err);
      if (active) {
        setNotFound(true);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [authLoading, user, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate({ to: "/" });
  };

  const set = <K extends keyof EditValues>(key: K, value: EditValues[K]) =>
    setValues((v) => (v ? { ...v, [key]: value } : v));

  const toggleDay = (day: string) => {
    setValues((v) => {
      if (!v) return v;
      const exists = v.availability.some((a) => a.day === day);
      return {
        ...v,
        availability: exists
          ? v.availability.filter((a) => a.day !== day)
          : [...v.availability, { day, startTime: "09:00", endTime: "17:00", removedSlots: [] }],
      };
    });
  };

  const updateAvailability = (day: string, key: "startTime" | "endTime", value: string) => {
    setValues((v) =>
      v
        ? {
            ...v,
            availability: v.availability.map((a) =>
              // Changing the window invalidates prior slot choices for that
              // day — old removed times may no longer line up with the new
              // slot boundaries.
              a.day === day ? { ...a, [key]: value, removedSlots: [] } : a,
            ),
          }
        : v,
    );
  };

  const toggleSlot = (day: string, slotStart: string) => {
    setValues((v) =>
      v
        ? {
            ...v,
            availability: v.availability.map((a) =>
              a.day === day
                ? {
                    ...a,
                    removedSlots: a.removedSlots.includes(slotStart)
                      ? a.removedSlots.filter((s) => s !== slotStart)
                      : [...a.removedSlots, slotStart],
                  }
                : a,
            ),
          }
        : v,
    );
  };

  const restoreDaySlots = (day: string) => {
    setValues((v) =>
      v
        ? {
            ...v,
            availability: v.availability.map((a) =>
              a.day === day ? { ...a, removedSlots: [] } : a,
            ),
          }
        : v,
    );
  };

  const toggleSessionType = (value: string) => {
    setValues((v) =>
      v
        ? {
            ...v,
            sessionType: v.sessionType.includes(value)
              ? v.sessionType.filter((t) => t !== value)
              : [...v.sessionType, value],
          }
        : v,
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values || !docId) return;

    const result = editSchema.safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const k = String(issue.path[0]);
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }

    if (result.data.sessionMode === "one_to_one") {
      const tooShort = result.data.availability.find(
        (a) => generateSlots(a.startTime, a.endTime).length === 0,
      );
      if (tooShort) {
        setErrors({
          availability: `${tooShort.day}'s window is too short to fit a 50-minute session with a 10-minute break.`,
        });
        return;
      }

      const emptyDay = result.data.availability.find((a) => {
        const kept = generateSlots(a.startTime, a.endTime).filter(
          (s) => !a.removedSlots.includes(s.start),
        );
        return kept.length === 0;
      });
      if (emptyDay) {
        setErrors({
          availability: `You've removed every session on ${emptyDay.day} — keep at least one, or remove the day instead.`,
        });
        return;
      }
    }

    setErrors({});
    setSaveError("");
    setSaving(true);
    try {
      let photoURL = result.data.photoURL;
      if (photoFile) {
        setUploadStage("photo");
        try {
          photoURL = await uploadProfessionalPhoto(photoFile, makeOwnerKey(user?.uid ?? docId));
        } catch (err) {
          console.error("Failed to upload photo:", err);
          setSaveError("Couldn't upload your photo. Please try again.");
          setSaving(false);
          setUploadStage("idle");
          return;
        }
      }

      setUploadStage("saving");
      const availability = result.data.availability.map(({ removedSlots, ...a }) =>
        result.data.sessionMode === "one_to_one"
          ? {
              ...a,
              slots: generateSlots(a.startTime, a.endTime).filter(
                (s) => !removedSlots.includes(s.start),
              ),
            }
          : a,
      );

      await updateDoc(doc(db, "professionals", docId), {
        ...result.data,
        photoURL,
        availability,
      });
      setPhotoFile(null);
      setPhotoPreview("");
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveError("Something went wrong saving your changes. Please try again.");
    } finally {
      setSaving(false);
      setUploadStage("idle");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      </header>

      <main className="container-page py-12">
        {notFound || !values ? (
          <div className="mx-auto max-w-lg rounded-[1.75rem] border border-border bg-card p-8 text-center">
            <h1 className="font-display text-2xl">No professional profile yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This account isn't linked to a professional application. Submit one to get listed on
              Booking Pro.
            </p>
            <Link
              to="/join-as-professional"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Complete your application
            </Link>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl">My profile</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is what clients see when they find you on Booking Pro.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={status} />
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                  >
                    <Pencil className="h-4 w-4" /> Edit profile
                  </button>
                )}
              </div>
            </div>

            {saved && (
              <p className="mb-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
                Your profile has been updated.
              </p>
            )}

            {editing ? (
              <EditForm
                values={values}
                errors={errors}
                set={set}
                toggleDay={toggleDay}
                updateAvailability={updateAvailability}
                toggleSlot={toggleSlot}
                restoreDaySlots={restoreDaySlots}
                toggleSessionType={toggleSessionType}
                photoPreview={photoPreview}
                photoError={photoError}
                onPhotoChange={handlePhotoChange}
                onCancel={() => {
                  setEditing(false);
                  setErrors({});
                  setPhotoFile(null);
                  setPhotoPreview("");
                  setPhotoError("");
                }}
                onSave={handleSave}
                saving={saving}
                saveError={saveError}
                uploadStage={uploadStage}
              />
            ) : (
              <ProfileView values={values} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "border-gold/40 bg-gold/10 text-foreground",
    pending: "border-border bg-surface text-muted-foreground",
    rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  const text: Record<string, string> = {
    approved: "Live on Booking Pro",
    pending: "Pending verification",
    rejected: "Not approved",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status === "approved" && <BadgeCheck className="h-3.5 w-3.5" />}
      {text[status] ?? "Pending verification"}
    </span>
  );
}

function ProfileView({ values }: { values: EditValues }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-8">
      <div className="mb-4 flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
          {values.photoURL ? (
            <img src={values.photoURL} alt={values.fullName} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <h2 className="font-display text-2xl leading-tight">{values.fullName}</h2>
          {values.company && <p className="text-sm text-muted-foreground">{values.company}</p>}
        </div>
      </div>
      <p className="mt-1 text-sm text-gold">
        {values.profession}
        {values.specialization ? ` · ${values.specialization}` : ""}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Detail icon={Briefcase} label="Experience" value={`${values.experience} yrs`} />
        <Detail
          icon={Sparkles}
          label="Rate"
          value={`${values.currency} ${values.rate} ${values.rateUnit}`}
        />
        <Detail icon={Clock} label="Session length" value={values.sessionLength} />
        <Detail
          icon={Briefcase}
          label="Session style"
          value={values.sessionMode === "one_to_one" ? "One-to-one" : "One-to-many"}
        />
      </div>

      <div className="mt-6">
        <p className={label}>Working days</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {values.availability.map((a) => (
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

      <div className="mt-6">
        <p className={label}>Session types</p>
        <div className="flex flex-wrap gap-2">
          {values.sessionType.map((t) => (
            <span
              key={t}
              className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className={label}>Bio</p>
        <p className="text-sm leading-relaxed text-foreground/90">{values.bio}</p>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label: text,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <Icon className="h-4 w-4 text-gold" />
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{text}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function EditForm({
  values,
  errors,
  set,
  toggleDay,
  updateAvailability,
  toggleSlot,
  restoreDaySlots,
  toggleSessionType,
  photoPreview,
  photoError,
  onPhotoChange,
  onCancel,
  onSave,
  saving,
  saveError,
  uploadStage,
}: {
  values: EditValues;
  errors: Errors;
  set: <K extends keyof EditValues>(key: K, value: EditValues[K]) => void;
  toggleDay: (day: string) => void;
  updateAvailability: (day: string, key: "startTime" | "endTime", value: string) => void;
  toggleSlot: (day: string, slotStart: string) => void;
  restoreDaySlots: (day: string) => void;
  toggleSessionType: (value: string) => void;
  photoPreview: string;
  photoError: string;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  saveError: string;
  uploadStage: "idle" | "photo" | "saving";
}) {
  const displayedPhoto = photoPreview || values.photoURL || "";
  return (
    <form
      onSubmit={onSave}
      className="grid gap-6 rounded-[1.75rem] border border-border bg-card p-8"
    >
      <div>
        <span className={label}>Profile photo</span>
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
            {displayedPhoto ? (
              <img src={displayedPhoto} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <label
              htmlFor="dashboard-photo"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Change photo
            </label>
            <input
              id="dashboard-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={onPhotoChange}
            />
            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or WEBP, up to 5MB.</p>
            {photoError && <p className="mt-1.5 text-xs text-destructive">{photoError}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div data-error={errors.fullName ? "true" : undefined}>
          <label className={label}>Full name</label>
          <input
            className={field}
            value={values.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
          {errors.fullName && <p className="mt-1.5 text-xs text-destructive">{errors.fullName}</p>}
        </div>
        <div data-error={errors.phone ? "true" : undefined}>
          <label className={label}>Phone number</label>
          <input
            className={field}
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          {errors.phone && <p className="mt-1.5 text-xs text-destructive">{errors.phone}</p>}
        </div>
        <div data-error={errors.location ? "true" : undefined}>
          <label className={label}>City / country</label>
          <input
            className={field}
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
          />
          {errors.location && <p className="mt-1.5 text-xs text-destructive">{errors.location}</p>}
        </div>
        <div>
          <label className={label}>Company / organization</label>
          <input
            className={field}
            value={values.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
        <div data-error={errors.profession ? "true" : undefined}>
          <label className={label}>Profession</label>
          <select
            className={field}
            value={values.profession}
            onChange={(e) => set("profession", e.target.value)}
          >
            <option value="">Select…</option>
            {professions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.profession && (
            <p className="mt-1.5 text-xs text-destructive">{errors.profession}</p>
          )}
        </div>
        <div>
          <label className={label}>Specialization</label>
          <input
            className={field}
            value={values.specialization}
            onChange={(e) => set("specialization", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>License / registration no.</label>
          <input
            className={field}
            value={values.license}
            onChange={(e) => set("license", e.target.value)}
          />
        </div>
        <div data-error={errors.experience ? "true" : undefined}>
          <label className={label}>Years of experience</label>
          <input
            type="number"
            min={0}
            className={field}
            value={values.experience}
            onChange={(e) => set("experience", Number(e.target.value))}
          />
          {errors.experience && (
            <p className="mt-1.5 text-xs text-destructive">{errors.experience}</p>
          )}
        </div>
        <div data-error={errors.rate ? "true" : undefined}>
          <label className={label}>Rate per session</label>
          <div className="flex gap-2">
            <span
              className="flex w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-2 py-3 text-sm text-muted-foreground"
            >
              LKR
            </span>
            <input
              type="number"
              min={1}
              className={field}
              value={values.rate}
              onChange={(e) => set("rate", Number(e.target.value))}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Every session is a fixed 50-minute slot, billed per session in LKR.
          </p>
          {errors.rate && <p className="mt-1.5 text-xs text-destructive">{errors.rate}</p>}
        </div>
      </div>

      <div>
        <span className={label}>How do you take sessions?</span>
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          One-to-one — your hours automatically split into 50-minute sessions with a 10-minute
          break between each.
        </p>
      </div>

      <div data-error={errors.availability ? "true" : undefined}>
        <span className={label}>Working days</span>
        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                values.availability.some((a) => a.day === day)
                  ? "border-gold bg-gold text-gold-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        {errors.availability && (
          <p className="mt-1.5 text-xs text-destructive">{errors.availability}</p>
        )}

        <div className="mt-4 grid gap-3">
          {values.availability.map((a) => (
            <div key={a.day} className="rounded-xl border border-border bg-surface p-3">
              <p className="mb-2 text-sm font-medium">{a.day}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">From</label>
                  <input
                    type="time"
                    className={field}
                    value={a.startTime}
                    onChange={(e) => updateAvailability(a.day, "startTime", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Until</label>
                  <input
                    type="time"
                    className={field}
                    value={a.endTime}
                    onChange={(e) => updateAvailability(a.day, "endTime", e.target.value)}
                  />
                </div>
              </div>
              {values.sessionMode === "one_to_one" && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Tap a session to remove it (e.g. a lunch break)
                    </p>
                    {a.removedSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => restoreDaySlots(a.day)}
                        className="text-xs text-gold underline-offset-2 hover:underline"
                      >
                        Restore all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {generateSlots(a.startTime, a.endTime).map((s) => {
                      const removed = a.removedSlots.includes(s.start);
                      return (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => toggleSlot(a.day, s.start)}
                          aria-pressed={!removed}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            removed
                              ? "border-dashed border-border bg-transparent text-muted-foreground/50 line-through"
                              : "border-border bg-background text-foreground hover:border-gold"
                          }`}
                        >
                          {s.start}–{s.end}
                        </button>
                      );
                    })}
                    {generateSlots(a.startTime, a.endTime).length === 0 && (
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
      </div>

      <div data-error={errors.sessionType ? "true" : undefined}>
        <span className={label}>Session types</span>
        <div className="flex flex-wrap gap-2">
          {sessionTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleSessionType(t)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                values.sessionType.includes(t)
                  ? "border-gold bg-gold text-gold-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {errors.sessionType && (
          <p className="mt-1.5 text-xs text-destructive">{errors.sessionType}</p>
        )}
      </div>

      <div data-error={errors.bio ? "true" : undefined}>
        <label className={label}>Bio</label>
        <textarea
          rows={5}
          className={`${field} resize-none`}
          value={values.bio}
          onChange={(e) => set("bio", e.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {values.bio.trim().length}/1000 characters
        </p>
        {errors.bio && <p className="mt-1.5 text-xs text-destructive">{errors.bio}</p>}
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {uploadStage === "photo" ? "Uploading photo…" : saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
