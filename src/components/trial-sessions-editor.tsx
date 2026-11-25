import { Plus, X } from "lucide-react";

import { TRIAL_MINUTES, toLocalISODate } from "@/lib/slots";
import { generateTrialSlots, type TrialSession } from "@/lib/trial-sessions";

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold";

// Lets a professional offer free trial sessions: a date and a time window that
// is cut into 30-minute blocks clients can book without paying. Used by both
// the registration form and the dashboard.
export function TrialSessionsEditor({
  items,
  onChange,
  error,
}: {
  items: TrialSession[];
  onChange: (next: TrialSession[]) => void;
  error?: string;
}) {
  const update = (index: number, patch: Partial<TrialSession>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div
      className="mt-6 rounded-xl border border-border bg-card p-4"
      data-error={error ? "true" : undefined}
    >
      <p className="font-medium">
        Free trial sessions{" "}
        <span className="text-sm font-normal text-muted-foreground">(optional)</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Let clients meet you first. Each trial session is {TRIAL_MINUTES} minutes and free — clients
        book it without paying. Add a date and a time window and it's split into {TRIAL_MINUTES}
        -minute slots.
      </p>

      {items.length > 0 && (
        <div className="mt-4 grid gap-4">
          {items.map((item, index) => {
            const count = generateTrialSlots(item.startTime, item.endTime).length;
            return (
              <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Date</label>
                  <input
                    type="date"
                    min={toLocalISODate(new Date())}
                    className={field}
                    value={item.date}
                    onChange={(e) => update(index, { date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Start</label>
                  <input
                    type="time"
                    className={field}
                    value={item.startTime}
                    onChange={(e) => update(index, { startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">End</label>
                  <input
                    type="time"
                    className={field}
                    value={item.endTime}
                    onChange={(e) => update(index, { endTime: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  aria-label="Remove trial session"
                  className="grid h-[2.9rem] w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs text-muted-foreground sm:col-span-4">
                  {count > 0
                    ? `${count} free ${count === 1 ? "slot" : "slots"} of ${TRIAL_MINUTES} minutes`
                    : `Needs at least ${TRIAL_MINUTES} minutes between start and end`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...items, { date: "", startTime: "09:00", endTime: "10:00" }])}
        className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        <Plus className="h-4 w-4" /> Add a trial session
      </button>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
