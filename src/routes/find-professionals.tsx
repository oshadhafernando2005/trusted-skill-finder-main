import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Star,
  Sparkles,
  Clock,
  BadgeCheck,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";

import proDoctor from "@/assets/pro-doctor.jpg";
import proLawyer from "@/assets/pro-lawyer.jpg";
import proTeacher from "@/assets/pro-teacher.jpg";
import proEngineer from "@/assets/pro-engineer.jpg";

export const Route = createFileRoute("/find-professionals")({
  head: () => ({
    meta: [
      { title: "Find a Professional — Consulta" },
      {
        name: "description",
        content:
          "Search and filter verified doctors, lawyers, tutors, accountants and engineers by category, location, rating, price and availability.",
      },
      { property: "og:title", content: "Find a Professional — Consulta" },
      {
        property: "og:description",
        content:
          "Filter verified experts by category, location, rating, price and availability, then book in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FindProfessionals,
});

type Pro = {
  img: string;
  name: string;
  profession: string;
  category: string;
  rating: number;
  reviews: number;
  years: number;
  fee: number;
  location: string;
  availability: "Today" | "This week" | "Next week";
  verified: boolean;
};

const professionals: Pro[] = [
  { img: proDoctor, name: "Dr. Amelia Reyes", profession: "Cardiologist", category: "Doctors", rating: 4.9, reviews: 214, years: 12, fee: 120, location: "New York, NY", availability: "Today", verified: true },
  { img: proLawyer, name: "Marcus Whitfield", profession: "Corporate Lawyer", category: "Lawyers", rating: 4.8, reviews: 168, years: 15, fee: 180, location: "Chicago, IL", availability: "This week", verified: true },
  { img: proTeacher, name: "Elena Novak", profession: "Mathematics Tutor", category: "Teachers", rating: 5.0, reviews: 302, years: 9, fee: 45, location: "Remote", availability: "Today", verified: true },
  { img: proEngineer, name: "Jonas Park", profession: "Software Engineer", category: "Engineers", rating: 4.9, reviews: 129, years: 7, fee: 95, location: "San Francisco, CA", availability: "Next week", verified: true },
  { img: proDoctor, name: "Dr. Naomi Feld", profession: "Dermatologist", category: "Doctors", rating: 4.6, reviews: 88, years: 6, fee: 90, location: "Austin, TX", availability: "This week", verified: false },
  { img: proLawyer, name: "Adrian Cole", profession: "Immigration Lawyer", category: "Lawyers", rating: 4.4, reviews: 61, years: 5, fee: 140, location: "Remote", availability: "Today", verified: true },
  { img: proTeacher, name: "Grace Lin", profession: "IELTS Coach", category: "Teachers", rating: 4.7, reviews: 143, years: 8, fee: 38, location: "Remote", availability: "Next week", verified: true },
  { img: proEngineer, name: "Samuel Ortiz", profession: "Tax Accountant", category: "Accountants", rating: 4.5, reviews: 74, years: 11, fee: 75, location: "Chicago, IL", availability: "This week", verified: false },
  { img: proDoctor, name: "Dr. Iris Kaminski", profession: "Clinical Therapist", category: "Therapists", rating: 4.9, reviews: 197, years: 14, fee: 110, location: "New York, NY", availability: "Today", verified: true },
];

const categories = ["All", "Doctors", "Teachers", "Lawyers", "Accountants", "Engineers", "Therapists"];
const locations = ["Any location", "Remote", "New York, NY", "Chicago, IL", "Austin, TX", "San Francisco, CA"];
const availabilities = ["Any time", "Today", "This week", "Next week"];
const ratings = [0, 4, 4.5, 4.8];
const sorts = ["Top rated", "Lowest price", "Most experience"] as const;

function FindProfessionals() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [location, setLocation] = useState("Any location");
  const [availability, setAvailability] = useState("Any time");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(200);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<(typeof sorts)[number]>("Top rated");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = professionals.filter((p) => {
      if (q && !`${p.name} ${p.profession} ${p.category}`.toLowerCase().includes(q)) return false;
      if (category !== "All" && p.category !== category) return false;
      if (location !== "Any location" && p.location !== location) return false;
      if (availability !== "Any time" && p.availability !== availability) return false;
      if (p.rating < minRating) return false;
      if (p.fee > maxPrice) return false;
      if (verifiedOnly && !p.verified) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "Lowest price") return a.fee - b.fee;
      if (sort === "Most experience") return b.years - a.years;
      return b.rating - a.rating;
    });
  }, [query, category, location, availability, minRating, maxPrice, verifiedOnly, sort]);

  const reset = () => {
    setQuery("");
    setCategory("All");
    setLocation("Any location");
    setAvailability("Any time");
    setMinRating(0);
    setMaxPrice(200);
    setVerifiedOnly(false);
    setSort("Top rated");
  };

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
          <nav className="hidden items-center gap-8 lg:flex">
            <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
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
            <BadgeCheck className="h-3.5 w-3.5 text-gold" /> {professionals.length} verified experts online
          </p>
          <h1 className="max-w-2xl text-5xl leading-[1.05]">Find the right professional for you</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Filter by category, location, availability, rating and budget — then book a session in minutes.
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
            <button onClick={reset} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Reset
            </button>
          </div>

          <div className="space-y-5">
            <Field label="Search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or profession"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </Field>

            <Field label="Category">
              <Select value={category} onChange={setCategory} options={categories} />
            </Field>

            <Field label="Location">
              <Select value={location} onChange={setLocation} options={locations} />
            </Field>

            <Field label="Availability">
              <Select value={availability} onChange={setAvailability} options={availabilities} />
            </Field>

            <Field label="Minimum rating">
              <div className="flex flex-wrap gap-2">
                {ratings.map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(r)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      minRating === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r === 0 ? "Any" : `${r}+`}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={`Max price · $${maxPrice}/session`}>
              <input
                type="range"
                min={20}
                max={200}
                step={5}
                value={maxPrice}
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
              <span className="font-medium text-foreground">{results.length}</span> professionals found
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by</span>
              <Select value={sort} onChange={(v) => setSort(v as (typeof sorts)[number])} options={[...sorts]} compact />
            </div>
          </div>

          {results.length === 0 ? (
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
                <article
                  key={p.name}
                  className="group overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-elegant"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={p.img}
                      alt={`${p.name}, ${p.profession}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs backdrop-blur">
                      {p.availability}
                    </span>
                  </div>
                  <div className="space-y-3 p-5">
                    <div>
                      <h3 className="flex items-center gap-1.5 font-display text-xl leading-tight">
                        {p.name}
                        {p.verified && <BadgeCheck className="h-4 w-4 text-gold" />}
                      </h3>
                      <p className="text-sm text-muted-foreground">{p.profession}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />
                        {p.rating.toFixed(1)} <span className="text-muted-foreground">({p.reviews})</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {p.years} yrs
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {p.location}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <p className="text-sm">
                        <span className="font-display text-2xl">${p.fee}</span>
                        <span className="text-muted-foreground"> /session</span>
                      </p>
                      <button className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.03]">
                        View profile <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Consulta. All rights reserved.</p>
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
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
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
