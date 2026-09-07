import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Landmark,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Sparkles,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { fetchBookingsByEmail, type BookingRecord } from "@/lib/bookings";
import { findLinkedProfessionalId } from "@/lib/professional-lookup";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({ meta: [{ title: "My bookings — Booking Pro" }] }),
  component: MyBookings,
});

function MyBookings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<BookingRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proDocId, setProDocId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }
    if (!user.email) {
      setError("Your account has no email on file, so bookings can't be matched.");
      setLoading(false);
      return;
    }

    let active = true;
    fetchBookingsByEmail(user.email)
      .then((records) => {
        if (!active) return;
        setBookings(records);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load bookings:", err);
        if (active) {
          setError("Couldn't load your bookings. Please try again.");
          setLoading(false);
        }
      });

    // Quietly check whether this account is also linked to a professional
    // profile, so we can offer a shortcut to their dashboard.
    findLinkedProfessionalId(user.uid, user.email)
      .then((id) => {
        if (active) setProDocId(id);
      })
      .catch(() => {
        // Non-critical — just skip the cross-link if this fails.
      });

    return () => {
      active = false;
    };
  }, [authLoading, user, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            {proDocId && (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Sparkles className="h-4 w-4 text-gold" /> Professional dashboard
              </Link>
            )}
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
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl">My bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sessions you've booked with professionals on Booking Pro.
          </p>

          <div className="mt-8">
            {loading ? (
              <div className="grid place-items-center rounded-[1.75rem] border border-border bg-card py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="rounded-[1.75rem] border border-border bg-card p-8 text-center text-sm text-destructive">
                {error}
              </div>
            ) : !bookings || bookings.length === 0 ? (
              <div className="rounded-[1.75rem] border border-border bg-card p-8 text-center">
                <h2 className="font-display text-xl">No bookings yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Once you book a session with a professional, it'll show up here.
                </p>
                <Link
                  to="/find-professionals"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  Find a professional <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <ClientBookingsList bookings={bookings} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ClientBookingsList({ bookings }: { bookings: BookingRecord[] }) {
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.date >= now).sort((a, b) => a.date.localeCompare(b.date));
  const past = bookings.filter((b) => b.date < now).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Upcoming
          </p>
          <div className="grid gap-3">
            {upcoming.map((b) => (
              <ClientBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Past
          </p>
          <div className="grid gap-3">
            {past.map((b) => (
              <ClientBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const statusText: Record<string, string> = {
  booked: "Awaiting bank transfer confirmation",
  paid: "Confirmed",
};

function ClientBookingCard({ booking }: { booking: BookingRecord }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <CalendarDays className="h-4 w-4 text-gold" />
            {booking.date} · {booking.timeSlot}
          </p>
          {booking.professionalId ? (
            <Link
              to="/professional/$id"
              params={{ id: booking.professionalId }}
              className="mt-1 inline-block text-sm text-gold hover:underline"
            >
              {booking.professionalName || "View professional"}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {booking.professionalName || "Professional"}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{booking.sessionType}</p>
        </div>
        <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium">
          {booking.currency} {booking.amount}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <Landmark className="h-3.5 w-3.5" />
        {statusText[booking.status] ?? booking.status}
      </div>

      {booking.notes && (
        <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-foreground/90">
          {booking.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> {booking.customerEmail}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> {booking.customerPhone}
        </span>
      </div>
    </div>
  );
}
