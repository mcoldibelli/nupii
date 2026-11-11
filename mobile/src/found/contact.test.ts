import { CONTACT_LIMITS, foundFailureMessage, similarityLabel, toContact } from "./contact";

describe("toContact", () => {
  it("RN-63: accepts the name and the phone, without the spaces around them", () => {
    expect(toContact({ name: "  Caio Reis ", phone: " (11) 98888-7777 ", message: "  " })).toEqual({
      ok: true,
      contact: { name: "Caio Reis", phone: "(11) 98888-7777" },
    });
  });

  it("RN-63: keeps a message of 500 characters", () => {
    const message = "ç".repeat(500);

    expect(toContact({ name: "Caio", phone: "12345678", message })).toEqual({
      ok: true,
      contact: { name: "Caio", phone: "12345678", message },
    });
  });

  it.each([
    ["no name", { name: " ", phone: "12345678", message: "" }, "Informe o seu nome."],
    ["name with 121 characters", { name: "a".repeat(121), phone: "12345678", message: "" }, "O nome pode ter no máximo 120 caracteres."],
    ["phone with 7 characters", { name: "Caio", phone: "1234567", message: "" }, "Informe um telefone com DDD, de 8 a 30 caracteres."],
    ["phone with a letter", { name: "Caio", phone: "1234567a", message: "" }, "Informe um telefone com DDD, de 8 a 30 caracteres."],
    ["phone with 31 characters", { name: "Caio", phone: "1".repeat(31), message: "" }, "Informe um telefone com DDD, de 8 a 30 caracteres."],
    ["message with 501 characters", { name: "Caio", phone: "12345678", message: "a".repeat(501) }, "A mensagem pode ter no máximo 500 caracteres."],
  ])("RN-63: refuses %s", (_, form, message) => {
    expect(toContact(form)).toEqual({ ok: false, message });
  });
});

describe("foundFailureMessage", () => {
  it.each([
    ["rate_limited", "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo."],
    ["identification_not_found", "Esta busca não existe mais. Envie a foto de novo."],
    ["image_framing", "Não achamos um focinho na foto. Chegue mais perto, com o focinho no centro."],
  ])("has a text for %s", (code, text) => {
    expect(foundFailureMessage({ ok: false, code })).toBe(text);
  });
});

describe("similarityLabel", () => {
  it("shows the similarity as a percentage", () => {
    expect(similarityLabel(0.9149)).toBe("91% de semelhança");
  });
});

describe("CONTACT_LIMITS", () => {
  it("RN-63: has the limits of the rule", () => {
    expect(CONTACT_LIMITS).toEqual({ name: 120, phone: 30, message: 500 });
  });
});
