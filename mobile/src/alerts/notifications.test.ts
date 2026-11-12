import { groupNotifications, notificationTarget } from "./notifications";

describe("notificationTarget", () => {
  it("opens the report of a nearby alert and of a sighting, and the found notices of a found pet", () => {
    expect(notificationTarget({ kind: "lost_nearby", reportId: "r1" })).toEqual({ pathname: "/reports/[id]", params: { id: "r1" } });
    expect(notificationTarget({ kind: "sighting", reportId: "r2" })).toEqual({ pathname: "/reports/[id]", params: { id: "r2" } });
    expect(notificationTarget({ kind: "found" })).toEqual({ pathname: "/found-notices" });
  });
});

describe("groupNotifications", () => {
  it("splits the notifications in today, this week and before (Notificacoes-Modal artboard)", () => {
    const now = new Date(2026, 10, 12, 15, 0);
    const at = (date: Date) => ({ id: date.toISOString(), createdAt: date.toISOString() });
    const today = at(new Date(2026, 10, 12, 8, 0));
    const monday = at(new Date(2026, 10, 9, 10, 0));
    const old = at(new Date(2026, 10, 1, 10, 0));
    expect(groupNotifications([today, monday, old], now)).toEqual([
      { title: "Hoje", items: [today] },
      { title: "Esta semana", items: [monday] },
      { title: "Antes", items: [old] },
    ]);
    expect(groupNotifications([old], now)).toEqual([{ title: "Antes", items: [old] }]);
  });
});
