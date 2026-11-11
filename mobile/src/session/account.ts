import { failureMessage, SESSION_FAILURE, type ApiResult } from "../api/http";

/** What the delete of the account needs. The session gives the real ones. */
export type DeleteAccountDeps = {
  /** Checks the password of the account. Returns null, or the message of the failure. */
  confirm: (password: string) => Promise<string | null>;
  idToken: () => Promise<string | null>;
  remove: (token: string) => Promise<ApiResult<void>>;
  signOut: () => Promise<string | null>;
};

/**
 * Deletes the account (RF-08): the password first, then the API, then the
 * sign-out, because the API refuses the token after the delete (RN-04).
 * Returns null, or the message of the failure.
 */
export async function deleteAccountFlow(deps: DeleteAccountDeps, password: string): Promise<string | null> {
  const wrong = await deps.confirm(password);
  if (wrong !== null) {
    return wrong;
  }
  const token = await deps.idToken();
  if (token === null) {
    return SESSION_FAILURE;
  }
  const result = await deps.remove(token);
  if (!result.ok) {
    return failureMessage(result);
  }
  await deps.signOut();
  return null;
}

/** The message of a failed change of the name (RF-06). */
export function renameFailure(result: { ok: false; code: string }): string {
  // RN-45: o nome do tutor é obrigatório e tem no máximo 100 caracteres.
  return result.code === "invalid_request" ? "Informe um nome com até 100 caracteres." : failureMessage(result);
}
