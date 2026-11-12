import { openLostReportOf, reportFailureMessage, reportTitle, toDetails, toOccurredAt } from "./form";

describe("toDetails", () => {
  it("RN-70: removes the spaces around the texts, and an empty text has no value", () => {
    expect(toDetails({ place: "  Praça da Sé ", description: "  " })).toEqual({ ok: true, details: { place: "Praça da Sé" } });
  });

  it.each([
    ["place with 201 characters", { place: "a".repeat(201), description: "" }, "O nome do local pode ter no máximo 200 caracteres."],
    ["description with 1001 characters", { place: "", description: "a".repeat(1001) }, "O recado pode ter no máximo 1.000 caracteres."],
  ])("RN-70: refuses a %s", (_, form, message) => {
    expect(toDetails(form)).toEqual({ ok: false, message });
  });

  it("RN-70: counts a character out of the basic plane as one character", () => {
    const place = "🐶".repeat(200);

    expect(toDetails({ place, description: "" })).toEqual({ ok: true, details: { place } });
  });
});

describe("openLostReportOf", () => {
  const report = (petId: string, status: "open" | "resolved") => ({
    id: `${petId}-${status}`,
    type: "lost" as const,
    status,
    petId,
    latitude: 0,
    longitude: 0,
    occurredAt: "x",
    createdAt: "x",
    sightings: [],
  });

  it("gives the open lost report of the pet", () => {
    const reports = [report("rex", "resolved"), report("mel", "open"), report("rex", "open")];

    expect(openLostReportOf(reports, "rex")?.id).toBe("rex-open");
    expect(openLostReportOf(reports, "bob")).toBeUndefined();
  });
});

describe("reportFailureMessage", () => {
  it.each([
    ["lost_report_open", "Este pet já tem um desaparecimento aberto."],
    ["report_not_open", "Esta ocorrência já foi resolvida."],
    ["report_not_found", "Esta ocorrência não existe mais."],
    ["rate_limited", "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo."],
  ])("has a text for %s", (code, text) => {
    expect(reportFailureMessage({ ok: false, code })).toBe(text);
  });
});

describe("reportTitle", () => {
  const base = { id: "id", status: "open" as const, latitude: 0, longitude: 0, occurredAt: "x", createdAt: "x", sightings: [] };

  it("names the pet of a lost report, and says when the report is resolved", () => {
    expect(reportTitle({ ...base, type: "lost", petName: "Rex" })).toBe("Perdido: Rex");
    expect(reportTitle({ ...base, type: "found" })).toBe("Achado");
    expect(reportTitle({ ...base, type: "lost", petName: "Rex", status: "resolved" })).toBe("Perdido: Rex (resolvido)");
  });
});

describe("toOccurredAt", () => {
  const now = new Date(Date.UTC(2026, 10, 11, 9, 30));

  it("RN-71: an empty date has no value: the API uses the time of the registration", () => {
    expect(toOccurredAt(" ", now)).toEqual({ ok: true });
  });

  it("RN-71: the date of today has no value, so it is not after now", () => {
    expect(toOccurredAt("11/11/2026", now)).toEqual({ ok: true });
  });

  it("RN-71: a date before today is the middle of that day, in UTC", () => {
    expect(toOccurredAt("09/11/2026", now)).toEqual({ ok: true, value: "2026-11-09T12:00:00.000Z" });
  });

  it.each([
    ["12/11/2026", "A data do desaparecimento não pode ser futura."],
    ["31/02/2026", "Informe a data no formato DD/MM/AAAA."],
    ["ontem", "Informe a data no formato DD/MM/AAAA."],
  ])("RN-71: refuses %s", (text, message) => {
    expect(toOccurredAt(text, now)).toEqual({ ok: false, message });
  });
});
