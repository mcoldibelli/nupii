import { authMessage, googleMessage, resetMessage } from "./messages";

describe("auth messages", () => {
  it("translates the codes of Firebase that the user can fix", () => {
    expect(authMessage("auth/wrong-password")).toBe("E-mail ou senha incorretos.");
    expect(authMessage("auth/unknown")).toBe("Não foi possível concluir. Tente de novo.");
  });

  it("RF-05: an e-mail with no account gets the same answer as one with an account", () => {
    expect(resetMessage("auth/user-not-found")).toBeNull();
    expect(resetMessage("auth/invalid-email")).toBe("Informe um e-mail válido.");
  });

  it("RF-03: a closed Google window is not an error; a blocked one and an e-mail with a password are", () => {
    expect(googleMessage("auth/popup-closed-by-user")).toBeNull();
    expect(googleMessage("auth/cancelled-popup-request")).toBeNull();
    expect(googleMessage("auth/popup-blocked")).toBe("O navegador bloqueou a janela do Google. Permita janelas deste site e tente de novo.");
    expect(googleMessage("auth/account-exists-with-different-credential")).toBe("Este e-mail já tem uma conta com senha. Entre com a senha para ligar o Google à conta.");
    expect(googleMessage("auth/network-request-failed")).toBe(authMessage("auth/network-request-failed"));
  });
});
