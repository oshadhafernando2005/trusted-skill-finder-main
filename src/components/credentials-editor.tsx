import { Plus, X } from "lucide-react";

import { MAX_CREDENTIALS_PER_LIST, type CredentialItem } from "@/lib/credentials";

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

// A list a professional fills in on their profile: qualifications or awards.
// Each row has a title, the institution / body / issuer, and a year.
export function CredentialsEditor({
  heading,
  hint,
  addLabel,
  titlePlaceholder,
  organizationPlaceholder,
  items,
  onChange,
  error,
}: {
  heading: string;
  hint: string;
  addLabel: string;
  titlePlaceholder: string;
  organizationPlaceholder: string;
  items: CredentialItem[];
  onChange: (next: CredentialItem[]) => void;
  error?: string;
}) {
  const update = (index: number, patch: Partial<CredentialItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-error={error ? "true" : undefined}
    >
      <p className="font-medium">
        {heading} <span className="text-sm font-normal text-muted-foreground">(optional)</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>

      {items.length > 0 && (
        <div className="mt-4 grid gap-4">
          {items.map((item, index) => (
            <div key={index} className="grid items-end gap-3 sm:grid-cols-[1.4fr_1fr_6rem_auto]">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Title</label>
                <input
                  className={field}
                  placeholder={titlePlaceholder}
                  maxLength={120}
                  value={item.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Institution</label>
                <input
                  className={field}
                  placeholder={organizationPlaceholder}
                  maxLength={120}
                  value={item.organization}
                  onChange={(e) => update(index, { organization: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Year</label>
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder="2019"
                  maxLength={4}
                  value={item.year}
                  onChange={(e) => update(index, { year: e.target.value.replace(/\D/g, "") })}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label={`Remove ${heading.toLowerCase()} entry`}
                className="grid h-[2.9rem] w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length < MAX_CREDENTIALS_PER_LIST && (
        <button
          type="button"
          onClick={() => onChange([...items, { title: "", organization: "", year: "" }])}
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
