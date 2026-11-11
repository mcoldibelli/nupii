import type { components } from "./api/schema";

/**
 * Version of the terms of use that the app shows. The type comes from the
 * contract: when the contract gets a new version, this line stops compiling.
 */
export const TERMS_VERSION: components["schemas"]["TermsVersion"] = "2026-11-10";

/** Text of the terms of use that the app shows before the acceptance. */
export const TERMS_TEXT =
  "O texto dos termos de uso e da política de privacidade ainda não foi publicado. " +
  "Esta versão do app é só para o ambiente de desenvolvimento.";
