/** Messages for the error codes of Firebase Authentication that the user can fix. */
const messages: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/missing-password": "Informe a senha.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já tem uma conta. Use a opção de entrar.",
  "auth/invalid-email": "Informe um e-mail válido.",
  "auth/weak-password": "A senha é fraca demais. Use uma senha mais longa.",
  "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo.",
  "auth/network-request-failed": "Sem conexão com o serviço de contas. Confira a internet e tente de novo.",
};

/** The message of an error code of Firebase Authentication. */
export function authMessage(code: string): string {
  return messages[code] ?? "Não foi possível concluir. Tente de novo.";
}

/**
 * The message of a failed send of the reset link (RF-05), or null. An
 * e-mail with no account gets the same answer as one with an account, so
 * the screen does not tell which e-mails have an account.
 */
export function resetMessage(code: string): string | null {
  return code === "auth/user-not-found" ? null : authMessage(code);
}
