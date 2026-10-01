import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-only. Uses a service account, which bypasses Firestore security rules,
// so it must never be imported from client code (the `.server.ts` suffix makes
// the bundler enforce that).

let cached: Firestore | null = null;

function loadServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");

  // Accept either the raw JSON or a base64 encoded copy of it.
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const creds = JSON.parse(json);
  // Some env var UIs store the key's newlines as a literal "\\n".
  if (typeof creds.private_key === "string") {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  return creds;
}

export function adminDb(): Firestore {
  if (cached) return cached;
  const app = getApps()[0] ?? initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore(app);
  // The booking payload has optional fields; skip them instead of throwing.
  db.settings({ ignoreUndefinedProperties: true });
  cached = db;
  return db;
}
