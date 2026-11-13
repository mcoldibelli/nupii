import { json, request, type ApiResult } from "./http";
import type { components } from "./schema";

export type ShareLink = components["schemas"]["ShareLink"];
export type CreatedShareLink = components["schemas"]["CreatedShareLink"];
export type HealthCard = components["schemas"]["HealthCard"];
export type ShareLinkInput = components["schemas"]["ShareLinkInput"];

const links = (baseUrl: string, petId: string) => `${baseUrl}/v1/pets/${encodeURIComponent(petId)}/share-links`;

/** Calls POST /v1/pets/{petId}/share-links with the validity and the exams (RN-40). Only this answer has the token (RN-39). */
export function createShareLink(
  baseUrl: string,
  idToken: string,
  petId: string,
  options: ShareLinkInput,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<CreatedShareLink>> {
  return request<CreatedShareLink>(fetchFn, links(baseUrl, petId), idToken, json("POST", options));
}

/** Calls GET /v1/pets/{petId}/share-links: the active links, with the opens (RN-40). */
export async function listShareLinks(
  baseUrl: string,
  idToken: string,
  petId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<ShareLink[]>> {
  const result = await request<components["schemas"]["ShareLinkList"]>(fetchFn, links(baseUrl, petId), idToken, { method: "GET" });
  return result.ok ? { ok: true, value: result.value.links } : result;
}

/** Calls DELETE /v1/pets/{petId}/share-links/{shareLinkId}. */
export function revokeShareLink(
  baseUrl: string,
  idToken: string,
  petId: string,
  linkId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${links(baseUrl, petId)}/${encodeURIComponent(linkId)}`, idToken, { method: "DELETE" });
}

/** Calls POST /v1/share-links/opening. The operation is public, and the token goes in the body. */
export function openShareLink(baseUrl: string, token: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<HealthCard>> {
  return request<HealthCard>(fetchFn, `${baseUrl}/v1/share-links/opening`, null, json("POST", { token }));
}
