import { createFileRoute, redirect } from "@tanstack/react-router";

// Short, shareable link: bookingpro.lk/oshadha -> this professional's profile.
export const Route = createFileRoute("/KumarFernando")({
  beforeLoad: () => {
    throw redirect({
      to: "/professional/$id",
      params: { id: "gAeGJUG5P9uPny8eRKP0" },
    });
  },
});