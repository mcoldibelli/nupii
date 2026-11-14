import { request } from "./http";

/** A fetch that never answers, as an API that stopped or a network that drops the packets. */
const silentFetch = (() => new Promise(() => undefined)) as unknown as typeof fetch;

describe("request (#246)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("gives a network failure when the API does not answer in 20 seconds", async () => {
    const result = request(silentFetch, "https://api.test/v1/reports", null, { method: "GET" });

    await jest.advanceTimersByTimeAsync(20_000);

    await expect(result).resolves.toEqual({ ok: false, code: "network" });
  });

  it("waits up to 2 minutes for an upload of a file", async () => {
    const body = new FormData();
    let done = false;
    const result = request(silentFetch, "https://api.test/v1/pets/x/photo", "t", { method: "PUT", body }).then((value) => {
      done = true;
      return value;
    });

    await jest.advanceTimersByTimeAsync(20_000);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(100_000);

    await expect(result).resolves.toEqual({ ok: false, code: "network" });
  });
});
