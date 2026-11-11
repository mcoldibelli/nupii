import { validateCredentials, validateProfile } from "./validation";

describe("validateCredentials", () => {
  it("accepts an e-mail and a password with 8 characters", () => {
    expect(validateCredentials("ana@example.com", "12345678")).toBeNull();
  });

  it("rejects an e-mail without @", () => {
    expect(validateCredentials("ana.example.com", "12345678")).toBe("Informe um e-mail válido.");
  });

  it("rejects an empty e-mail", () => {
    expect(validateCredentials("  ", "12345678")).toBe("Informe um e-mail válido.");
  });

  // RN-44: a senha tem no mínimo 8 caracteres.
  it("RN-44: rejects a password with 7 characters", () => {
    expect(validateCredentials("ana@example.com", "1234567")).toBe("A senha precisa ter no mínimo 8 caracteres.");
  });
});

describe("validateProfile", () => {
  it("accepts a name with the terms accepted", () => {
    expect(validateProfile("Ana", true)).toBeNull();
  });

  // RN-45: o nome do tutor é obrigatório.
  it("RN-45: rejects a name with only spaces", () => {
    expect(validateProfile("   ", true)).toBe("Informe o seu nome.");
  });

  // RN-01: o tutor só é registrado com o aceite dos termos de uso.
  it("RN-01: rejects when the terms are not accepted", () => {
    expect(validateProfile("Ana", false)).toBe("Aceite os termos de uso para continuar.");
  });
});
