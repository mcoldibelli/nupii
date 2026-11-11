/** RN-44: the password has at least 8 characters. */
const MIN_PASSWORD_LENGTH = 8;

/** Returns the message of the first problem of the credentials, or null. */
export function validateCredentials(email: string, password: string): string | null {
  const trimmed = email.trim();
  if (trimmed === "" || !trimmed.includes("@")) {
    return "Informe um e-mail válido.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

/** Returns the message of the first problem of the registration, or null. */
export function validateProfile(name: string, termsAccepted: boolean): string | null {
  // RN-45: the name of the owner is required.
  if (name.trim() === "") {
    return "Informe o seu nome.";
  }
  // RN-01: the owner is registered only with the acceptance of the terms.
  if (!termsAccepted) {
    return "Aceite os termos de uso para continuar.";
  }
  return null;
}
