import { Award, GraduationCap, Trophy } from "lucide-react";

import type { CredentialItem } from "@/lib/credentials";
import type { ProDetail } from "@/lib/professional-profile";

type CredentialLists = Pick<
  ProDetail,
  "educationalQualifications" | "professionalQualifications" | "awards"
>;

function CredentialCard({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Award;
  title: string;
  items: CredentialItem[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Icon className="h-5 w-5 text-gold" />
      <h3 className="mt-3 text-lg font-medium">{title}</h3>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => {
          const detail = [item.organization, item.year].filter(Boolean).join(" · ");
          return (
            <li key={`${item.title}-${index}`} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The professional's educational qualifications, professional qualifications
// and awards, as cards. Lists that are empty aren't shown.
export function CredentialGroups({ pro }: { pro: CredentialLists }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pro.educationalQualifications.length > 0 && (
        <CredentialCard
          icon={GraduationCap}
          title="Educational qualifications"
          items={pro.educationalQualifications}
        />
      )}
      {pro.professionalQualifications.length > 0 && (
        <CredentialCard
          icon={Award}
          title="Professional qualifications"
          items={pro.professionalQualifications}
        />
      )}
      {pro.awards.length > 0 && <CredentialCard icon={Trophy} title="Awards" items={pro.awards} />}
    </div>
  );
}
