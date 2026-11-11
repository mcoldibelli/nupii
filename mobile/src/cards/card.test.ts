import { cardFailure, linkText, medicationLine, petLines, vaccineLine } from "./card";

describe("health card texts", () => {
  it("RN-83: shows the pet and its vet", () => {
    expect(
      petLines({
        name: "Rex", species: "dog", breed: "Vira-lata", sex: "male", neutered: true,
        birthDate: "2021-03-15", weightKg: 12.5, vetName: "Dra. Lia", vetClinic: "Clínica Central", vetPhone: "11 3333-0000",
      }),
    ).toEqual(["Cachorro, Vira-lata", "Macho, castrado", "Nascimento: 15/03/2021", "Peso: 12,5 kg", "Veterinário: Dra. Lia, Clínica Central, 11 3333-0000"]);
    expect(petLines({ name: "Mel", species: "cat" })).toEqual(["Gato"]);
  });

  it("RN-83: shows the vaccines and the parasite control", () => {
    expect(vaccineLine({ name: "V10", date: "2026-10-12", nextDoseDate: "2027-10-12", batch: "L1" })).toBe(
      "V10: 12/10/2026, lote L1, próxima dose 12/10/2027",
    );
    expect(medicationLine({ name: "Bravecto", category: "flea", date: "2026-11-01", intervalDays: 90 })).toBe(
      "Bravecto (antipulgas): 01/11/2026, a cada 90 dias",
    );
    expect(medicationLine({ name: "Drontal", category: "deworm", date: "2026-11-01" })).toBe("Drontal (vermífugo): 01/11/2026");
  });

  it("RN-40: shows when the link expires and how many times it was opened", () => {
    expect(linkText({ id: "l", expiresAt: "2026-12-11T19:36:01Z", opens: 1, createdAt: "x" })).toBe("Vence em 11/12/2026. 1 abertura.");
    expect(linkText({ id: "l", expiresAt: "2026-12-11T19:36:01Z", opens: 3, createdAt: "x" })).toBe("Vence em 11/12/2026. 3 aberturas.");
  });

  it("RN-41: says that a link that does not open is not available", () => {
    expect(cardFailure({ ok: false, code: "share_link_not_found" })).toBe(
      "Esta carteirinha não está disponível. O link venceu ou foi revogado.",
    );
    expect(cardFailure({ ok: false, code: "rate_limited" })).toBe("Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.");
  });
});
