import { createFileRoute } from "@tanstack/react-router";

import { StaticPageLayout } from "@/components/static-page-layout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Booking Pro" },
      {
        name: "description",
        content: "Learn about Booking Pro, a marketplace for finding and booking verified professionals.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <StaticPageLayout
      title="About Booking Pro"
      subtitle="A calmer, more trustworthy way to find and book professionals."
    >
      <p>
        Booking Pro is a marketplace that connects people with verified doctors, teachers,
        lawyers, accountants, engineers, therapists and other trusted professionals — and lets
        them book a session in a few clicks.
      </p>
      <p>
        We built Booking Pro because finding a professional you can actually trust shouldn't mean
        scrolling through endless listings, cold-calling offices, or hoping a friend's
        recommendation is still taking new clients. Every professional on the platform goes
        through a verification step before their profile goes live, so you can book with
        confidence.
      </p>
      <h2 className="text-2xl font-display text-foreground">What we offer</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>A searchable directory of verified professionals across many categories</li>
        <li>Transparent rates, availability and session types before you book</li>
        <li>Simple, secure online booking and payment</li>
        <li>Tools for professionals to manage their profile, availability and bookings</li>
      </ul>
      <h2 className="text-2xl font-display text-foreground">Our approach</h2>
      <p>
        We're a small team focused on getting the basics right: clear information, fair pricing,
        and a straightforward booking experience for both clients and professionals. We're
        actively building and improving Booking Pro — if you have feedback, we'd love to hear it
        on our Contact page.
      </p>
    </StaticPageLayout>
  );
}
