import { TERMS_VERSION } from "../terms";
import type { components } from "./schema";

export type Owner = components["schemas"]["Owner"];
type ApiError = components["schemas"]["Error"];

/**
 * Result of a call about the owner. The code "network" means that the app
 * got no answer in the format of the contract: no connection, or an answer
 * that is not JSON.
 */
export type OwnerResult = { ok: true; owner: Owner } | { ok: false; code: ApiError["error"] | "network" };

async function call(url: string, init: RequestInit, fetchFn: typeof fetch): Promise<OwnerResult> {
  try {
    const response = await fetchFn(url, init);
    if (response.ok) {
      return { ok: true, owner: (await response.json()) as Owner };
    }
    const body = (await response.json()) as ApiError;
    return { ok: false, code: body.error };
  } catch {
    return { ok: false, code: "network" };
  }
}

/** Calls GET /v1/me with the ID token. It does not throw. */
export function getMe(baseUrl: string, idToken: string, fetchFn: typeof fetch = fetch): Promise<OwnerResult> {
  return call(`${baseUrl}/v1/me`, { method: "GET", headers: { Authorization: `Bearer ${idToken}` } }, fetchFn);
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
): Promise<OwnerResult> {
  const body: components["schemas"]["RegisterOwnerRequest"] = { name, acceptedTermsVersion: TERMS_VERSION };
  return call(
    `${baseUrl}/v1/me`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fetchFn,
  );
}
