import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { z } from "zod";

import { db } from "@/lib/firebase";
import { StaticPageLayout } from "@/components/static-page-layout";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Booking Pro" },
      { name: "description", content: "Get in touch with the Booking Pro team." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  message: z.string().trim().min(10, "Tell us a bit more (min 10 characters)").max(2000),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>>;

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";
const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground";

function Contact() {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof values, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        next[issue.path[0] as keyof Errors] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitError("");
    setSubmitting(true);
    try {
      await addDoc(collection(db, "contactMessages"), {
        ...result.data,
        createdAt: serverTimestamp(),
      });
      setSent(true);
    } catch (err) {
      console.error("Failed to send contact message:", err);
      setSubmitError("Something went wrong sending your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StaticPageLayout
      title="Contact us"
      subtitle="Questions, feedback, or need help with a booking? We'd love to hear from you."
    >
      <div className="not-prose grid gap-8 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-medium">Email us</p>
              <p className="mt-1 text-sm text-muted-foreground"> Support@briscabpo.com</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We typically respond within 1–2 business days.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-card p-8">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface">
                <CheckCircle2 className="h-7 w-7 text-gold" />
              </span>
              <h2 className="mt-6 font-display text-2xl">Message sent</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks for reaching out — we'll get back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div data-error={errors.name ? "true" : undefined}>
                <label className={label}>Your name</label>
                <input
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Jane Doe"
                  className={field}
                />
                {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name}</p>}
              </div>
              <div data-error={errors.email ? "true" : undefined}>
                <label className={label}>Email address</label>
                <input
                  type="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className={field}
                />
                {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
              </div>
              <div data-error={errors.message ? "true" : undefined}>
                <label className={label}>Message</label>
                <textarea
                  rows={5}
                  value={values.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="How can we help?"
                  className={`${field} resize-none`}
                />
                {errors.message && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.message}</p>
                )}
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </StaticPageLayout>
  );
}
