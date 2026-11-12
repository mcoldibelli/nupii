import { distanceKm, timeAgo } from "./board";

test("the distance between two points, in km (haversine)", () => {
  expect(distanceKm({ latitude: -10, longitude: -50 }, { latitude: -10.01, longitude: -50 })).toBeCloseTo(1.11, 2);
});

test("the time since a report, as the Mural-Mobile artboard", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  expect(timeAgo("2026-11-12T11:20:00Z", now)).toBe("há 40 min");
  expect(timeAgo("2026-11-12T09:00:00Z", now)).toBe("há 3 h");
  expect(timeAgo("2026-11-11T09:00:00Z", now)).toBe("ontem");
  expect(timeAgo("2026-11-09T12:00:00Z", now)).toBe("há 3 dias");
  expect(timeAgo("2026-11-12T11:59:40Z", now)).toBe("agora");
});

