import { getReport, listBoard, listMyReports, reportFound, reportLost, reportSighting, resolveFoundReport, resolveReport } from "./reports";

const baseUrl = "http://api.test";
const id = "0195f3c8-7a55-7c1e-9d2a-000000000001";
const report = { id, type: "lost", status: "open", latitude: 1, longitude: 2, occurredAt: "x", createdAt: "x", sightings: [] };

function fetchThatAnswers(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("reports API", () => {
  it("reads a page of the board with no token", async () => {
    const page = { reports: [report], page: 2, hasNext: false, openLost: 1, openFound: 0 };
    const fetchFn = fetchThatAnswers(200, page);

    expect(await listBoard(baseUrl, 2, fetchFn)).toEqual({ ok: true, value: page });
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/v1/reports?page=2", { method: "GET", headers: {} });
  });

  it("reads the detail with no token", async () => {
    const fetchFn = fetchThatAnswers(200, report);

    expect(await getReport(baseUrl, id, fetchFn)).toEqual({ ok: true, value: report });
    expect(fetchFn.mock.calls[0][0]).toBe(`http://api.test/v1/reports/${id}`);
  });

  it("registers a lost pet with the token", async () => {
    const fetchFn = fetchThatAnswers(201, report);
    const input = { petId: id, latitude: 1, longitude: 2 };

    expect(await reportLost(baseUrl, "the-token", input, fetchFn)).toEqual({ ok: true, value: report });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://api.test/v1/reports/lost");
    expect(init.headers.Authorization).toBe("Bearer the-token");
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("gives the code of the conflict of RN-68", async () => {
    const fetchFn = fetchThatAnswers(409, { error: "lost_report_open", message: "m" });

    expect(await reportLost(baseUrl, "t", { petId: id, latitude: 1, longitude: 2 }, fetchFn)).toEqual({
      ok: false,
      code: "lost_report_open",
    });
  });

  it("sends a sighting with no token", async () => {
    const fetchFn = fetchThatAnswers(201, { id, latitude: 1, longitude: 2, createdAt: "x" });

    await reportSighting(baseUrl, id, { description: "Vi aqui." }, fetchFn);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`http://api.test/v1/reports/${id}/sightings`);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ description: "Vi aqui." });
  });

  it("publishes a found dog with the photo and the point", async () => {
    const fetchFn = fetchThatAnswers(201, { report, resolveCode: "code" });

    await reportFound(baseUrl, new Blob(["photo"]), { latitude: 1, longitude: 2 }, { place: "Rua A" }, fetchFn);

    const body = fetchFn.mock.calls[0][1].body as FormData;
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(body.get("latitude")).toBe("1");
    expect(body.get("longitude")).toBe("2");
    expect(body.get("place")).toBe("Rua A");
    expect(body.has("description")).toBe(false);
  });

  it("resolves with the token, or with the code", async () => {
    const withToken = fetchThatAnswers(200, report);
    await resolveReport(baseUrl, "the-token", id, withToken);
    expect(withToken.mock.calls[0][0]).toBe(`http://api.test/v1/reports/${id}/resolution`);

    const withCode = fetchThatAnswers(200, report);
    await resolveFoundReport(baseUrl, id, "the-code", withCode);
    expect(withCode.mock.calls[0][0]).toBe(`http://api.test/v1/reports/${id}/code-resolution`);
    expect(JSON.parse(withCode.mock.calls[0][1].body)).toEqual({ code: "the-code" });
  });

  it("lists the reports of the owner", async () => {
    const fetchFn = fetchThatAnswers(200, { reports: [report] });

    expect(await listMyReports(baseUrl, "the-token", fetchFn)).toEqual({ ok: true, value: [report] });
  });
});
