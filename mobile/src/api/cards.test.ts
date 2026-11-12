import { createShareLink, listShareLinks, openShareLink, revokeShareLink } from "./cards";

const baseUrl = "http://api.test";
const link = { id: "l1", expiresAt: "x", opens: 0, createdAt: "x" };

function fetchThatAnswers(status: number, body: unknown = undefined): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("cards API", () => {
  it("creates, lists and revokes the share links of a pet", async () => {
    const create = fetchThatAnswers(201, { ...link, token: "t0" });
    expect(await createShareLink(baseUrl, "t", "p1", create)).toEqual({ ok: true, value: { ...link, token: "t0" } });
    expect(create.mock.calls[0][0]).toBe("http://api.test/v1/pets/p1/share-links");
    expect(create.mock.calls[0][1].method).toBe("POST");

    const list = fetchThatAnswers(200, { links: [link] });
    expect(await listShareLinks(baseUrl, "t", "p1", list)).toEqual({ ok: true, value: [link] });

    const revoke = fetchThatAnswers(204);
    await revokeShareLink(baseUrl, "t", "p1", "l1", revoke);
    expect(revoke.mock.calls[0][0]).toBe("http://api.test/v1/pets/p1/share-links/l1");
    expect(revoke.mock.calls[0][1].method).toBe("DELETE");
  });

  it("RN-41: opens the card with the token in the body, with no account", async () => {
    const open = fetchThatAnswers(404, { error: "share_link_not_found", message: "x" });
    expect(await openShareLink(baseUrl, "tok", open)).toEqual({ ok: false, code: "share_link_not_found" });
    expect(open.mock.calls[0][0]).toBe("http://api.test/v1/share-links/opening");
    expect(JSON.parse(open.mock.calls[0][1].body)).toEqual({ token: "tok" });
    expect(open.mock.calls[0][1].headers?.Authorization).toBeUndefined();
  });
});
