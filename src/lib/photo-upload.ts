import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { storage } from "@/lib/firebase";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "Image must be under 5MB.";
  }
  return null;
}

// Uploads a professional's profile photo to Firebase Storage and returns its
// public download URL. `ownerKey` scopes the file path — pass the signed-in
// uid when available, otherwise a generated id — so re-uploads overwrite the
// same file instead of piling up orphaned images.
export async function uploadProfessionalPhoto(file: File, ownerKey: string): Promise<string> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `professional-photos/${ownerKey}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export function makeOwnerKey(uid: string | null | undefined): string {
  if (uid) return uid;
  // No account yet — generate a stable-enough id for this submission.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
