import type { HealthCard, ShareLink } from "../api/cards";
import { failureMessage } from "../api/http";
import { dateText } from "../health/form";
import { sexLabels, speciesLabels } from "../pets/labels";

type CardPet = HealthCard["pet"];
type CardVaccine = HealthCard["vaccines"][number];
type CardMedication = HealthCard["parasiteControl"][number];

/** The lines of the data of the pet and of its vet on the card (RN-83). */
export function petLines(pet: CardPet): string[] {
  const join = (parts: (string | undefined)[]) => parts.filter((part) => part !== undefined && part !== "").join(", ");
  const neutered = pet.neutered === undefined ? undefined : pet.neutered ? "castrado" : "não castrado";
  const vet = join([pet.vetName, pet.vetClinic, pet.vetPhone]);
  return [
    join([speciesLabels[pet.species], pet.breed]),
    join([pet.sex && sexLabels[pet.sex], neutered]),
    pet.birthDate ? `Nascimento: ${dateText(pet.birthDate)}` : "",
    pet.weightKg !== undefined ? `Peso: ${String(pet.weightKg).replace(".", ",")} kg` : "",
    vet ? `Veterinário: ${vet}` : "",
  ].filter((line) => line !== "");
}

/** The line of a vaccine on the card (RN-83). */
export function vaccineLine(vaccine: CardVaccine): string {
  const parts = [`${vaccine.name}: ${dateText(vaccine.date)}`];
  for (const [label, value] of [
    ["fabricante", vaccine.manufacturer],
    ["lote", vaccine.batch],
    ["dose", vaccine.dose],
    ["veterinário", vaccine.vet],
  ]) {
    if (value) {
      parts.push(`${label} ${value}`);
    }
  }
  if (vaccine.nextDoseDate) {
    parts.push(`próxima dose ${dateText(vaccine.nextDoseDate)}`);
  }
  return parts.join(", ");
}

/** The line of a flea or deworm medication on the card (RN-83). */
export function medicationLine(medication: CardMedication): string {
  const category = medication.category === "flea" ? "antipulgas" : "vermífugo";
  const line = `${medication.name} (${category}): ${dateText(medication.date)}`;
  return medication.intervalDays ? `${line}, a cada ${medication.intervalDays} dias` : line;
}

/**
 * The text of an active link: when it expires, in the time zone of the
 * device, and its opens (RN-40). A test gives the time zone.
 */
export function linkText(link: ShareLink, timeZone?: string): string {
  const opens = link.opens === 1 ? "1 abertura" : `${link.opens} aberturas`;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone }).format(new Date(link.expiresAt));
  return `Vence em ${date}. ${opens}.`;
}

/** Message for a card that does not open (RN-41). */
export function cardFailure(result: { ok: false; code: string }): string {
  if (result.code === "share_link_not_found") {
    return "Esta carteirinha não está disponível. O link venceu ou foi revogado.";
  }
  if (result.code === "rate_limited") {
    return "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.";
  }
  return failureMessage(result);
}
