import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Star,
  ShieldCheck,
  CalendarCheck,
  Sparkles,
  BadgeCheck,
  Stethoscope,
  Scale,
  GraduationCap,
  Calculator,
  Code2,
  HeartPulse,
  ArrowRight,
  Quote,
} from "lucide-react";

import heroImg from "@/assets/hero-professionals.jpg";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/logo";
import proDoctor from "@/assets/pro-doctor.jpg";
import proLawyer from "@/assets/pro-lawyer.jpg";
import proTeacher from "@/assets/pro-teacher.jpg";
import proEngineer from "@/assets/pro-engineer.jpg";
import t1 from "@/assets/testimonial-1.jpg";
import t2 from "@/assets/testimonial-2.jpg";
import t3 from "@/assets/testimonial-3.jpg";

export const Route = createFileRoute("/")({
  component: Home,
});

const navLinks = [
  "Home",
  "Categories",
  "Find Professionals",
  "Become a Professional",
  "About",
  "Contact",
];

const categories = [
  { icon: Stethoscope, name: "Doctors", count: "" },
  { icon: GraduationCap, name: "Teachers", count: "" },
  { icon: Scale, name: "Lawyers", count: "" },
  { icon: Calculator, name: "Accountants", count: "" },
  { icon: Code2, name: "Engineers", count: "" },
  { icon: HeartPulse, name: "Therapists", count: "" },
];

const professionals = [
  {
    img: proDoctor,
    name: "Dr. Amelia Reyes",
    profession: "Cardiologist",
    rating: 4.9,
    reviews: 214,
    years: "12 yrs",
    fee: "$120",
    location: "New York, NY",
  },
  {
    img: proLawyer,
    name: "Marcus Whitfield",
    profession: "Corporate Lawyer",
    rating: 4.8,
    reviews: 168,
    years: "15 yrs",
    fee: "$180",
    location: "Chicago, IL",
  },
  {
    img: proTeacher,
    name: "Elena Novak",
    profession: "Mathematics Tutor",
    rating: 5.0,
    reviews: 302,
    years: "9 yrs",
    fee: "$45",
    location: "Remote",
  },
  {
    img: proEngineer,
    name: "Jonas Park",
    profession: "Software Engineer",
    rating: 4.9,
    reviews: 129,
    years: "7 yrs",
    fee: "$95",
    location: "San Francisco, CA",
  },
];

const benefits = [
  {
    icon: BadgeCheck,
    title: "Verified Professionals",
    desc: "Every expert is background-checked and credential-verified before joining.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Booking",
    desc: "Encrypted payments and privacy-first consultations you can trust.",
  },
  {
    icon: Star,
    title: "Trusted Reviews",
    desc: "Real reviews from real clients — no bots, no filters, no favoritism.",
  },
  {
    icon: CalendarCheck,
    title: "Flexible Scheduling",
    desc: "Book instantly across time zones with rescheduling that just works.",
  },
];

const testimonials = [
  {
    img: t1,
    name: "Sofia Marchetti",
    role: "Founder, Bloom Studio",
    quote:
      "I found a brilliant tax advisor in ten minutes. The booking flow felt like magic — clean, calm, done.",
  },
  {
    img: t2,
    name: "David Okafor",
    role: "Product Manager",
    quote:
      "My daughter's math tutor has been life-changing. Verified reviews made the choice effortless.",
  },
  {
    img: t3,
    name: "Priya Anand",
    role: "Graduate Student",
    quote:
      "Booking Pro connected me with a therapist who genuinely fit. That kind of trust is rare online.",
  },
];

const stats = [
  { value: "0", label: "Verified professionals" },
  { value: "0", label: "Categories covered" },
  { value: "0", label: "Bookings completed" },
  { value: "0.0", label: "Average rating" },
];

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <SearchPanel />
      <Categories />
      <Featured />
      <Benefits />
      {/* Testimonials hidden for now — no real reviews yet. Re-enable when ready. */}
      {/* <Testimonials /> */}
      <Stats />
      <BecomePro />
      <Footer />
    </div>
  );
}

function Header() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-20 items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <Logo />
        </a>
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) =>
            l === "Become a Professional" || l === "Find Professionals" ? (
              <Link
                key={l}
                to={l === "Become a Professional" ? "/join-as-professional" : "/find-professionals"}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l}
              </Link>
            ) : (
              <a
                key={l}
                href="#"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-full px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                My profile
              </Link>
              <Link
                to="/join-as-professional"
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Get listed
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="rounded-full px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Log in
              </Link>
              <Link
                to="/sign-up"
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--gold), transparent 70%)" }}
      />
      <div className="container-page grid gap-16 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Trusted marketplace
          </span>
          <h1 className="mt-6 text-5xl leading-[1.05] md:text-6xl lg:text-[5.25rem]">
            Connect with <span className="italic text-gold">trusted professionals</span> anytime,
            anywhere.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Booking Pro is the modern way to find and book verified doctors, teachers, lawyers,
            accountants, engineers, and other specialists — on your schedule, in your language, at
            fair prices.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/find-professionals"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Find a Professional
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/join-as-professional"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Become a Professional
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[t1, t2, t3].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-9 w-9 rounded-full border-2 border-background object-cover"
                  loading="lazy"
                />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 text-gold">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              {/* <span>Loved by 230,000+ clients worldwide</span> */}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-[2rem] bg-surface shadow-elegant">
            <img
              src={heroImg}
              alt="Diverse professionals available on Booking Pro"
              className="h-full w-full object-cover"
              width={1400}
              height={1200}
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card p-4 shadow-soft md:block">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gold/20 text-gold">
                <BadgeCheck className="h-5 w-5" />
              </div>
              {/* <div>
                <p className="text-sm font-medium">12,480+ verified experts</p>
                <p className="text-xs text-muted-foreground">Across 48 categories</p>
              </div> */}
            </div>
          </div>
          <div className="absolute -top-6 -right-6 hidden rounded-2xl border border-border bg-card p-4 shadow-soft md:block">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Booked in 90 seconds</p>
                <p className="text-xs text-muted-foreground">Average session</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchPanel() {
  const fields = [
    { label: "Profession", placeholder: "Doctor, lawyer, tutor…", icon: Search },
    { label: "Location", placeholder: "City or remote", icon: MapPin },
    { label: "Category", placeholder: "All categories", icon: Sparkles },
    { label: "Availability", placeholder: "Any time", icon: CalendarCheck },
  ];
  return (
    <section className="container-page -mt-6 pb-6">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-elegant md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {fields.map((f) => (
            <label
              key={f.label}
              className="group flex flex-col rounded-2xl px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.label}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <f.icon className="h-4 w-4 text-gold" />
                <input
                  placeholder={f.placeholder}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-stretch justify-between gap-4 border-t border-border pt-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" />
              Rating <span className="font-medium text-foreground">4.5+</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-medium">$50</span>
              <div className="relative h-1 w-40 rounded-full bg-muted">
                <div className="absolute inset-y-0 left-1/4 right-1/4 rounded-full bg-gold" />
              </div>
              <span className="text-foreground font-medium">$300</span>
            </div>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]">
            <Search className="h-4 w-4" /> Search
          </button>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section className="container-page py-24">
      <div className="flex items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Popular categories</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Every expertise, in one place.</h2>
        </div>
        <a
          href="#"
          className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:inline-flex"
        >
          All categories <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <button
            key={c.name}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-1 hover:border-gold/60 hover:shadow-soft"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <c.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.count}</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </button>
        ))}
      </div>
    </section>
  );
}

function Featured() {
  return (
    <section className="bg-surface py-24">
      <div className="container-page">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Featured professionals</p>
            <h2 className="mt-3 text-4xl md:text-5xl">Meet this week's most-booked experts.</h2>
          </div>
          <a
            href="#"
            className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:inline-flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {professionals.map((p) => (
            <article
              key={p.name}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={p.img}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-medium backdrop-blur">
                  <Star className="h-3 w-3 fill-gold text-gold" />
                  {p.rating}
                  <span className="text-muted-foreground">({p.reviews})</span>
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-medium text-gold-foreground">
                  {p.fee}/hr
                </div>
              </div>
              <div className="p-5">
                <h3
                  className="text-xl font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {p.name}
                </h3>
                <p className="text-sm text-gold">{p.profession}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {p.location}
                  </span>
                  <span>{p.years} exp.</span>
                </div>
                <button className="mt-5 w-full rounded-full border border-border py-2.5 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground">
                  View Profile
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="container-page py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Why Booking Pro</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Built on trust, designed for calm.</h2>
        <p className="mt-4 text-muted-foreground">
          Every part of the experience is crafted to make booking a professional feel effortless —
          and reliable.
        </p>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((b) => (
          <div
            key={b.title}
            className="rounded-3xl border border-border bg-card p-6 transition-colors hover:border-gold/60"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <b.icon className="h-5 w-5 text-gold" />
            </div>
            <h3
              className="mt-6 text-xl"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}
            >
              {b.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-primary py-24 text-primary-foreground">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Testimonials</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Clients who found their perfect match.</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur transition-transform hover:-translate-y-1"
            >
              <Quote className="h-6 w-6 text-gold" />
              <blockquote className="mt-4 text-lg leading-relaxed">"{t.quote}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <img
                  src={t.img}
                  alt={t.name}
                  className="h-11 w-11 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-primary-foreground/60">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="container-page py-20">
      <div className="grid gap-8 rounded-3xl border border-border bg-card px-8 py-12 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-5xl text-primary md:text-6xl">{s.value}</p>
            <p className="mt-2 text-sm uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BecomePro() {
  return (
    <section className="container-page pb-24">
      <div className="relative overflow-hidden rounded-[2rem] bg-surface p-10 md:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--gold), transparent 70%)" }}
        />
        <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">For professionals</p>
            <h2 className="mt-3 text-4xl md:text-5xl">Grow your practice on Booking Pro.</h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Join 12,000+ verified experts using Booking Pro to reach new clients, manage bookings,
              and get paid — without the paperwork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/join-as-professional"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Apply as a Professional <ArrowRight className="h-4 w-4" />
              </Link>
              <button className="rounded-full border border-border bg-card px-7 py-3.5 text-sm font-medium hover:bg-muted">
                Learn more
              </button>
            </div>
          </div>
          <ul className="grid gap-4">
            {[
              "Zero listing fees — pay only when you get booked",
              "Smart calendar with automated reminders",
              "Verified badge that builds instant trust",
              "Weekly payouts to your bank, in your currency",
            ].map((t) => (
              <li
                key={t}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <span className="text-sm">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { title: "Platform", links: ["Categories", "Find Professionals", "How it works", "Pricing"] },
    { title: "Professionals", links: ["Join as a pro", "Success stories", "Resources", "Support"] },
    { title: "Company", links: ["About", "Careers", "Press", "Contact"] },
    { title: "Legal", links: ["Terms", "Privacy", "Cookies", "Trust & Safety"] },
  ];
  // Only labels with a real page get linked — the rest stay as placeholders for now.
  const linkPaths: Record<string, string> = {
    "Find Professionals": "/find-professionals",
    "Join as a pro": "/join-as-professional",
    About: "/about",
    Contact: "/contact",
    Terms: "/terms",
    Privacy: "/privacy",
  };
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.5fr_2fr]">
        <div>
          <div className="flex items-center gap-2">
            <Logo />
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A calmer, more trustworthy way to find and book professionals — for the moments that
            matter.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold">{c.title}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {c.links.map((l) => (
                  <li key={l}>
                    {linkPaths[l] ? (
                      <Link to={linkPaths[l]} className="hover:text-foreground">
                        {l}
                      </Link>
                    ) : (
                      <a href="#" className="hover:text-foreground">
                        {l}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Booking Pro. All rights reserved.</p>
          <p>Crafted with care for professionals and the people who need them.</p>
        </div>
      </div>
    </footer>
  );
}
