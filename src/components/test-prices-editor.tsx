import { Plus, X } from "lucide-react";
import type { OneToOneService } from "@/lib/services";

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

// Lets a professional add named tests with their own prices to their
// one-to-one section. Used by both the registration form and the dashboard.
export function TestPricesEditor({
  items,
  onChange,
  error,
}: {
  items: OneToOneService[];
  onChange: (next: OneToOneService[]) => void;
  error?: string;
}) {
  const update = (index: number, patch: Partial<OneToOneService>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div
      className="mt-6 rounded-xl border border-border bg-card p-4"
      data-error={error ? "true" : undefined}
    >
      <p className="font-medium">
        Tests &amp; special services{" "}
        <span className="text-sm font-normal text-muted-foreground">(optional)</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your normal session price is your rate above. Add named tests with their own prices —
        clients see them next to the normal session and choose what they want when booking.
      </p>

      {items.length > 0 && (
        <div className="mt-4 grid gap-3">
          {items.map((item, index) => (
            <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_11rem_auto]">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Test name</label>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Test 1"
                  className={field}
                  value={item.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Price</label>
                <div className="flex gap-2">
                  <span className="flex w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-2 py-3 text-sm text-muted-foreground">
                    LKR
                  </span>
                  <input
                    type="number"
                    min={1}
                    placeholder="1000"
                    className={field}
                    value={item.price || ""}
                    onChange={(e) => update(index, { price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label={`Remove ${item.name || "test"}`}
                className="grid h-[2.9rem] w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...items, { name: "", price: 0 }])}
        className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        <Plus className="h-4 w-4" /> Add a test
      </button>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
