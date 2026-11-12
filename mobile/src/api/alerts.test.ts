import { listNotifications, markAllNotificationsRead, markNotificationRead, setMyLocation } from "./alerts";

const baseUrl = "http://api.test";

function fetchThatAnswers(status: number, body: unknown = undefined): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("alerts API", () => {
  it("sends the location with the token", async () => {
    const fetchFn = fetchThatAnswers(204);

    expect(await setMyLocation(baseUrl, "the-token", { latitude: -23.5, longitude: -46.6 }, fetchFn)).toEqual({
      ok: true,
      value: undefined,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://api.test/v1/me/location");
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer the-token");
    expect(JSON.parse(init.body)).toEqual({ latitude: -23.5, longitude: -46.6 });
  });

  it("lists the notifications", async () => {
    const notification = { id: "n1", kind: "sighting", title: "Alguém viu Rex", body: "b", createdAt: "x", read: false };
    const fetchFn = fetchThatAnswers(200, { notifications: [notification] });

    expect(await listNotifications(baseUrl, "the-token", fetchFn)).toEqual({ ok: true, value: [notification] });
    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/v1/notifications");
  });

  it("marks a notification as read", async () => {
    const fetchFn = fetchThatAnswers(204);

    await markNotificationRead(baseUrl, "the-token", "n1", fetchFn);

    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/v1/notifications/n1/read");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
  });

  it("RN-74: marks all the notifications as read", async () => {
    const fetchFn = fetchThatAnswers(204);

    await markAllNotificationsRead(baseUrl, "the-token", fetchFn);

    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/v1/notifications/read");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
  });
});
