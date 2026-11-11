import { getNoseprint, listFoundNotices, registerNoseprint } from "./biometrics";

const baseUrl = "http://api.test";
const petId = "0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e";
const noseprint = {
  id: "0195f3c8-7a55-7c1e-9d2a-000000000001",
  imageUrl: "http://store.test/nose.jpg",
  quality: 0.87,
  modelVersion: "tinyvit21m-s43",
  capturedAt: "2026-11-11T12:00:00Z",
};

/** A fetch that answers with the status and the JSON body. */
function fetchThatAnswers(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("biometrics API", () => {
  it("gets the primary noseprint of a pet", async () => {
    const fetchFn = fetchThatAnswers(200, noseprint);

    expect(await getNoseprint(baseUrl, "the-token", petId, fetchFn)).toEqual({ ok: true, value: noseprint });
    expect(fetchFn).toHaveBeenCalledWith(`http://api.test/v1/pets/${petId}/noseprint`, {
      method: "GET",
      headers: { Authorization: "Bearer the-token" },
    });
  });

  it("gives null for a pet with no noseprint", async () => {
    const fetchFn = fetchThatAnswers(404, { error: "noseprint_not_found", message: "m" });

    expect(await getNoseprint(baseUrl, "the-token", petId, fetchFn)).toEqual({ ok: true, value: null });
  });

  it("gives the failure of another 404", async () => {
    const fetchFn = fetchThatAnswers(404, { error: "pet_not_found", message: "m" });

    expect(await getNoseprint(baseUrl, "the-token", petId, fetchFn)).toEqual({ ok: false, code: "pet_not_found" });
  });

  it("sends the photo of the nose as the part file", async () => {
    const fetchFn = fetchThatAnswers(201, noseprint);
    const photo = new Blob(["photo"]);

    expect(await registerNoseprint(baseUrl, "the-token", petId, photo, fetchFn)).toEqual({ ok: true, value: noseprint });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`http://api.test/v1/pets/${petId}/noseprints`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer the-token" });
    expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("gives the code of a refused photo", async () => {
    const fetchFn = fetchThatAnswers(422, { error: "image_framing", message: "m" });

    expect(await registerNoseprint(baseUrl, "the-token", petId, new Blob(["photo"]), fetchFn)).toEqual({
      ok: false,
      code: "image_framing",
    });
  });

  it("lists the found notices", async () => {
    const notice = {
      id: "0195f3c8-7a55-7c1e-9d2a-000000000002",
      petId,
      petName: "Rex",
      contactName: "Caio",
      contactPhone: "11 98888-7777",
      confirmedAt: "2026-11-11T12:00:00Z",
    };
    const fetchFn = fetchThatAnswers(200, { notices: [notice] });

    expect(await listFoundNotices(baseUrl, "the-token", fetchFn)).toEqual({ ok: true, value: [notice] });
    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/v1/found-notices");
  });
});
