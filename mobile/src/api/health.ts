import type { components } from "./schema";

type Health = components["schemas"]["Health"];
type ApiError = components["schemas"]["Error"];

/**
 * Result of the health call. The code "network" means that the app got no
 * answer in the format of the contract: no connection, or an answer that
 * is not JSON.
 */
export type HealthResult =
  | { ok: true; status: Health["status"] }
  | { ok: false; code: ApiError["error"] | "network" };

/** Calls GET /v1/health of the API at baseUrl. It does not throw. */
export async function getHealth(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<HealthResult> {
  try {
    const response = await fetchFn(`${baseUrl}/v1/health`);
    if (response.ok) {
      const body = (await response.json()) as Health;
      return { ok: true, status: body.status };
    }
    const body = (await response.json()) as ApiError;
    return { ok: false, code: body.error };
  } catch {
    return { ok: false, code: "network" };
  }
}
