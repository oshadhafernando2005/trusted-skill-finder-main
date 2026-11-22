import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";

import { SESSION_MINUTES, TRIAL_MINUTES } from "@/lib/slots";
import { useProfessional } from "@/lib/professional-context";
import type { ProDetail } from "@/lib/professional-profile";

// Older PayHere checkouts were created with return/cancel links that point at
// this page (…?payment=success). Forward them to the booking page, which is
// where those messages are shown and unpaid holds are released.
type AboutSearch = { payment?: string; booking?: string; order?: string };

export const Route = createFileRoute("/professional/$id/")({
  validateSearch: (search: Record<string, unknown>): AboutSearch => ({
    ...(typeof search.payment === "string" ? { payment: search.payment } : {}),
    ...(typeof search.booking === "string" ? { booking: search.booking } : {}),
    ...(typeof search.order === "string" ? { order: search.order } : {}),
  }),
  beforeLoad: ({ params, search }) => {
    if (search.payment) {
      throw redirect({ to: "/professional/$id/book", params, search });
    }
  },
  head: () => ({
    meta: [{ title: "Professional profile — Booking Pro" }],
  }),
  component: AboutPage,
});

const eyebrow = "text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground";

// The lowest price a client could pay: the normal rate, a named test, or a
// group session — whichever is cheapest.
function startingPrice(pro: ProDetail) {
  const prices = [
    pro.fee,
    ...pro.services.map((s) => s.price),
    ...pro.oneToManySessions.map((s) => s.price),
  ].filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

function AboutPage() {
  const pro = useProfessional();
  const from = startingPrice(pro);
  const hasTrial = pro.trialSessions.length > 0;
  const hasGroup = pro.oneToManySessions.length > 0 || pro.oneToManyAvailability.length > 0;
  const firstName = pro.name.split(" ")[0];

  const stats = [
    { icon: Briefcase, label: "Experience", value: pro.years > 0 ? `${pro.years} yrs` : "—" },
    { icon: Clock, label: "Session length", value: pro.sessionLength },
    { icon: MapPin, label: "Location", value: pro.location },
    {
      icon: Sparkles,
      label: "Starting from",
      value: from > 0 ? `${pro.currency} ${from}` : "On request",
    },
  ];

  return (
    <main className="pb-28 lg:pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-gold/10 via-background to-background">
        <div className="container-page grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-16">
          <div className="relative mx-auto w-full max-w-sm lg:mx-0">
            <div
              aria-hidden
              className="absolute -inset-3 -z-10 rotate-3 rounded-[2rem] bg-gold/15"
            />
            <img
              src={pro.img}
              alt={pro.name}
              className="aspect-[4/5] w-full rounded-[2rem] border border-border object-cover shadow-elegant"
            />
            {pro.verified && (
              <span className="absolute -bottom-4 left-6 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-card px-4 py-2 text-xs font-medium shadow-elegant">
                <BadgeCheck className="h-4 w-4 text-gold" /> Verified professional
              </span>
            )}
          </div>

          <div>
            <p className={eyebrow}>{pro.profession}</p>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] sm:text-6xl">{pro.name}</h1>
            {pro.specialization && (
              <p className="mt-3 text-lg text-muted-foreground">{pro.specialization}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              {pro.company && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5">
                  <Building2 className="h-4 w-4 text-gold" /> {pro.company}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5">
                <MapPin className="h-4 w-4 text-gold" /> {pro.location}
              </span>
              {pro.sessionModes.includes("one_to_one") && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5">
                  <User className="h-4 w-4 text-gold" /> Individual sessions
                </span>
              )}
              {hasGroup && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5">
                  <Users className="h-4 w-4 text-gold" /> Group sessions
                </span>
              )}
              {hasTrial && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5">
                  <Sparkles className="h-4 w-4 text-gold" /> Free {TRIAL_MINUTES}-min trial
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/professional/$id/book"
                params={{ id: pro.id }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5"
              >
                Book a session <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick facts */}
      <section className="container-page -mt-px">
        <dl className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-b-3xl border-x border-b border-border bg-card lg:grid-cols-4 lg:divide-y-0">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-5 sm:p-6">
              <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <Icon className="h-4 w-4 text-gold" /> {label}
              </dt>
              <dd className="mt-2 font-display text-2xl leading-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="container-page mt-12 grid gap-10 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
        <div className="space-y-12">
          {/* About */}
          <section>
            <p className={eyebrow}>About</p>
            <h2 className="mt-2 font-display text-3xl">Meet {firstName}</h2>
            {pro.bio ? (
              <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground/90">
                {pro.bio}
              </p>
            ) : (
              <p className="mt-4 text-muted-foreground">
                {firstName} hasn't added a bio yet. You can still book a session to get started.
              </p>
            )}
          </section>

          {/* Expertise */}
          {pro.workAreas.length > 0 && (
            <section>
              <p className={eyebrow}>Expertise</p>
              <h2 className="mt-2 font-display text-3xl">What {firstName} can help with</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {pro.workAreas.map((area) => (
                  <li
                    key={area}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {area}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Session formats */}
          <section>
            <p className={eyebrow}>Sessions</p>
            <h2 className="mt-2 font-display text-3xl">How you can work together</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <User className="h-5 w-5 text-gold" />
                <h3 className="mt-3 text-lg font-medium">Individual session</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  One-to-one time focused entirely on you.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center justify-between gap-3">
                    <span>Normal session</span>
                    <span className="text-muted-foreground">
                      {pro.currency} {pro.fee}
                    </span>
                  </li>
                  {pro.services.map((s) => (
                    <li key={s.name} className="flex items-center justify-between gap-3">
                      <span>
                        {s.name}
                        {s.duration > SESSION_MINUTES && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {s.duration} min
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {pro.currency} {s.price}
                      </span>
                    </li>
                  ))}
                </ul>
                {!pro.sessionModes.includes("one_to_one") && (
                  <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    No individual times are open right now — check back soon.
                  </p>
                )}
              </div>
              {hasGroup && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <Users className="h-5 w-5 text-gold" />
                  <h3 className="mt-3 text-lg font-medium">Group session</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Learn alongside others — up to {pro.groupCapacity} people per session.
                  </p>
                  {pro.oneToManySessions.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm">
                      {pro.oneToManySessions.map((session, index) => (
                        <li
                          key={`group-${index}`}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{session.name || "Group session"}</span>
                          <span className="text-muted-foreground">
                            {pro.currency} {session.price}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {hasTrial && (
                <div className="rounded-2xl border border-gold/40 bg-gold/5 p-6">
                  <Sparkles className="h-5 w-5 text-gold" />
                  <h3 className="mt-3 text-lg font-medium">Free trial session</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A {TRIAL_MINUTES}-minute intro session to meet {firstName}. It's free — no
                    payment needed.
                  </p>
                  <Link
                    to="/professional/$id/book"
                    params={{ id: pro.id }}
                    search={{ kind: "trial" }}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gold hover:underline"
                  >
                    Book a free trial <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            {pro.sessionType.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Available as:</span>
                {pro.sessionType.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sticky booking prompt (desktop) */}
        <aside className="hidden rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-28 lg:block">
          <p className={eyebrow}>Book a session</p>
          <p className="mt-2 font-display text-4xl">
            {from > 0 ? `${pro.currency} ${from}` : "Get in touch"}
          </p>
          {from > 0 && <p className="text-sm text-muted-foreground">starting price</p>}
          <Link
            to="/professional/$id/book"
            params={{ id: pro.id }}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Choose a time <ArrowRight className="h-4 w-4" />
          </Link>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-gold" /> {pro.sessionLength} sessions
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-gold" /> Secure payment through PayHere
            </li>
            {hasTrial && (
              <li className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-gold" /> Free {TRIAL_MINUTES}-min trial available
              </li>
            )}
          </ul>
        </aside>
      </div>

      {/* Sticky booking bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 p-4 backdrop-blur-xl lg:hidden">
        <Link
          to="/professional/$id/book"
          params={{ id: pro.id }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground"
        >
          Book a session
          {from > 0 ? ` · from ${pro.currency} ${from}` : ""} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
