import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/sign-up")({
  head: () => ({ meta: [{ title: "Sign up — Booking Pro" }] }),
  component: SignUp,
});

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";
const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";

function friendlyAuthError(code: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email — try signing in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    default:
      return "Couldn't create your account. Please try again.";
  }
}

function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

      // If this person already submitted a professional application with the
      // same email, link this new login to it so /dashboard finds it.
      const existing = await getDocs(
        query(collection(db, "professionals"), where("email", "==", normalizedEmail), limit(1)),
      );
      if (!existing.empty) {
        await updateDoc(doc(db, "professionals", existing.docs[0].id), {
          uid: credential.user.uid,
        });
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/join-as-professional" });
      }
    } catch (err) {
      const code =
        err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
      console.error("Sign up failed:", err);
      setError(friendlyAuthError(code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
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

      <main className="container-page flex min-h-[70vh] items-center justify-center py-16">
        <section className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-8">
          <h1 className="font-display text-3xl">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            For professionals on Booking Pro — sign up to manage your profile and bookings.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className={label}>Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={field}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Sign up"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-gold hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
