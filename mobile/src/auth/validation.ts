/** RN-44: a senha tem no mínimo 8 caracteres. */
const MIN_PASSWORD_LENGTH = 8;

/** Returns the message of a problem of the e-mail, or null. */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  return trimmed === "" || !trimmed.includes("@") ? "Informe um e-mail válido." : null;
}

/** RN-44: tells if the password has at least 8 characters, for the rule on the sign-up screen. */
export function passwordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/** RN-44: returns the message of a password with less than 8 characters, or null. */
export function validatePassword(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH ? `A senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.` : null;
}

/** Returns the message of the first problem of the credentials, or null. */
export function validateCredentials(email: string, password: string): string | null {
  return validateEmail(email) ?? validatePassword(password);
}

/** Returns the message of the first problem of a change of the password (RF-07), or null. */
export function validateNewPassword(current: string, next: string): string | null {
  return current === "" ? "Informe a senha atual." : validatePassword(next);
}

/** Returns the message of the first problem of the registration, or null. */
export function validateProfile(name: string, termsAccepted: boolean): string | null {
  // RN-45: o nome do tutor é obrigatório.
  if (name.trim() === "") {
    return "Informe o seu nome.";
  }
  // RN-01: o tutor só é registrado com o aceite dos termos de uso.
  if (!termsAccepted) {
    return "Aceite os termos de uso para continuar.";
  }
  return null;
}
