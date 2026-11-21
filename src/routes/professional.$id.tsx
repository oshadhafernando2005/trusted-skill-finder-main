import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Logo } from "@/components/logo";
import { fetchProfessional, type ProDetail } from "@/lib/professional-profile";
import { ProfessionalProvider } from "@/lib/professional-context";

// Layout for a professional's pages:
//   /professional/$id       → About page   (professional.$id.index.tsx)
//   /professional/$id/book  → Booking page (professional.$id.book.tsx)
// It loads the profile once and shares it with both pages.
export const Route = createFileRoute("/professional/$id")({
  component: ProfessionalLayout,
});

function ProfessionalLayout() {
  const { id } = useParams({ from: "/professional/$id" });
  const [pro, setPro] = useState<ProDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchProfessional(id)
      .then((result) => {
        if (!active) return;
        if (!result) setNotFound(true);
        else setPro(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load professional:", err);
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !pro) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
        <div>
          <h1 className="font-display text-3xl">Professional not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This profile may have been removed or is pending approval.
          </p>
          <Link
            to="/find-professionals"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/find-professionals"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back to search
          </Link>
        </div>
      </header>

      <ProfessionalProvider value={pro}>
        <Outlet />
      </ProfessionalProvider>
    </div>
  );
}
