import { deleteMe, getMe, registerMe, updateMe } from "./owner";

const baseUrl = "http://api.test";
const owner = {
  id: "0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e",
  name: "Ana",
  email: "ana@example.com",
  termsVersion: "2026-11-10",
  termsAcceptedAt: "2026-11-10T12:30:00Z",
};

/** A fetch that answers with the status and the JSON body. */
function fetchThatAnswers(status: number, body: unknown): typeof fetch {
  const response = { ok: status >= 200 && status < 300, status, json: async () => body };
  return jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe("getMe", () => {
  it("sends the ID token and returns the owner", async () => {
    const fetchFn = fetchThatAnswers(200, owner);

    const result = await getMe(baseUrl, "the-token", fetchFn);

    expect(result).toEqual({ ok: true, value: owner });
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/v1/me", {
      method: "GET",
      headers: { Authorization: "Bearer the-token" },
    });
  });

  it("returns owner_not_found when the account has no owner yet", async () => {
    const fetchFn = fetchThatAnswers(404, { error: "owner_not_found", message: "the account has no owner yet" });

    expect(await getMe(baseUrl, "the-token", fetchFn)).toEqual({ ok: false, code: "owner_not_found" });
  });

  it("returns unauthenticated when the API rejects the token", async () => {
    const fetchFn = fetchThatAnswers(401, { error: "unauthenticated", message: "the ID token is not valid" });

    expect(await getMe(baseUrl, "the-token", fetchFn)).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("returns the code network when the request fails", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;

    expect(await getMe(baseUrl, "the-token", fetchFn)).toEqual({ ok: false, code: "network" });
  });
});

describe("registerMe", () => {
  it("sends the name and the accepted terms version, and returns the owner", async () => {
    const fetchFn = fetchThatAnswers(201, owner);

    const result = await registerMe(baseUrl, "the-token", "Ana", fetchFn);

    expect(result).toEqual({ ok: true, value: owner });
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/v1/me", {
      method: "POST",
      headers: { Authorization: "Bearer the-token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", acceptedTermsVersion: "2026-11-11" }),
    });
  });

  it("returns invalid_request when the API rejects the body", async () => {
    const fetchFn = fetchThatAnswers(400, { error: "invalid_request", message: "the name is empty" });

    expect(await registerMe(baseUrl, "the-token", "", fetchFn)).toEqual({ ok: false, code: "invalid_request" });
  });
});

describe("profile and account", () => {
  it("RF-06: changes the name with PATCH /v1/me", async () => {
    const fetchFn = fetchThatAnswers(200, { ...owner, name: "Ana Souza" });
    expect(await updateMe(baseUrl, "t", "Ana Souza", fetchFn)).toEqual({ ok: true, value: { ...owner, name: "Ana Souza" } });
    const [url, init] = (fetchFn as jest.Mock).mock.calls[0];
    expect(url).toBe("http://api.test/v1/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ name: "Ana Souza" });
  });

  it("RF-08: deletes the account with DELETE /v1/me", async () => {
    const fetchFn = fetchThatAnswers(204, undefined);
    expect(await deleteMe(baseUrl, "t", fetchFn)).toEqual({ ok: true, value: undefined });
    expect((fetchFn as jest.Mock).mock.calls[0][1].method).toBe("DELETE");
  });
});
