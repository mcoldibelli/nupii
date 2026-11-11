import type { Contact } from "../api/found";
import { noseprintFailureMessage } from "../biometrics/messages";

export type ContactForm = { name: string; phone: string; message: string };

export type ContactResult = { ok: true; contact: Contact } | { ok: false; message: string };

/** RN-63: tamanhos máximos dos textos do contato, em caracteres. */
export const CONTACT_LIMITS = { name: 120, phone: 30, message: 500 } as const;

// RN-63: o telefone tem de 8 a 30 caracteres: dígitos, espaço, +, -, ( e ).
const phonePattern = /^[0-9()+\- ]{8,30}$/;

/** Applies RN-63 and converts the form to the contact of the API. */
export function toContact(form: ContactForm): ContactResult {
  const invalid = (message: string): ContactResult => ({ ok: false, message });

  const name = form.name.trim();
  if (name === "") {
    return invalid("Informe o seu nome.");
  }
  // The API counts characters, and the length of a string counts UTF-16 units.
  if ([...name].length > CONTACT_LIMITS.name) {
    return invalid("O nome pode ter no máximo 120 caracteres.");
  }
  const phone = form.phone.trim();
  if (!phonePattern.test(phone)) {
    return invalid("Informe um telefone com DDD, de 8 a 30 caracteres.");
  }
  const message = form.message.trim();
  if ([...message].length > CONTACT_LIMITS.message) {
    return invalid("A mensagem pode ter no máximo 500 caracteres.");
  }
  return { ok: true, contact: message === "" ? { name, phone } : { name, phone, message } };
}

/** Texts for the failures of the public operations, by error code. */
const failures: Record<string, string> = {
  // RN-43: um endpoint público aceita no máximo 10 POST por minuto.
  rate_limited: "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.",
  identification_not_found: "Esta busca não existe mais. Envie a foto de novo.",
};

/** Message for the visitor for a failure of the identification or of the confirmation. */
export function foundFailureMessage(result: { ok: false; code: string }): string {
  return failures[result.code] ?? noseprintFailureMessage(result);
}

/** Shows the similarity of a candidate, from 0 to 1, as a percentage. */
export function similarityLabel(similarity: number): string {
  return `${Math.round(similarity * 100)}% de semelhança`;
}
