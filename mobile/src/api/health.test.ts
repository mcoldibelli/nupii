import { getHealth } from "./health";

const baseUrl = "http://api.test";

/** A fetch that answers with the status and the JSON body. */
function fetchThatAnswers(status: number, body: unknown): typeof fetch {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
  return jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe("getHealth", () => {
  it("returns the status when the API answers 200", async () => {
    const fetchFn = fetchThatAnswers(200, { status: "ok" });

    const result = await getHealth(baseUrl, fetchFn);

    expect(result).toEqual({ ok: true, status: "ok" });
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/v1/health");
  });

  it("returns the error code of the API when the API answers 503", async () => {
    const fetchFn = fetchThatAnswers(503, { error: "unavailable", message: "the database does not respond" });

    const result = await getHealth(baseUrl, fetchFn);

    expect(result).toEqual({ ok: false, code: "unavailable" });
  });

  it("returns the code network when the request fails", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;

    const result = await getHealth(baseUrl, fetchFn);

    expect(result).toEqual({ ok: false, code: "network" });
  });

  it("returns the code network when the answer is not JSON", async () => {
    const response = {
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    };
    const fetchFn = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;

    const result = await getHealth(baseUrl, fetchFn);

    expect(result).toEqual({ ok: false, code: "network" });
  });
});
