import type { HealthEvent, UpcomingCare } from "../api/health";
import { careWithin, itemDetail, itemLine, itemStatus, lateCare } from "./board";

const now = new Date("2026-11-08T12:00:00Z");
const event = (fields: Partial<HealthEvent>): HealthEvent => ({ id: "e1", petId: "p", type: "vaccine", date: "2026-03-15", remind: false, createdAt: "2026-03-15T00:00:00Z", ...fields });
const care = (fields: Partial<UpcomingCare>): UpcomingCare => ({ eventId: "e1", petId: "p", petName: "Shakira", type: "medication", title: "Antipulgas", dueDate: "2026-11-05", ...fields });

test("the late care is the oldest care before today (Saude-Mobile banner)", () => {
  expect(lateCare([care({ dueDate: "2026-11-20" }), care({ eventId: "e2", dueDate: "2026-11-05" })], now)).toEqual({ care: care({ eventId: "e2", dueDate: "2026-11-05" }), days: 3 });
  expect(lateCare([care({ dueDate: "2026-11-08" })], now)).toBeNull();
});

test("the status of an item comes from its next care, or from its type", () => {
  expect(itemStatus(event({ type: "medication" }), [care({})], now)).toEqual({ label: "Atrasado", tone: "late" });
  expect(itemStatus(event({ type: "medication" }), [care({ dueDate: "2026-11-13" })], now)).toEqual({ label: "Em 5 dias", tone: "brand" });
  expect(itemStatus(event({ type: "medication" }), [care({ dueDate: "2026-12-05" })], now)).toEqual({ label: "05/12", tone: "info" });
  expect(itemStatus(event({ type: "vaccine" }), [care({ type: "vaccine", dueDate: "2027-03-15" })], now)).toEqual({ label: "mar/27", tone: "info" });
  expect(itemStatus(event({ type: "vaccine" }), [], now)).toEqual({ label: "Aplicada", tone: "ok" });
  expect(itemStatus(event({ type: "medication", inUse: false }), [], now)).toEqual({ label: "Concluído", tone: "ok" });
  expect(itemStatus(event({ type: "consultation" }), [], now)).toEqual({ label: "Feita", tone: "ok" });
  expect(itemStatus(event({ type: "note", weightKg: 7.2 }), [], now)).toEqual({ label: "7,2 kg", tone: "info" });
});

test("the line of an item has the date and who or what", () => {
  expect(itemLine(event({ vet: "Dra. Paula" }))).toBe("15/03/2026 · Dra. Paula");
  expect(itemLine(event({ type: "medication", dosage: "1 comprimido", frequency: "mensal" }))).toBe("15/03/2026 · 1 comprimido · mensal");
});

test("the detail of an item of the wide table has what is not in the other columns (Saude-Web)", () => {
  expect(itemDetail(event({ batch: "4471B", dose: "reforço anual", vet: "Dra. Paula" }))).toBe("reforço anual · lote 4471B");
  expect(itemDetail(event({ type: "medication", dosage: "4–10 kg", frequency: "mensal" }))).toBe("4–10 kg · mensal");
  expect(itemDetail(event({ type: "consultation", reason: "check-up", diagnosis: "sem alterações" }))).toBe("check-up · sem alterações");
  expect(itemDetail(event({}))).toBe("");
});

test("the care of the next 60 days includes the late care, in date order (Saude-Web)", () => {
  const items = [care({ eventId: "far", dueDate: "2027-01-08" }), care({ eventId: "in", dueDate: "2027-01-07" }), care({ eventId: "late", dueDate: "2026-11-05" })];
  expect(careWithin(items, 60, now).map((item) => item.eventId)).toEqual(["late", "in"]);
});
