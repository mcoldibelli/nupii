import type { components } from "./schema";

type ApiError = components["schemas"]["Error"];

/**
 * Result of a call of the API. The code "network" means that the app got no
 * answer in the format of the contract: no connection, or an answer that is
 * not JSON.
 */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; code: ApiError["error"] | "network" };

/** Message for the user when the app cannot get the ID token of the session. */
export const SESSION_FAILURE = "Não foi possível confirmar a sua sessão. Confira a internet e tente de novo.";

/** Message for the user for a failure of a call of the API. */
export function failureMessage(result: { ok: false; code: string }): string {
  if (result.code === "network") {
    return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  }
  return `O servidor respondeu com um erro (${result.code}). Tente de novo.`;
}

/**
 * Sends a request with the ID token and reads the JSON answer. An answer
 * with the status 204 has no body. It does not throw.
 */
export async function request<T>(
  fetchFn: typeof fetch,
  url: string,
  idToken: string,
  init: { method: string; headers?: Record<string, string>; body?: BodyInit },
): Promise<ApiResult<T>> {
  try {
    const response = await fetchFn(url, {
      ...init,
      headers: { Authorization: `Bearer ${idToken}`, ...init.headers },
    });
    if (response.status === 204) {
      return { ok: true, value: undefined as T };
    }
    if (response.ok) {
      return { ok: true, value: (await response.json()) as T };
    }
    const body = (await response.json()) as ApiError;
    return { ok: false, code: body.error };
  } catch {
    return { ok: false, code: "network" };
  }
}

/** Options of a request with a JSON body. */
export function json(method: string, body: unknown): { method: string; headers: Record<string, string>; body: string } {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
