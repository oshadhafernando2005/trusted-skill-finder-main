import { createFileRoute, redirect } from "@tanstack/react-router";

// Short, shareable link: bookingpro.lk/oshadha -> this professional's profile.
export const Route = createFileRoute("/udara")({
  beforeLoad: () => {
    throw redirect({
      to: "/professional/$id",
      params: { id: "Pbg5cVtS2Q5WdZIaFrTm" },
    });
  },
});