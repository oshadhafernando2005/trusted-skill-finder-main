import { createFileRoute, redirect } from "@tanstack/react-router";

// Short, shareable link: bookingpro.lk/oshadha -> this professional's profile.
export const Route = createFileRoute("/UpaliWijayaweera")({
  beforeLoad: () => {
    throw redirect({
      to: "/professional/$id",
      params: { id: "SFPrOob3xWgRf0ME495r" },
    });
  },
}); 