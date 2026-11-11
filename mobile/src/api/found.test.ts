import { confirmIdentification, identifyNose } from "./found";

const baseUrl = "http://api.test";
const identification = {
  id: "0195f3c8-7a55-7c1e-9d2a-000000000001",
  candidates: [{ id: "0195f3c8-7a55-7c1e-9d2a-000000000002", petName: "Rex", similarity: 0.91, strong: true }],
};
const photo = new Blob(["photo"]);

/** A fetch that answers with the status and the JSON body. */
function fetchThatAnswers(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("found API", () => {
  it("sends the photo with no token and gets the candidates", async () => {
    const fetchFn = fetchThatAnswers(200, identification);

    expect(await identifyNose(baseUrl, photo, null, fetchFn)).toEqual({ ok: true, value: identification });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://api.test/v1/identifications");
    expect(init.method).toBe("POST");
    // RF-12: the visitor has no account, so the request has no Authorization header.
    expect(init.headers).toEqual({});
    const body = init.body as FormData;
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(body.has("latitude")).toBe(false);
  });

  it("RN-61: sends the latitude and the longitude together", async () => {
    const fetchFn = fetchThatAnswers(200, identification);

    await identifyNose(baseUrl, photo, { latitude: -23.55, longitude: -46.63 }, fetchFn);

    const body = fetchFn.mock.calls[0][1].body as FormData;
    expect(body.get("latitude")).toBe("-23.55");
    expect(body.get("longitude")).toBe("-46.63");
  });

  it("gives the code of a refused photo", async () => {
    const fetchFn = fetchThatAnswers(422, { error: "image_low_quality", message: "m" });

    expect(await identifyNose(baseUrl, photo, null, fetchFn)).toEqual({ ok: false, code: "image_low_quality" });
  });

  it("confirms a candidate with the contact and the photo", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    const contact = { name: "Caio", phone: "11 98888-7777", message: "Achei na praça." };

    const result = await confirmIdentification(baseUrl, identification.id, identification.candidates[0].id, contact, photo, fetchFn);

    expect(result).toEqual({ ok: true, value: undefined });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`http://api.test/v1/identifications/${identification.id}/confirmation`);
    const body = init.body as FormData;
    expect(body.get("candidateId")).toBe(identification.candidates[0].id);
    expect(body.get("name")).toBe("Caio");
    expect(body.get("phone")).toBe("11 98888-7777");
    expect(body.get("message")).toBe("Achei na praça.");
    expect(body.get("file")).toBeInstanceOf(Blob);
  });

  it("does not send an empty message", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, status: 204 });

    await confirmIdentification(baseUrl, "id", "candidate", { name: "Caio", phone: "11 98888-7777" }, photo, fetchFn);

    expect((fetchFn.mock.calls[0][1].body as FormData).has("message")).toBe(false);
  });
});
