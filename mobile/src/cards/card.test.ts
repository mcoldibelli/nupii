import { cardFailure, cardFromEvents, linkText, medicationRows, vaccineRows } from "./card";

describe("health card texts", () => {
  it("RN-40: shows when the link expires and how many times it was opened", () => {
    expect(linkText({ id: "l", expiresAt: "2026-12-11T19:36:01Z", opens: 1, createdAt: "x", includeExams: false })).toBe("Vence em 11/12/2026. 1 abertura.");
    // The date is the date of the device, not of the offset of the API.
    expect(linkText({ id: "l", expiresAt: "2026-12-12T23:30:00-03:00", opens: 0, createdAt: "x", includeExams: false }, "UTC")).toBe("Vence em 13/12/2026. 0 aberturas.");
    expect(linkText({ id: "l", expiresAt: "2026-12-11T19:36:01Z", opens: 3, createdAt: "x", includeExams: false })).toBe("Vence em 11/12/2026. 3 aberturas.");
  });

  it("RN-41: says that a link that does not open is not available", () => {
    expect(cardFailure({ ok: false, code: "share_link_not_found" })).toBe(
      "Esta carteirinha não está disponível. O link venceu ou foi revogado.",
    );
    expect(cardFailure({ ok: false, code: "rate_limited" })).toBe("Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.");
  });
});

describe("card rows (Carteirinha-Mobile artboard)", () => {
  const now = new Date("2026-11-08T12:00:00Z");

  it("a vaccine shows the date, the next dose, and is late only when it is the newest of its name", () => {
    const rows = vaccineRows(
      [
        { name: "V10", date: "2026-03-15", nextDoseDate: "2027-03-15" },
        { name: "Raiva", date: "2025-10-01", nextDoseDate: "2026-10-01" },
        { name: "V10", date: "2025-03-15", nextDoseDate: "2026-03-15" },
      ],
      now,
    );
    expect(rows).toEqual([
      { name: "V10", date: "15/03/26", next: "mar/27", late: false },
      { name: "Raiva", date: "01/10/25", next: "atrasado", late: true },
      { name: "V10", date: "15/03/25", next: "mar/26", late: false },
    ]);
  });

  it("a flea or deworm medication shows the category, the product and the next date from the interval", () => {
    expect(
      medicationRows(
        [
          { name: "NexGard", category: "flea", date: "2026-10-05", intervalDays: 30 },
          { name: "Drontal Plus", category: "deworm", date: "2026-08-13", intervalDays: 92 },
          { name: "Old", category: "deworm", date: "2026-01-01" },
        ],
        now,
      ),
    ).toEqual([
      { name: "Antipulgas", product: "NexGard", date: "05/10/26", next: "atrasado", late: true },
      { name: "Vermífugo", product: "Drontal Plus", date: "13/08/26", next: "13/11", late: false },
      { name: "Vermífugo", product: "Old", date: "01/01/26", next: "—", late: false },
    ]);
  });

  it("the card of the owner comes from the pet and its events, as the API builds it (RN-83)", () => {
    const card = cardFromEvents({ name: "Rex", species: "dog", neutered: true }, [
      { id: "1", petId: "p", type: "vaccine", date: "2026-03-15", remind: false, createdAt: "x", name: "V10", nextDoseDate: "2027-03-15" },
      { id: "2", petId: "p", type: "medication", date: "2026-10-05", remind: true, createdAt: "x", name: "NexGard", medicationCategory: "flea", intervalDays: 30 },
      { id: "3", petId: "p", type: "medication", date: "2026-10-05", remind: false, createdAt: "x", name: "Antibiótico", medicationCategory: "medication" },
      { id: "4", petId: "p", type: "exam", date: "2026-10-01", remind: false, createdAt: "x", name: "Hemograma" },
    ]);
    expect(card.pet.name).toBe("Rex");
    expect(card.vaccines).toEqual([{ name: "V10", date: "2026-03-15", nextDoseDate: "2027-03-15" }]);
    expect(card.parasiteControl).toEqual([{ name: "NexGard", category: "flea", date: "2026-10-05", intervalDays: 30 }]);
  });
});
