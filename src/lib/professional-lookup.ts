import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";

import { db } from "@/lib/firebase";

// Finds the professional application doc linked to this login, if any.
// Prefers a doc already linked by uid; falls back to matching by email
// (covers applications submitted before this account existed) and
// self-heals the link going forward so future lookups are direct by uid.
export async function findLinkedProfessionalId(
  uid: string,
  email: string | null,
): Promise<string | null> {
  let snap = await getDocs(
    query(collection(db, "professionals"), where("uid", "==", uid), limit(1)),
  );

  if (snap.empty && email) {
    snap = await getDocs(
      query(collection(db, "professionals"), where("email", "==", email.toLowerCase()), limit(1)),
    );
    if (!snap.empty) {
      await updateDoc(doc(db, "professionals", snap.docs[0].id), { uid });
    }
  }

  return snap.empty ? null : snap.docs[0].id;
}
