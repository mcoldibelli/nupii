import { json, request, type ApiResult } from "./http";
import type { components } from "./schema";

export type Pet = components["schemas"]["Pet"];
export type PetInput = components["schemas"]["PetInput"];

/** A file that the owner chose on the device. */
export type LocalFile = { uri: string };

/** Calls GET /v1/pets. The pets come in name order. */
export async function listPets(baseUrl: string, idToken: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<Pet[]>> {
  const result = await request<components["schemas"]["PetList"]>(fetchFn, `${baseUrl}/v1/pets`, idToken, { method: "GET" });
  return result.ok ? { ok: true, value: result.value.pets } : result;
}

/** Calls GET /v1/pets/{petId}. */
export function getPet(baseUrl: string, idToken: string, petId: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<Pet>> {
  return request<Pet>(fetchFn, `${baseUrl}/v1/pets/${petId}`, idToken, { method: "GET" });
}

/** Calls POST /v1/pets. */
export function createPet(
  baseUrl: string,
  idToken: string,
  input: PetInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Pet>> {
  return request<Pet>(fetchFn, `${baseUrl}/v1/pets`, idToken, json("POST", input));
}

/** Calls PUT /v1/pets/{petId}. The input replaces all the data of the pet. */
export function updatePet(
  baseUrl: string,
  idToken: string,
  petId: string,
  input: PetInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Pet>> {
  return request<Pet>(fetchFn, `${baseUrl}/v1/pets/${petId}`, idToken, json("PUT", input));
}

/** Calls DELETE /v1/pets/{petId}. */
export function deletePet(
  baseUrl: string,
  idToken: string,
  petId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${baseUrl}/v1/pets/${petId}`, idToken, { method: "DELETE" });
}

/**
 * Calls PUT /v1/pets/{petId}/photo with the content of the photo as the
 * part "file". The caller reads the file of the device into a Blob.
 */
export function uploadPetPhoto(
  baseUrl: string,
  idToken: string,
  petId: string,
  photo: Blob,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Pet>> {
  const body = new FormData();
  body.append("file", photo);
  return request<Pet>(fetchFn, `${baseUrl}/v1/pets/${petId}/photo`, idToken, { method: "PUT", body });
}
