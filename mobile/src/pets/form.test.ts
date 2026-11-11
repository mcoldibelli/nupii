import { emptyForm, formFromPet, toPetInput, type PetForm } from "./form";

const today = new Date(Date.UTC(2026, 10, 11));

function form(change: Partial<PetForm>): PetForm {
  return { ...emptyForm, name: "Rex", species: "dog", ...change };
}

describe("toPetInput", () => {
  it("accepts only the required data", () => {
    expect(toPetInput(form({}), today)).toEqual({ ok: true, input: { name: "Rex", species: "dog" } });
  });

  it("converts all the data to the format of the API", () => {
    const result = toPetInput(
      form({
        name: "  Rex ",
        breed: " Vira-lata ",
        sex: "male",
        size: "medium",
        birthDate: "15/03/2021",
        weightKg: "12,35",
        neutered: "yes",
        vetName: "Dra. Bia",
        vetClinic: "Clínica Central",
        vetPhone: "11 99999-0000",
      }),
      today,
    );

    expect(result).toEqual({
      ok: true,
      input: {
        name: "Rex",
        species: "dog",
        breed: "Vira-lata",
        sex: "male",
        size: "medium",
        birthDate: "2021-03-15",
        weightKg: 12.35,
        neutered: true,
        vetName: "Dra. Bia",
        vetClinic: "Clínica Central",
        vetPhone: "11 99999-0000",
      },
    });
  });

  it("sends neutered false for the answer no", () => {
    expect(toPetInput(form({ neutered: "no" }), today)).toEqual({
      ok: true,
      input: { name: "Rex", species: "dog", neutered: false },
    });
  });

  // RN-48: o nome e a espécie do pet são obrigatórios.
  it("RN-48: rejects an empty name", () => {
    expect(toPetInput(form({ name: "  " }), today)).toEqual({ ok: false, message: "Informe o nome do pet." });
  });

  it("RN-48: rejects a form without the species", () => {
    expect(toPetInput(form({ species: "" }), today)).toEqual({ ok: false, message: "Escolha a espécie." });
  });

  // RN-50: a data de nascimento não é uma data futura.
  it("RN-50: accepts the birth date of today", () => {
    expect(toPetInput(form({ birthDate: "11/11/2026" }), today)).toMatchObject({ ok: true });
  });

  it("RN-50: rejects a birth date in the future", () => {
    expect(toPetInput(form({ birthDate: "12/11/2026" }), today)).toEqual({
      ok: false,
      message: "A data de nascimento não pode ser futura.",
    });
  });

  it("rejects a birth date that is not a date", () => {
    for (const birthDate of ["31/02/2021", "2021-03-15", "15/3", "abc"]) {
      expect(toPetInput(form({ birthDate }), today)).toEqual({
        ok: false,
        message: "Informe a data de nascimento no formato DD/MM/AAAA.",
      });
    }
  });

  // RN-51: o peso fica entre 0,01 kg e 999,99 kg, com no máximo 2 casas decimais.
  it("RN-51: accepts the limits of the weight", () => {
    expect(toPetInput(form({ weightKg: "0,01" }), today)).toMatchObject({ ok: true, input: { weightKg: 0.01 } });
    expect(toPetInput(form({ weightKg: "999.99" }), today)).toMatchObject({ ok: true, input: { weightKg: 999.99 } });
  });

  it("RN-51: rejects a weight out of the limits or with 3 decimal places", () => {
    for (const weightKg of ["0", "1000", "12,345", "doze"]) {
      expect(toPetInput(form({ weightKg }), today)).toEqual({
        ok: false,
        message: "Informe o peso em quilos, de 0,01 a 999,99, com até 2 casas decimais.",
      });
    }
  });

  // RN-56: tamanhos máximos dos textos do pet.
  it("RN-56: counts a character out of the basic plane as one character", () => {
    const name = "🐶".repeat(100);

    expect(toPetInput(form({ name }), today)).toEqual({ ok: true, input: { name, species: "dog" } });
    expect(toPetInput(form({ name: name + "🐶" }), today).ok).toBe(false);
  });

  it("RN-56: rejects a name with more than 100 characters", () => {
    expect(toPetInput(form({ name: "a".repeat(101) }), today)).toEqual({
      ok: false,
      message: "O nome do pet pode ter no máximo 100 caracteres.",
    });
  });
});

describe("formFromPet", () => {
  it("converts a pet of the API to the texts of the form", () => {
    const pet = {
      id: "0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e",
      createdAt: "2026-11-11T12:00:00Z",
      name: "Rex",
      species: "dog" as const,
      birthDate: "2021-03-15",
      weightKg: 12.5,
      neutered: false,
    };

    expect(formFromPet(pet)).toEqual({
      ...emptyForm,
      name: "Rex",
      species: "dog",
      birthDate: "15/03/2021",
      weightKg: "12,5",
      neutered: "no",
    });
  });
});
