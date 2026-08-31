import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Clock,
  BadgeCheck,
  SlidersHorizontal,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Logo } from "@/components/logo";

import proTeacher from "@/assets/pro-teacher.jpg";

export const Route = createFileRoute("/find-professionals")({
  head: () => ({
    meta: [
      { title: "Find a Professional —Booking Pro " },
      {
        name: "description",
        content:
          "Search and filter verified doctors, lawyers, tutors, accountants and engineers by category, location, price and availability.",
      },
      { property: "og:title", content: "Find a Professional — Booking Pro" },
      {
        property: "og:description",
        content:
          "Filter verified experts by category, location, price and session type, then book in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FindProfessionals,
});

// One working day with its own hours — a professional can have a completely
// different schedule on different days (e.g. Mon 4–6pm, Sun 7–8am).
type DayAvailability = {
  day: string;
  startTime: string;
  endTime: string;
};

// Shape used by the UI once a raw Firestore doc has been normalized.
type Pro = {
  id: string;
  img: string;
  name: string;
  profession: string;
  specialization: string;
  years: number;
  fee: number;
  currency: string;
  rateUnit: string;
  location: string;
  availability: DayAvailability[];
  sessionType: string[];
  verified: boolean;
  createdAtMs: number;
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

// Kept in sync with the options offered on the "join as professional" form.
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
const sessionTypeOptions = ["In person", "Online video", "Phone call", "Home visit"];
const sorts = ["Newest", "Lowest price", "Most experience"] as const;

function FindProfessionals() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Live-subscribe to approved professionals so new sign-ups (once approved)
  // show up here without needing a page refresh.
  useEffect(() => {
    const q = query(collection(db, "professionals"), where("status", "==", "approved"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Pro[] = snapshot.docs.map((doc) => {
          const d = doc.data() as Record<string, unknown>;
          return {
            id: doc.id,
            img: proTeacher, // TODO: swap for a real uploaded photo per professional
            name: typeof d.fullName === "string" ? d.fullName : "Unnamed professional",
            profession: typeof d.profession === "string" ? d.profession : "Professional",
            specialization: typeof d.specialization === "string" ? d.specialization : "",
            years: Number(d.experience) || 0,
            fee: Number(d.rate) || 0,
            currency: typeof d.currency === "string" ? d.currency : "USD",
            rateUnit: typeof d.rateUnit === "string" ? d.rateUnit : "per hour",
            location: typeof d.location === "string" ? d.location : "Remote",
            availability: normalizeAvailability(d.availability),
            sessionType: Array.isArray(d.sessionType) ? (d.sessionType as string[]) : [],
            verified: d.status === "approved",
            createdAtMs:
              d.createdAt &&
              typeof (d.createdAt as { toMillis?: () => number }).toMillis === "function"
                ? (d.createdAt as { toMillis: () => number }).toMillis()
                : 0,
          };
        });
        setPros(list);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load professionals:", err);
        setLoadError("Couldn't load professionals right now. Please try again shortly.");
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const [search, setSearch] = useState("");
  const [profession, setProfession] = useState("All");
  const [location, setLocation] = useState("Any location");
  const [sessionType, setSessionType] = useState("Any type");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<(typeof sorts)[number]>("Newest");

  const locationOptions = useMemo(() => {
    const unique = Array.from(new Set(pros.map((p) => p.location).filter(Boolean)));
    return ["Any location", ...unique];
  }, [pros]);

  const priceCeiling = useMemo(() => {
    const max = Math.max(200, ...pros.map((p) => p.fee));
    return Math.ceil(max / 10) * 10;
  }, [pros]);

  // Until the user actually touches the slider, don't apply any price cap —
  // this avoids a hardcoded default ever silently filtering out real data.
  const effectiveMaxPrice = maxPrice ?? priceCeiling;

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = pros.filter((p) => {
      if (q && !`${p.name} ${p.profession} ${p.specialization}`.toLowerCase().includes(q))
        return false;
      if (profession !== "All" && p.profession !== profession) return false;
      if (location !== "Any location" && p.location !== location) return false;
      if (sessionType !== "Any type" && !p.sessionType.includes(sessionType)) return false;
      if (maxPrice !== null && p.fee > maxPrice) return false;
      if (verifiedOnly && !p.verified) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "Lowest price") return a.fee - b.fee;
      if (sort === "Most experience") return b.years - a.years;
      return b.createdAtMs - a.createdAtMs;
    });
  }, [pros, search, profession, location, sessionType, maxPrice, verifiedOnly, sort]);

  const reset = () => {
    setSearch("");
    setProfession("All");
    setLocation("Any location");
    setSessionType("Any type");
    setMaxPrice(null);
    setVerifiedOnly(false);
    setSort("Newest");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            <Link
              to="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link to="/find-professionals" className="text-sm font-medium text-foreground">
              Find Professionals
            </Link>
            <Link
              to="/join-as-professional"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Become a Professional
            </Link>
          </nav>
          <Link
            to="/join-as-professional"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Join as a pro
          </Link>
        </div>
      </header>

      <section className="border-b border-border/60 bg-surface/60">
        <div className="container-page py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-gold" />
            {loading ? "Loading professionals…" : `${pros.length} verified experts listed`}
          </p>
          <h1 className="max-w-2xl text-5xl leading-[1.05]">Find the right professional for you</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Filter by category, location, session type and budget — then book a session in minutes.
          </p>
        </div>
      </section>

      <main className="container-page grid gap-10 py-12 lg:grid-cols-[300px_1fr]">
        {/* Filters */}
        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-soft lg:sticky lg:top-28">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <SlidersHorizontal className="h-4 w-4 text-gold" /> Filters
            </h2>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Reset
            </button>
          </div>

          <div className="space-y-5">
            <Field label="Search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or profession"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </Field>

            <Field label="Category">
              <Select
                value={profession}
                onChange={setProfession}
                options={["All", ...professions]}
              />
            </Field>

            <Field label="Location">
              <Select value={location} onChange={setLocation} options={locationOptions} />
            </Field>

            <Field label="Session type">
              <Select
                value={sessionType}
                onChange={setSessionType}
                options={["Any type", ...sessionTypeOptions]}
              />
            </Field>

            <Field label={`Max price · ${effectiveMaxPrice}/session`}>
              <input
                type="range"
                min={20}
                max={priceCeiling}
                step={5}
                value={effectiveMaxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[var(--gold)]"
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--gold)]"
              />
              Verified professionals only
            </label>
          </div>
        </aside>

        {/* Results */}
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{results.length}</span> professionals
              found
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by</span>
              <Select
                value={sort}
                onChange={(v) => setSort(v as (typeof sorts)[number])}
                options={[...sorts]}
                compact
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-border p-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading professionals…
            </div>
          ) : loadError ? (
            <div className="rounded-3xl border border-dashed border-border p-16 text-center">
              <h3 className="font-display text-2xl">Something went wrong</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{loadError}</p>
            </div>
          ) : pros.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-16 text-center">
              <h3 className="font-display text-2xl">No professionals yet</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Once professionals register and get verified, they'll show up here.
              </p>
              <Link
                to="/join-as-professional"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
              >
                Register as a professional <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-16 text-center">
              <h3 className="font-display text-2xl">No matches yet</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Try widening your budget or clearing a filter to see more professionals.
              </p>
              <button
                onClick={reset}
                className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((p) => (
                <Link
                  key={p.id}
                  to="/professional/$id"
                  params={{ id: p.id }}
                  className="group overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-elegant"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={p.img}
                      alt={`${p.name}, ${p.profession}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {p.sessionType.length > 0 && (
                      <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs backdrop-blur">
                        {p.sessionType[0]}
                        {p.sessionType.length > 1 ? ` +${p.sessionType.length - 1}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 p-5">
                    <div>
                      <h3 className="flex items-center gap-1.5 font-display text-xl leading-tight">
                        {p.name}
                        {p.verified && <BadgeCheck className="h-4 w-4 text-gold" />}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {p.profession}
                        {p.specialization ? ` · ${p.specialization}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {p.years} yrs
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {p.location}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <p className="text-sm">
                        <span className="font-display text-2xl">
                          {p.currency} {p.fee}
                        </span>
                        <span className="text-muted-foreground"> {p.rateUnit}</span>
                      </p>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-transform group-hover:scale-[1.03]">
                        View profile <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Booking Pro. All rights reserved.</p>
          <Link to="/" className="hover:text-foreground">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/40 ${
        compact ? "px-3 py-1.5" : "px-3 py-2.5"
      }`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
