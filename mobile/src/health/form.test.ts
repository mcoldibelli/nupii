import { emptyValues, fieldsOf, toEventInput, valuesFromEvent } from "./form";

const now = new Date(Date.UTC(2026, 10, 11, 12));

describe("fieldsOf", () => {
  it("has the fields of each type, with the required ones first", () => {
    expect(fieldsOf("vaccine").map((field) => field.key)).toEqual([
      "name",
      "manufacturer",
      "batch",
      "dose",
      "vet",
      "nextDoseDate",
      "remind",
    ]);
    expect(fieldsOf("note").map((field) => field.key)).toEqual(["noteCategory", "title", "weightKg"]);
  });
});

describe("toEventInput", () => {
  it("RN-77: converts a vaccine to the input of the API", () => {
    const values = { ...emptyValues(), date: "10/11/2026", name: "  V10 ", nextDoseDate: "10/11/2027", remind: true, notes: " " };

    expect(toEventInput("vaccine", values, now)).toEqual({
      ok: true,
      input: { type: "vaccine", date: "2026-11-10", name: "V10", nextDoseDate: "2027-11-10", remind: true },
    });
  });

  it("RN-37: converts a medication, with the interval as a number", () => {
    const values = {
      ...emptyValues(),
      date: "01/11/2026",
      name: "Bravecto",
      medicationCategory: "flea",
      intervalDays: "90",
      inUse: true,
      remind: true,
    };

    expect(toEventInput("medication", values, now)).toEqual({
      ok: true,
      input: {
        type: "medication",
        date: "2026-11-01",
        name: "Bravecto",
        medicationCategory: "flea",
        intervalDays: 90,
        inUse: true,
        remind: true,
      },
    });
  });

  it("RN-78: converts the weight with a comma", () => {
    const values = { ...emptyValues(), date: "11/11/2026", reason: "Tosse", weightKg: "12,35" };

    expect(toEventInput("consultation", values, now)).toEqual({
      ok: true,
      input: { type: "consultation", date: "2026-11-11", reason: "Tosse", weightKg: 12.35 },
    });
  });

  it.each([
    ["RN-76 no date", "exam", { name: "X" }, "Informe a data no formato DD/MM/AAAA."],
    ["RN-76 date in the future", "exam", { date: "12/11/2026", name: "X" }, "A data do evento não pode ser futura."],
    ["RN-79 exam with no name", "exam", { date: "11/11/2026" }, "Informe o nome."],
    ["RN-38 note with no category", "note", { date: "11/11/2026", title: "A" }, "Escolha a categoria."],
    ["RN-37 interval of 0 days", "medication", { date: "11/11/2026", name: "X", medicationCategory: "flea", intervalDays: "0" }, "O intervalo vai de 1 a 365 dias."],
    ["RN-77 next dose before the date", "vaccine", { date: "11/11/2026", name: "V10", nextDoseDate: "10/11/2026" }, "A próxima dose não pode ser antes da data do evento."],
    ["RN-80 name with 121 characters", "exam", { date: "11/11/2026", name: "a".repeat(121) }, "O nome pode ter no máximo 120 caracteres."],
  ])("%s", (_, type, change, message) => {
    expect(toEventInput(type as never, { ...emptyValues(), ...change }, now)).toEqual({ ok: false, message });
  });
});

describe("valuesFromEvent", () => {
  it("converts an event of the API to the texts of the form", () => {
    const values = valuesFromEvent({
      id: "e1",
      petId: "p1",
      type: "consultation",
      date: "2026-11-10",
      reason: "Tosse",
      weightKg: 12.5,
      returnDate: "2026-11-20",
      remind: false,
      createdAt: "x",
    });

    expect(values.date).toBe("10/11/2026");
    expect(values.reason).toBe("Tosse");
    expect(values.weightKg).toBe("12,5");
    expect(values.returnDate).toBe("20/11/2026");
    expect(values.name).toBe("");
  });
});
