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

/**
 * The message of a failed login with Google on the web (RF-03), or null when
 * the person closed the window of Google.
 */
export function googleMessage(code: string): string | null {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela do Google. Permita janelas deste site e tente de novo.";
    case "auth/account-exists-with-different-credential":
      // ADR 0029, item 12: the next login with the password links Google to the account.
      return "Este e-mail já tem uma conta com senha. Entre com a senha para ligar o Google à conta.";
    default:
      return authMessage(code);
  }
}
