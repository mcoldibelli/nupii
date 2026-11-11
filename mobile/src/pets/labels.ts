import type { PetInput } from "../api/pets";

/** Texts of the screens for the values of the contract. */
export const speciesLabels: Record<PetInput["species"], string> = { dog: "Cachorro", cat: "Gato", other: "Outro" };
export const sexLabels: Record<NonNullable<PetInput["sex"]>, string> = { male: "Macho", female: "Fêmea", unknown: "Indefinido" };
export const sizeLabels: Record<NonNullable<PetInput["size"]>, string> = { small: "Pequeno", medium: "Médio", large: "Grande" };
export const neuteredLabels: Record<"yes" | "no", string> = { yes: "Sim", no: "Não" };
