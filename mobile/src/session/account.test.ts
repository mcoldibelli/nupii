import { deleteAccountFlow, renameFailure } from "./account";

describe("account flows", () => {
  function deps(overrides: Partial<Parameters<typeof deleteAccountFlow>[0]> = {}) {
    const calls: string[] = [];
    return {
      calls,
      value: {
        confirm: async (password: string) => {
          calls.push(`confirm ${password}`);
          return null;
        },
        idToken: async () => "token",
        remove: async (token: string) => {
          calls.push(`delete ${token}`);
          return { ok: true as const, value: undefined };
        },
        signOut: async () => {
          calls.push("sign out");
          return null;
        },
        ...overrides,
      },
    };
  }

  it("RF-08: checks the password, deletes the account, then signs out (RN-04)", async () => {
    const run = deps();
    expect(await deleteAccountFlow(run.value, "p")).toBeNull();
    expect(run.calls).toEqual(["confirm p", "delete token", "sign out"]);
  });

  it("RF-08: a wrong password does not delete the account", async () => {
    const run = deps({ confirm: async () => "E-mail ou senha incorretos." });
    expect(await deleteAccountFlow(run.value, "x")).toBe("E-mail ou senha incorretos.");
    expect(run.calls).toEqual([]);
  });

  it("RN-45: says the limit of the name", () => {
    expect(renameFailure({ ok: false, code: "invalid_request" })).toBe("Informe um nome com até 100 caracteres.");
  });
});
