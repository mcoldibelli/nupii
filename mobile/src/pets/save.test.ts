import { SESSION_FAILURE } from "../api/http";
import { savePet } from "./save";

const baseUrl = "http://api.test";
const petId = "0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e";
const pet = { id: petId, createdAt: "2026-11-11T12:00:00Z", name: "Rex", species: "dog" };
const input = { name: "Rex", species: "dog" } as const;
const photo = new Blob(["photo"]);
const idToken = async () => "the-token";

/** A fetch that gives one answer for each call, in order. */
function fetchThatAnswers(...answers: { status: number; body: unknown }[]): jest.Mock {
  const fetchFn = jest.fn();
  for (const { status, body } of answers) {
    fetchFn.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });
  }
  return fetchFn;
}

describe("savePet", () => {
  it("creates the pet when there is no pet id", async () => {
    const fetchFn = fetchThatAnswers({ status: 201, body: pet });

    expect(await savePet({ baseUrl, idToken, fetchFn }, null, input, null)).toEqual({ kind: "saved", petId });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/v1/pets");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
  });

  it("changes the pet and then sends the photo", async () => {
    const fetchFn = fetchThatAnswers({ status: 200, body: pet }, { status: 200, body: pet });

    expect(await savePet({ baseUrl, idToken, fetchFn }, petId, input, photo)).toEqual({ kind: "saved", petId });
    expect(fetchFn.mock.calls.map((call) => [call[1].method, call[0]])).toEqual([
      ["PUT", `http://api.test/v1/pets/${petId}`],
      ["PUT", `http://api.test/v1/pets/${petId}/photo`],
    ]);
  });

  it("does not send the photo when the data is not saved", async () => {
    const fetchFn = fetchThatAnswers({ status: 400, body: { error: "invalid_request", message: "name" } });

    expect(await savePet({ baseUrl, idToken, fetchFn }, null, input, photo)).toEqual({
      kind: "failed",
      message: "O servidor respondeu com um erro (invalid_request). Tente de novo.",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("gives the id of the created pet when the photo is not sent", async () => {
    const fetchFn = fetchThatAnswers(
      { status: 201, body: pet },
      { status: 400, body: { error: "invalid_request", message: "photo" } },
    );

    expect(await savePet({ baseUrl, idToken, fetchFn }, null, input, photo)).toEqual({
      kind: "photoFailed",
      petId,
      message: "O servidor respondeu com um erro (invalid_request). Tente de novo.",
    });
  });

  it("does not call the API without an ID token", async () => {
    const fetchFn = fetchThatAnswers();

    expect(await savePet({ baseUrl, idToken: async () => null, fetchFn }, null, input, null)).toEqual({
      kind: "failed",
      message: SESSION_FAILURE,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
