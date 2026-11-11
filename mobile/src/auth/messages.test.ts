import { authMessage, resetMessage } from "./messages";

describe("auth messages", () => {
  it("translates the codes of Firebase that the user can fix", () => {
    expect(authMessage("auth/wrong-password")).toBe("E-mail ou senha incorretos.");
    expect(authMessage("auth/unknown")).toBe("Não foi possível concluir. Tente de novo.");
  });

  it("RF-05: an e-mail with no account gets the same answer as one with an account", () => {
    expect(resetMessage("auth/user-not-found")).toBeNull();
    expect(resetMessage("auth/invalid-email")).toBe("Informe um e-mail válido.");
  });
});
