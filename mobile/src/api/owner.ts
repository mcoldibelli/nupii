import { TERMS_VERSION } from "../terms";
import { json, request, type ApiResult } from "./http";
import type { components } from "./schema";

export type Owner = components["schemas"]["Owner"];

/** Calls GET /v1/me with the ID token. It does not throw. */
export function getMe(baseUrl: string, idToken: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<Owner>> {
  return request<Owner>(fetchFn, `${baseUrl}/v1/me`, idToken, { method: "GET" });
}

/**
 * Calls POST /v1/me to register the owner of the account, with the name and
 * the acceptance of the terms version that the app shows. It does not throw.
 */
export function registerMe(
  baseUrl: string,
  idToken: string,
  name: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<Owner>> {
  const body: components["schemas"]["RegisterOwnerRequest"] = { name, acceptedTermsVersion: TERMS_VERSION };
  return request<Owner>(fetchFn, `${baseUrl}/v1/me`, idToken, json("POST", body));
}

/** Calls PATCH /v1/me to change the name of the owner (RF-06). It does not throw. */
export function updateMe(baseUrl: string, idToken: string, name: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<Owner>> {
  return request<Owner>(fetchFn, `${baseUrl}/v1/me`, idToken, json("PATCH", { name }));
}

/** Calls DELETE /v1/me to delete the account (RF-08). It does not throw. */
export function deleteMe(baseUrl: string, idToken: string, fetchFn: typeof fetch = fetch): Promise<ApiResult<void>> {
  return request<void>(fetchFn, `${baseUrl}/v1/me`, idToken, { method: "DELETE" });
}
