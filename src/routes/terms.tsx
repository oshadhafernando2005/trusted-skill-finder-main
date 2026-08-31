import { createFileRoute, Link } from "@tanstack/react-router";

import { StaticPageLayout } from "@/components/static-page-layout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Booking Pro" },
      { name: "description", content: "The terms and conditions for using Booking Pro." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <StaticPageLayout title="Terms of Service" subtitle="Last updated: 2026">
      <p>
        These Terms of Service ("Terms") govern your use of Booking Pro (the "Platform"). By
        creating an account, browsing professional profiles, or booking a session through the
        Platform, you agree to these Terms. If you don't agree, please don't use the Platform.
      </p>

      <h2 className="text-2xl font-display text-foreground">1. Who can use Booking Pro</h2>
      <p>
        You must be able to form a legally binding contract to use the Platform. If you're
        registering on behalf of a business, you confirm you're authorized to bind that business
        to these Terms.
      </p>

      <h2 className="text-2xl font-display text-foreground">2. Professional listings</h2>
      <p>
        Professionals who register on the Platform are responsible for the accuracy of the
        information in their profile, including their qualifications, experience, rates and
        availability. Booking Pro may review applications before a profile becomes publicly
        visible, but listing on the Platform is not a guarantee or certification of a
        professional's qualifications by Booking Pro.
      </p>

      <h2 className="text-2xl font-display text-foreground">3. Bookings and payments</h2>
      <p>
        When you book a session, you agree to pay the listed rate for that session. Payments are
        processed through our third-party payment provider. Cancellation and refund terms may
        vary by professional — please check the details on a professional's profile or contact
        them directly before booking.
      </p>

      <h2 className="text-2xl font-display text-foreground">4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Provide false or misleading information when registering or booking</li>
        <li>Use the Platform for any unlawful purpose</li>
        <li>Attempt to circumvent the Platform's booking or payment process</li>
        <li>Interfere with the security or normal operation of the Platform</li>
      </ul>

      <h2 className="text-2xl font-display text-foreground">5. Termination</h2>
      <p>
        We may suspend or terminate access to the Platform for any account that violates these
        Terms or that we reasonably believe poses a risk to other users.
      </p>

      <h2 className="text-2xl font-display text-foreground">6. Disclaimers</h2>
      <p>
        Booking Pro is a marketplace connecting clients and professionals. We are not a party to
        the service relationship between a client and a professional, and we are not responsible
        for the quality, safety, or legality of services provided by professionals on the
        Platform.
      </p>

      <h2 className="text-2xl font-display text-foreground">7. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Platform after changes
        take effect constitutes acceptance of the updated Terms.
      </p>

      <h2 className="text-2xl font-display text-foreground">8. Contact</h2>
      <p>
        Questions about these Terms? Reach out via our{" "}
        <Link to="/contact" className="text-gold hover:underline">
          Contact page
        </Link>
        .
      </p>
    </StaticPageLayout>
  );
}
