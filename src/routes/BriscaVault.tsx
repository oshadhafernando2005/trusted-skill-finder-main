import { createFileRoute, redirect } from "@tanstack/react-router";

// Short, shareable link: bookingpro.lk/oshadha -> this professional's profile.
export const Route = createFileRoute("/BriscaVault")({
  beforeLoad: () => {
    throw redirect({
      to: "/professional/$id",
      params: { id: "8mho73a8BdsghMXfr4XO" },
    });
  },
});