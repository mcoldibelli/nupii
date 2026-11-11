import { notificationTarget } from "./notifications";

describe("notificationTarget", () => {
  it("opens the report of a nearby alert and of a sighting, and the found notices of a found pet", () => {
    expect(notificationTarget({ kind: "lost_nearby", reportId: "r1" })).toEqual({ pathname: "/reports/[id]", params: { id: "r1" } });
    expect(notificationTarget({ kind: "sighting", reportId: "r2" })).toEqual({ pathname: "/reports/[id]", params: { id: "r2" } });
    expect(notificationTarget({ kind: "found" })).toEqual({ pathname: "/found-notices" });
  });
});
