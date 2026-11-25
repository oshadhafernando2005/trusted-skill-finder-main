import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeCredentials, type CredentialItem } from "@/lib/credentials";
import { normalizeServices, type OneToOneService } from "@/lib/services";
import { normalizeTrialSessions, type TrialSession } from "@/lib/trial-sessions";
import proTeacher from "@/assets/pro-teacher.jpg";

// Shared by the professional's About page (/professional/$id) and the Booking
// page (/professional/$id/book) so both read the same profile shape.

// A single bookable block within a day — only present for one-to-one pros.
export type TimeSlot = {
  start: string;
  end: string;
};

// One working day with its own hours — matches the "join as professional" form.
// `slots` holds the auto-generated 50-min blocks when sessionMode is one_to_one.
export type DayAvailability = {
  day: string;
  date?: string;
  startTime: string;
  endTime: string;
  slots: TimeSlot[];
};

export type GroupSession = {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
};

export type ProDetail = {
  id: string;
  img: string;
  name: string;
  profession: string;
  specialization: string;
  company: string;
  bio: string;
  years: number;
  fee: number;
  currency: string;
  rateUnit: string;
  sessionLength: string;
  location: string;
  sessionModes: ("one_to_one" | "one_to_many")[];
  groupCapacity: number;
  availability: DayAvailability[];
  oneToOneAvailability: DayAvailability[];
  oneToManyAvailability: DayAvailability[];
  oneToManySessions: GroupSession[];
  // Named tests the pro offers in one-to-one mode, each with its own price.
  services: OneToOneService[];
  // Free 15-minute trial windows (see lib/trial-sessions.ts).
  trialSessions: TrialSession[];
  sessionType: string[];
  workAreas: string[];
  // Shown to clients on the profile before they book.
  educationalQualifications: CredentialItem[];
  professionalQualifications: CredentialItem[];
  awards: CredentialItem[];
  verified: boolean;
};

export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fullDayNames: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

export function formatSlotDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeSlots(raw: unknown): TimeSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      start: typeof item.start === "string" ? item.start : "",
      end: typeof item.end === "string" ? item.end : "",
    }))
    .filter((item) => item.start && item.end);
}

function normalizeAvailability(raw: unknown): DayAvailability[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      day: typeof item.day === "string" ? item.day : "",
      ...(typeof item.date === "string" ? { date: item.date } : {}),
      startTime: typeof item.startTime === "string" ? item.startTime : "",
      endTime: typeof item.endTime === "string" ? item.endTime : "",
      slots: normalizeSlots(item.slots),
    }))
    .filter((item) => item.day);
}

// Loads an approved professional. Resolves to null when the profile doesn't
// exist or isn't approved yet; rejects on a Firestore error.
export async function fetchProfessional(id: string): Promise<ProDetail | null> {
  const snap = await getDoc(doc(db, "professionals", id));
  if (!snap.exists() || snap.data().status !== "approved") return null;

  const d = snap.data() as Record<string, unknown>;
  const legacyAvailability = normalizeAvailability(d.availability);
  const oneToOneAvailability = Array.isArray(d.oneToOneAvailability)
    ? normalizeAvailability(d.oneToOneAvailability)
    : legacyAvailability.filter((a) => a.slots.length > 0);
  const oneToManyAvailability = Array.isArray(d.oneToManyAvailability)
    ? normalizeAvailability(d.oneToManyAvailability)
    : legacyAvailability.filter((a) => a.slots.length === 0);
  const oneToManySessions: GroupSession[] = Array.isArray(d.oneToManySessions)
    ? d.oneToManySessions
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === "object" && s !== null && typeof s.date === "string",
        )
        .map((s) => ({
          name: typeof s.name === "string" ? s.name.trim() : "",
          date: String(s.date),
          startTime: String(s.startTime ?? "09:00"),
          endTime: String(s.endTime ?? "10:00"),
          price: Number(s.price) || Number(d.rate) || 0,
        }))
    : [];
  const sessionModes: ("one_to_one" | "one_to_many")[] = [
    ...(oneToOneAvailability.length > 0 ? (["one_to_one"] as const) : []),
    ...(oneToManySessions.length > 0 || oneToManyAvailability.length > 0
      ? (["one_to_many"] as const)
      : []),
  ];

  return {
    id: snap.id,
    img: typeof d.photoURL === "string" && d.photoURL ? d.photoURL : proTeacher,
    name: typeof d.fullName === "string" ? d.fullName : "Unnamed professional",
    profession: typeof d.profession === "string" ? d.profession : "Professional",
    specialization: typeof d.specialization === "string" ? d.specialization : "",
    company: typeof d.company === "string" ? d.company : "",
    bio: typeof d.bio === "string" ? d.bio : "",
    years: Number(d.experience) || 0,
    fee: Number(d.rate) || 0,
    currency: typeof d.currency === "string" ? d.currency : "USD",
    rateUnit: typeof d.rateUnit === "string" ? d.rateUnit : "per hour",
    sessionLength: typeof d.sessionLength === "string" ? d.sessionLength : "60 min",
    location: typeof d.location === "string" ? d.location : "Remote",
    sessionModes:
      sessionModes.length > 0
        ? sessionModes
        : [d.sessionMode === "one_to_one" ? "one_to_one" : "one_to_many"],
    groupCapacity: Math.max(2, Number(d.groupCapacity) || 10),
    availability: legacyAvailability,
    oneToOneAvailability,
    oneToManyAvailability,
    oneToManySessions,
    services: normalizeServices(d.oneToOneServices),
    trialSessions: normalizeTrialSessions(d.trialSessions),
    sessionType: Array.isArray(d.sessionType) ? (d.sessionType as string[]) : [],
    workAreas: Array.isArray(d.workAreas) ? (d.workAreas as string[]) : [],
    educationalQualifications: normalizeCredentials(d.educationalQualifications),
    professionalQualifications: normalizeCredentials(d.professionalQualifications),
    awards: normalizeCredentials(d.awards),
    verified: d.status === "approved",
  };
}
