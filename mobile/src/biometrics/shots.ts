import type { LocalFile } from "../api/pets";

/** A photo of the noseprint flow and the result of its check (RN-85). */
export type Shot = { uri: string; file?: LocalFile; state: "checking" | "good" } | { uri: string; file?: LocalFile; state: "refused"; message: string };

/** The two photos of the flow (Focinho-Captura artboard). */
export type Shots = [Shot | null, Shot | null];

/** The slot of the next photo, or null when both slots have a photo. */
export function nextSlot(shots: Shots): 0 | 1 | null {
  if (shots[0] === null) {
    return 0;
  }
  return shots[1] === null ? 1 : null;
}

/** True when the two photos passed the check, so the app can register them. */
export function allGood(shots: Shots): boolean {
  return shots.every((shot) => shot?.state === "good");
}
