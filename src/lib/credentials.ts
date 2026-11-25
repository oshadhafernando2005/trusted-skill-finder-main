import { z } from "zod";

// One line in a professional's "Educational qualifications", "Professional
// qualifications" or "Awards" list — e.g. "BSc in Accounting · University of
// Colombo · 2016". Only the title is required.
export type CredentialItem = {
  title: string;
  // The institution, awarding body or issuer.
  organization: string;
  // A 4-digit year, or "" when not given.
  year: string;
};

export const MAX_CREDENTIALS_PER_LIST = 15;

const currentYear = new Date().getFullYear();

const credentialItemSchema = z.object({
  title: z.string().trim().min(1, "Add a title for each entry").max(120),
  organization: z.string().trim().max(120),
  year: z
    .string()
    .trim()
    .refine(
      (y) => y === "" || (/^\d{4}$/.test(y) && Number(y) >= 1950 && Number(y) <= currentYear),
      `Year must be 4 digits between 1950 and ${currentYear}`,
    ),
});

// Rows left completely blank are dropped rather than reported, so a stray
// "Add" click doesn't block saving.
export const credentialListSchema = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value.filter(
          (row) =>
            row &&
            [row.title, row.organization, row.year].some(
              (v) => typeof v === "string" && v.trim() !== "",
            ),
        )
      : value,
  z.array(credentialItemSchema).max(MAX_CREDENTIALS_PER_LIST, "You can add up to 15 entries"),
);

// Reads a saved list back from Firestore, dropping anything malformed.
export function normalizeCredentials(raw: unknown): CredentialItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title.trim() : "",
      organization: typeof item.organization === "string" ? item.organization.trim() : "",
      year: typeof item.year === "string" ? item.year.trim() : "",
    }))
    .filter((item) => item.title !== "");
}

// True when a professional has at least one qualification or award to show.
export function hasCredentials(lists: {
  educationalQualifications: CredentialItem[];
  professionalQualifications: CredentialItem[];
  awards: CredentialItem[];
}) {
  return (
    lists.educationalQualifications.length > 0 ||
    lists.professionalQualifications.length > 0 ||
    lists.awards.length > 0
  );
}
