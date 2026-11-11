import { createPet, deletePet, listPets, updatePet, uploadPetPhoto } from "./pets";

const baseUrl = "http://api.test";
const pet = {
  id: "0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e",
  createdAt: "2026-11-11T12:00:00Z",
  name: "Rex",
  species: "dog",
};

/** A fetch that answers with the status and the JSON body. */
function fetchThatAnswers(status: number, body: unknown): typeof fetch {
  const response = { ok: status >= 200 && status < 300, status, json: async () => body };
  return jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe("pets API", () => {
  it("lists the pets with the ID token", async () => {
    const fetchFn = fetchThatAnswers(200, { pets: [pet] });

    expect(await listPets(baseUrl, "the-token", fetchFn)).toEqual({ ok: true, value: [pet] });
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/v1/pets", {
      method: "GET",
      headers: { Authorization: "Bearer the-token" },
    });
  });

  it("creates a pet with the JSON body", async () => {
    const fetchFn = fetchThatAnswers(201, pet);

    const result = await createPet(baseUrl, "the-token", { name: "Rex", species: "dog" }, fetchFn);

    expect(result).toEqual({ ok: true, value: pet });
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/v1/pets", {
      method: "POST",
      headers: { Authorization: "Bearer the-token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Rex", species: "dog" }),
    });
  });

  it("updates a pet with PUT on the address of the pet", async () => {
    const fetchFn = fetchThatAnswers(200, pet);

    await updatePet(baseUrl, "the-token", pet.id, { name: "Rex", species: "dog" }, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(`http://api.test/v1/pets/${pet.id}`, expect.objectContaining({ method: "PUT" }));
  });

  it("returns the error code of the API", async () => {
    const fetchFn = fetchThatAnswers(404, { error: "pet_not_found", message: "the pet does not exist" });

    expect(await updatePet(baseUrl, "the-token", pet.id, { name: "Rex", species: "dog" }, fetchFn)).toEqual({
      ok: false,
      code: "pet_not_found",
    });
  });

  it("deletes a pet: the answer 204 has no body", async () => {
    const response = {
      ok: true,
      status: 204,
      json: async () => {
        throw new SyntaxError("no body");
      },
    };
    const fetchFn = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;

    expect(await deletePet(baseUrl, "the-token", pet.id, fetchFn)).toEqual({ ok: true, value: undefined });
    expect(fetchFn).toHaveBeenCalledWith(`http://api.test/v1/pets/${pet.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer the-token" },
    });
  });

  it("uploads the photo as the part file of a multipart body", async () => {
    const fetchFn = fetchThatAnswers(200, { ...pet, photoUrl: "http://files.test/photo" });

    const photo = new Blob(["the bytes of the photo"], { type: "image/jpeg" });

    const result = await uploadPetPhoto(baseUrl, "the-token", pet.id, photo, fetchFn);

    expect(result).toMatchObject({ ok: true, value: { photoUrl: "http://files.test/photo" } });
    const [url, init] = (fetchFn as jest.Mock).mock.calls[0];
    expect(url).toBe(`http://api.test/v1/pets/${pet.id}/photo`);
    expect(init.method).toBe("PUT");
    // The Content-Type is not set: fetch adds it with the multipart boundary.
    expect(init.headers).toEqual({ Authorization: "Bearer the-token" });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("returns the code network when the request fails", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;

    expect(await listPets(baseUrl, "the-token", fetchFn)).toEqual({ ok: false, code: "network" });
  });
});
