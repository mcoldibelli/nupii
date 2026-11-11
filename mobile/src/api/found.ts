import { request, type ApiResult } from "./http";
import type { components } from "./schema";

export type Identification = components["schemas"]["Identification"];
export type IdentificationCandidate = components["schemas"]["IdentificationCandidate"];

/** A point on the map, in degrees. */
export type Location = { latitude: number; longitude: number };

/** What the person that found a dog leaves for the owner. */
export type Contact = { name: string; phone: string; message?: string };

/**
 * Calls POST /v1/identifications with the photo of a nose. The operation
 * is public: it has no token. location is the point of the person that
 * found the dog, or null (RN-61).
 */
export function identifyNose(
  baseUrl: string,
  photo: Blob,
  location: Location | null,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Identification>> {
  const body = new FormData();
  body.append("file", photo);
  if (location !== null) {
    body.append("latitude", String(location.latitude));
    body.append("longitude", String(location.longitude));
  }
  return request<Identification>(fetchFn, `${baseUrl}/v1/identifications`, null, { method: "POST", body });
}

/**
 * Calls POST /v1/identifications/{id}/confirmation. The operation is
 * public. The photo is the photo of the identification (RN-16).
 */
export function confirmIdentification(
  baseUrl: string,
  identificationId: string,
  candidateId: string,
  contact: Contact,
  photo: Blob,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  const body = new FormData();
  body.append("candidateId", candidateId);
  body.append("name", contact.name);
  body.append("phone", contact.phone);
  if (contact.message !== undefined) {
    body.append("message", contact.message);
  }
  body.append("file", photo);
  const url = `${baseUrl}/v1/identifications/${identificationId}/confirmation`;
  return request<void>(fetchFn, url, null, { method: "POST", body });
}
