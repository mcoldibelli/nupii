import type { Pet, PetInput } from "../api/pets";

/** The texts and the choices of the pet form. An empty text has no value. */
export type PetForm = {
  name: string;
  species: PetInput["species"] | "";
  breed: string;
  sex: NonNullable<PetInput["sex"]> | "";
  size: NonNullable<PetInput["size"]> | "";
  /** Birth date as DD/MM/AAAA. */
  birthDate: string;
  /** Weight in kilograms, with comma or point. */
  weightKg: string;
  neutered: "yes" | "no" | "";
  vetName: string;
  vetClinic: string;
  vetPhone: string;
};

export const emptyForm: PetForm = {
  name: "",
  species: "",
  breed: "",
  sex: "",
  size: "",
  birthDate: "",
  weightKg: "",
  neutered: "",
  vetName: "",
  vetClinic: "",
  vetPhone: "",
};

export type FormResult = { ok: true; input: PetInput } | { ok: false; message: string };

/** RN-56: tamanhos máximos dos textos do pet. */
const limits: { field: "name" | "breed" | "vetName" | "vetClinic" | "vetPhone"; label: string; max: number }[] = [
  { field: "name", label: "O nome do pet", max: 100 },
  { field: "breed", label: "A raça", max: 100 },
  { field: "vetName", label: "O nome do veterinário", max: 120 },
  { field: "vetClinic", label: "A clínica", max: 120 },
  { field: "vetPhone", label: "O telefone do veterinário", max: 30 },
];

/** Converts DD/MM/AAAA to the date of the API (AAAA-MM-DD), or null. */
function parseDate(text: string): { iso: string; time: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (match === null) {
    return null;
  }
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  // A date such as 31/02 changes to another month: it is not a real date.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { iso: `${match[3]}-${match[2]}-${match[1]}`, time };
}

/**
 * Applies the rules of the pet data and converts the form to the input of
 * the API. The date now gives the date of today.
 */
export function toPetInput(form: PetForm, now: Date = new Date()): FormResult {
  const invalid = (message: string): FormResult => ({ ok: false, message });

  // RN-48: o nome e a espécie do pet são obrigatórios.
  const name = form.name.trim();
  if (name === "") {
    return invalid("Informe o nome do pet.");
  }
  if (form.species === "") {
    return invalid("Escolha a espécie.");
  }
  const input: PetInput = { name, species: form.species };

  // RN-56: tamanhos máximos dos textos do pet.
  for (const limit of limits) {
    const value = form[limit.field].trim();
    // The API counts characters, and the length of a string counts UTF-16 units.
    if ([...value].length > limit.max) {
      return invalid(`${limit.label} pode ter no máximo ${limit.max} caracteres.`);
    }
    if (value !== "" && limit.field !== "name") {
      input[limit.field] = value;
    }
  }

  if (form.sex !== "") {
    input.sex = form.sex;
  }
  if (form.size !== "") {
    input.size = form.size;
  }
  if (form.neutered !== "") {
    input.neutered = form.neutered === "yes";
  }

  // RN-50: a data de nascimento, quando informada, não é uma data futura.
  if (form.birthDate.trim() !== "") {
    const date = parseDate(form.birthDate.trim());
    if (date === null) {
      return invalid("Informe a data de nascimento no formato DD/MM/AAAA.");
    }
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (date.time > today) {
      return invalid("A data de nascimento não pode ser futura.");
    }
    input.birthDate = date.iso;
  }

  // RN-51: o peso, quando informado, fica entre 0,01 kg e 999,99 kg, com no
  // máximo 2 casas decimais.
  if (form.weightKg.trim() !== "") {
    const text = form.weightKg.trim().replace(",", ".");
    const weight = Number(text);
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || weight < 0.01 || weight > 999.99) {
      return invalid("Informe o peso em quilos, de 0,01 a 999,99, com até 2 casas decimais.");
    }
    input.weightKg = weight;
  }

  return { ok: true, input };
}

/** Converts a pet of the API to the texts and the choices of the form. */
export function formFromPet(pet: Pet): PetForm {
  const [year, month, day] = (pet.birthDate ?? "").split("-");
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? "",
    sex: pet.sex ?? "",
    size: pet.size ?? "",
    birthDate: pet.birthDate ? `${day}/${month}/${year}` : "",
    weightKg: pet.weightKg === undefined ? "" : String(pet.weightKg).replace(".", ","),
    neutered: pet.neutered === undefined ? "" : pet.neutered ? "yes" : "no",
    vetName: pet.vetName ?? "",
    vetClinic: pet.vetClinic ?? "",
    vetPhone: pet.vetPhone ?? "",
  };
}
