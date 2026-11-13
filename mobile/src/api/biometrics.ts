import { request, type ApiResult } from "./http";
import type { components } from "./schema";

export type Noseprint = components["schemas"]["Noseprint"];
export type FoundNotice = components["schemas"]["FoundNotice"];

/**
 * Calls GET /v1/pets/{petId}/noseprint. The value is null when the pet has
 * no noseprint.
 */
export async function getNoseprint(
  baseUrl: string,
  idToken: string,
  petId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Noseprint | null>> {
  const result = await request<Noseprint>(fetchFn, `${baseUrl}/v1/pets/${encodeURIComponent(petId)}/noseprint`, idToken, { method: "GET" });
  if (!result.ok && result.code === "noseprint_not_found") {
    return { ok: true, value: null };
  }
  return result;
}

/**
 * Calls POST /v1/pets/{petId}/noseprints with the photo of the nose as the
 * part "file". The caller reads the file of the device into a Blob.
 */
export function registerNoseprint(
  baseUrl: string,
  idToken: string,
  petId: string,
  photo: Blob,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Noseprint>> {
  const body = new FormData();
  body.append("file", photo);
  return request<Noseprint>(fetchFn, `${baseUrl}/v1/pets/${encodeURIComponent(petId)}/noseprints`, idToken, { method: "POST", body });
}

/** Calls GET /v1/found-notices. The notices come from the newest to the oldest. */
export async function listFoundNotices(
  baseUrl: string,
  idToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<FoundNotice[]>> {
  const result = await request<components["schemas"]["FoundNoticeList"]>(fetchFn, `${baseUrl}/v1/found-notices`, idToken, {
    method: "GET",
  });
  return result.ok ? { ok: true, value: result.value.notices } : result;
}

/** Calls POST /v1/pets/{petId}/noseprints/check: the quality of a photo of the nose, stored nowhere (RN-85). */
export function checkNoseprint(
  baseUrl: string,
  idToken: string,
  petId: string,
  photo: Blob,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<components["schemas"]["NoseprintCheck"]>> {
  const body = new FormData();
  body.append("file", photo);
  return request(fetchFn, `${baseUrl}/v1/pets/${encodeURIComponent(petId)}/noseprints/check`, idToken, { method: "POST", body });
}
