import { createContext, useContext } from "react";

import type { ProDetail } from "@/lib/professional-profile";

// The /professional/$id layout loads the profile once and hands it to the
// About and Booking pages through this context.
const ProfessionalContext = createContext<ProDetail | null>(null);

export const ProfessionalProvider = ProfessionalContext.Provider;

export function useProfessional(): ProDetail {
  const pro = useContext(ProfessionalContext);
  if (!pro) throw new Error("useProfessional must be used inside the professional layout");
  return pro;
}
