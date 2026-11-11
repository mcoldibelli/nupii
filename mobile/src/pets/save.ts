import { failureMessage, SESSION_FAILURE } from "../api/http";
import { createPet, updatePet, uploadPetPhoto, type PetInput } from "../api/pets";

/** The API that gets the pet, and the function that gives the ID token. */
export type SaveTarget = {
  baseUrl: string;
  idToken: () => Promise<string | null>;
  fetchFn?: typeof fetch;
};

export type SaveOutcome =
  | { kind: "saved" }
  /** Nothing was saved. */
  | { kind: "failed"; message: string }
  /** The data of the pet petId was saved, and the photo was not sent. */
  | { kind: "photoFailed"; petId: string; message: string };

/**
 * Saves the data of a pet and then sends its photo, when there is one. It
 * creates the pet when petId is null, and changes the pet petId if not.
 */
export async function savePet(
  { baseUrl, idToken, fetchFn = fetch }: SaveTarget,
  petId: string | null,
  input: PetInput,
  photo: Blob | null,
): Promise<SaveOutcome> {
  const token = await idToken();
  if (token === null) {
    return { kind: "failed", message: SESSION_FAILURE };
  }
  const saved =
    petId === null
      ? await createPet(baseUrl, token, input, fetchFn)
      : await updatePet(baseUrl, token, petId, input, fetchFn);
  if (!saved.ok) {
    return { kind: "failed", message: failureMessage(saved) };
  }
  if (photo !== null) {
    const uploaded = await uploadPetPhoto(baseUrl, token, saved.value.id, photo, fetchFn);
    if (!uploaded.ok) {
      return { kind: "photoFailed", petId: saved.value.id, message: failureMessage(uploaded) };
    }
  }
  return { kind: "saved" };
}
