import { createFileRoute, Link } from "@tanstack/react-router";

import { StaticPageLayout } from "@/components/static-page-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Booking Pro" },
      { name: "description", content: "How Booking Pro collects, uses and protects your data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <StaticPageLayout title="Privacy Policy" subtitle="Last updated: 2026">
      <p>
        This Privacy Policy explains what information Booking Pro collects, how we use it, and
        the choices you have. By using the Platform, you agree to the collection and use of
        information as described here.
      </p>

      <h2 className="text-2xl font-display text-foreground">1. Information we collect</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Account information</strong> — email address and password, when you create an
          account
        </li>
        <li>
          <strong>Professional profile information</strong> — name, phone, location, profession,
          experience, rate, availability and bio, if you register as a professional
        </li>
        <li>
          <strong>Booking information</strong> — the session details, date/time and contact
          information you provide when booking a session
        </li>
        <li>
          <strong>Payment information</strong> — payments are processed by our third-party payment
          provider; we do not store your full card details on our servers
        </li>
      </ul>

      <h2 className="text-2xl font-display text-foreground">2. How we use your information</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>To create and manage your account</li>
        <li>To connect clients and professionals for bookings</li>
        <li>To process payments and send booking confirmations</li>
        <li>To communicate with you about your account or bookings</li>
        <li>To improve and maintain the Platform</li>
      </ul>

      <h2 className="text-2xl font-display text-foreground">3. Sharing of information</h2>
      <p>
        When you book a session, the details you provide (such as your name and contact
        information) are shared with the professional you're booking so they can prepare for the
        session. We don't sell your personal information to third parties.
      </p>

      <h2 className="text-2xl font-display text-foreground">4. Data storage and security</h2>
      <p>
        Your information is stored using Firebase, a Google Cloud service, and payments are
        processed by our third-party payment provider. We take reasonable measures to protect
        your information, but no method of transmission or storage is 100% secure.
      </p>

      <h2 className="text-2xl font-display text-foreground">5. Your choices</h2>
      <p>
        You can review and update your professional profile information at any time from your
        dashboard. To request deletion of your account or data, contact us via the Contact page.
      </p>

      <h2 className="text-2xl font-display text-foreground">6. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We'll update the "last updated" date
        above when we do.
      </p>

      <h2 className="text-2xl font-display text-foreground">7. Contact</h2>
      <p>
        Questions about this policy or your data? Reach out via our{" "}
        <Link to="/contact" className="text-gold hover:underline">
          Contact page
        </Link>
        .
      </p>
    </StaticPageLayout>
  );
}
