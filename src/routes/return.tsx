import { createFileRoute, Link } from "@tanstack/react-router";

import { StaticPageLayout } from "@/components/static-page-layout";

export const Route = createFileRoute("/return")({
  head: () => ({
    meta: [
      { title: "Cancellation, Rescheduling & Refund Policy — Booking Pro" },
      {
        name: "description",
        content:
          "The conditions that apply to cancelling, rescheduling or requesting a refund for a booking made through Booking Pro.",
      },
    ],
  }),
  component: ReturnPolicy,
});

function ReturnPolicy() {
  return (
    <StaticPageLayout
      title="Cancellation, Rescheduling & Refund Policy"
      subtitle="Effective Date: 11 September 2026"
    >
      <p>
        BookingPro.lk is an online platform that connects users with independent professionals and
        facilitates the booking and payment of professional consultation services. This
        Cancellation, Rescheduling &amp; Refund Policy explains the conditions applicable to
        bookings made through BookingPro.lk.
      </p>

      <h2 className="text-2xl font-display text-foreground">1. Bookings</h2>
      <p>
        When you make a booking through BookingPro.lk, you agree to the applicable consultation fee,
        appointment date and time, cancellation conditions and other terms displayed at the time of
        booking.
      </p>
      <p>
        Each professional may have specific cancellation or rescheduling conditions, which will be
        displayed to you before you confirm your booking.
      </p>

      <h2 className="text-2xl font-display text-foreground">2. Cancellation by the Customer</h2>
      <p>
        Customers may request cancellation of a booking through their BookingPro.lk account or by
        contacting BookingPro.lk.
      </p>
      <p>Unless a different cancellation policy is clearly stated for the particular service:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <span className="font-medium text-foreground">
            More than 24 hours before the scheduled consultation:
          </span>{" "}
          eligible for a full refund.
        </li>
        <li>
          <span className="font-medium text-foreground">
            Between 12 and 24 hours before the scheduled consultation:
          </span>{" "}
          eligible for a 50% refund.
        </li>
        <li>
          <span className="font-medium text-foreground">
            Less than 12 hours before the scheduled consultation:
          </span>{" "}
          normally non-refundable.
        </li>
        <li>
          <span className="font-medium text-foreground">
            After the scheduled consultation time:
          </span>{" "}
          the booking will normally be considered completed and is non-refundable.
        </li>
      </ul>
      <p>
        The applicable cancellation terms displayed at the time of booking will take precedence over
        these standard conditions.
      </p>

      <h2 className="text-2xl font-display text-foreground">3. Rescheduling</h2>
      <p>
        Customers may request to reschedule a consultation, subject to the professional's
        availability.
      </p>
      <p>
        Where possible, rescheduling requests should be made at least{" "}
        <span className="font-medium text-foreground">
          12 hours before the scheduled appointment
        </span>
        .
      </p>
      <p>
        A professional may decline a rescheduling request where insufficient notice is provided or
        where no suitable alternative time is available.
      </p>
      <p>
        Repeated rescheduling may be subject to additional conditions determined by the
        professional.
      </p>

      <h2 className="text-2xl font-display text-foreground">4. Cancellation by a Professional</h2>
      <p>
        If a professional cancels a confirmed appointment and an alternative appointment cannot be
        mutually agreed upon, the customer will generally be entitled to:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>a full refund of the amount paid for the cancelled consultation; or</li>
        <li>an alternative appointment, if the customer agrees.</li>
      </ul>
      <p>
        BookingPro.lk may assist the customer in identifying another suitable professional or
        appointment where appropriate.
      </p>

      <h2 className="text-2xl font-display text-foreground">5. Professional Does Not Attend</h2>
      <p>
        If a professional fails to attend a confirmed online consultation without reasonable notice,
        the customer should notify BookingPro.lk as soon as possible.
      </p>
      <p>After reviewing the circumstances, BookingPro.lk may provide:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>a replacement appointment;</li>
        <li>a full or partial refund; or</li>
        <li>another appropriate resolution.</li>
      </ul>

      <h2 className="text-2xl font-display text-foreground">6. Customer Does Not Attend</h2>
      <p>
        If a customer fails to attend a scheduled consultation without cancelling or rescheduling
        within the applicable cancellation period, the booking may be treated as a{" "}
        <span className="font-medium text-foreground">"No Show"</span> and may be non-refundable.
      </p>
      <p>
        A customer who experiences genuine technical or emergency circumstances should contact
        BookingPro.lk as soon as possible so that the circumstances can be reviewed.
      </p>

      <h2 className="text-2xl font-display text-foreground">7. Technical Problems</h2>
      <p>
        For online consultations, customers are responsible for having a suitable device, internet
        connection, camera/microphone where required, and access to the relevant communication
        platform.
      </p>
      <p>
        If a consultation cannot be completed because of a significant technical problem
        attributable to the professional or BookingPro.lk, we may arrange a replacement appointment
        or provide an appropriate refund.
      </p>
      <p>
        If the technical problem is caused by the customer's own equipment, internet connection or
        failure to access the consultation, the booking may be treated as a No Show.
      </p>

      <h2 className="text-2xl font-display text-foreground">8. Refund Processing</h2>
      <p>
        Approved refunds will normally be processed through the original payment method used for the
        booking.
      </p>
      <p>
        The time required for the refunded amount to appear in the customer's account may depend on
        the relevant payment gateway, bank or financial institution.
      </p>
      <p>
        BookingPro.lk is not responsible for delays caused by banks, payment processors or other
        third-party financial institutions.
      </p>

      <h2 className="text-2xl font-display text-foreground">
        9. Booking Fees and Payment Gateway Charges
      </h2>
      <p>
        Where a booking includes a clearly disclosed platform fee, payment processing fee or other
        non-refundable charge, the treatment of such fees will be displayed before payment is
        confirmed.
      </p>
      <p>
        Any refund will be subject to the terms applicable to the particular booking and any fees
        that are legally permitted to be retained.
      </p>

      <h2 className="text-2xl font-display text-foreground">
        10. Disputes Regarding Professional Services
      </h2>
      <p>
        BookingPro.lk is primarily a platform that facilitates connections and bookings between
        customers and independent professionals.
      </p>
      <p>
        The professional is responsible for the professional advice, consultation, opinions,
        recommendations and services provided during a consultation.
      </p>
      <p>
        BookingPro.lk does not guarantee any particular outcome from a professional consultation.
      </p>
      <p>
        However, if a customer has a complaint regarding a booking or consultation, BookingPro.lk
        may review the matter and assist the parties in reaching an appropriate resolution.
      </p>
      <p>
        Nothing in this policy limits any rights or remedies available to a consumer under
        applicable Sri Lankan law.
      </p>

      <h2 className="text-2xl font-display text-foreground">11. Refund Exceptions</h2>
      <p>A refund may be declined where:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>the customer has already received the booked consultation;</li>
        <li>the customer failed to attend without providing appropriate notice;</li>
        <li>the customer cancelled outside the applicable refund period;</li>
        <li>the customer provided incorrect booking information;</li>
        <li>the service was delivered substantially as described; or</li>
        <li>
          the refund request is inconsistent with the specific terms accepted at the time of
          booking.
        </li>
      </ul>
      <p>These exceptions are subject to applicable consumer protection laws.</p>

      <h2 className="text-2xl font-display text-foreground">12. Changes to a Booking</h2>
      <p>
        BookingPro.lk reserves the right to make reasonable changes to a booking where necessary due
        to professional availability, technical problems, unforeseen circumstances or other
        operational reasons.
      </p>
      <p>
        Where a significant change affects the customer's appointment, BookingPro.lk will make
        reasonable efforts to notify the customer and provide an appropriate alternative or refund
        where applicable.
      </p>

      <h2 className="text-2xl font-display text-foreground">13. Consumer Rights</h2>
      <p>
        This policy is intended to establish clear and fair procedures for cancellations,
        rescheduling and refunds. It does not exclude or restrict any mandatory rights or remedies
        that consumers may have under applicable Sri Lankan law.
      </p>
      <p>
        Sri Lanka's Consumer Affairs Authority has jurisdiction over consumer complaints involving
        goods and services, and applicable law may provide remedies including compensation or
        refunds in appropriate circumstances.
      </p>

      <h2 className="text-2xl font-display text-foreground">
        14. How to Request a Cancellation or Refund
      </h2>
      <p>
        To request a cancellation, rescheduling or refund, customers should contact BookingPro.lk
        with:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Booking/reference number</li>
        <li>Customer name</li>
        <li>Scheduled consultation date and time</li>
        <li>Reason for the request</li>
        <li>Any relevant supporting information</li>
      </ul>
      <p>Requests should be submitted as soon as reasonably possible.</p>
      <p>
        Email: <span className="font-medium text-foreground">support@briscabpo.com</span>
        <br />
        Or reach out via our{" "}
        <Link to="/contact" className="text-gold hover:underline">
          Contact page
        </Link>
        .
      </p>

      <h2 className="text-2xl font-display text-foreground">15. Policy Updates</h2>
      <p>
        BookingPro.lk may update this policy from time to time to reflect changes to its services,
        payment systems, professional booking arrangements or applicable legal requirements.
      </p>
      <p>
        The latest version will be published on the BookingPro.lk website and will apply to bookings
        made after the effective date of the updated policy.
      </p>
    </StaticPageLayout>
  );
}
