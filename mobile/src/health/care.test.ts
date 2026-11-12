import { careLine, careText, dateTile } from "./care";

describe("careText", () => {
  const now = new Date(Date.UTC(2026, 10, 11, 12));
  const item = { eventId: "e", petId: "p", petName: "Rex", type: "vaccine" as const, title: "V10" };

  it("RN-81: says how many days are left, or that the care is late", () => {
    expect(careText({ ...item, dueDate: "2026-11-11" }, now)).toBe("Rex: V10, hoje");
    expect(careText({ ...item, dueDate: "2026-11-12" }, now)).toBe("Rex: V10, amanhã");
    expect(careText({ ...item, dueDate: "2026-11-21" }, now)).toBe("Rex: V10, em 10 dias");
    expect(careText({ ...item, dueDate: "2026-11-06" }, now)).toBe("Rex: V10, atrasado há 5 dias");
  });
});

describe("dateTile", () => {
  it("RN-81: gives the month and the day of the due date for the date tile of the home", () => {
    expect(dateTile("2026-11-13")).toEqual({ month: "nov", day: "13" });
    expect(dateTile("2027-01-05")).toEqual({ month: "jan", day: "5" });
  });
});

describe("careLine", () => {
  it("RN-81: gives the weekday and the days left, as in the canvas", () => {
    const now = new Date(Date.UTC(2026, 10, 12, 12));
    expect(careLine("2026-11-13", now)).toBe("sexta · amanhã");
    expect(careLine("2026-11-18", now)).toBe("quarta · em 6 dias");
  });
});
