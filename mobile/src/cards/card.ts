import type { HealthCard, ShareLink } from "../api/cards";
import type { HealthEvent } from "../api/health";
import type { Pet } from "../api/pets";
import { failureMessage } from "../api/http";

type CardVaccine = HealthCard["vaccines"][number];
type CardMedication = HealthCard["parasiteControl"][number];

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

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY = 24 * 60 * 60 * 1000;
const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const today = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const time = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export type VaccineRow = { name: string; date: string; next: string; late: boolean };
export type MedicationRow = VaccineRow & { product: string };

/**
 * The rows of the vaccines of the card (Carteirinha-Mobile artboard), newest
 * first. Only the newest vaccine of a name can be late, as in RN-81.
 */
export function vaccineRows(vaccines: Pick<CardVaccine, "name" | "date" | "nextDoseDate">[], now: Date = new Date()): VaccineRow[] {
  const seen = new Set<string>();
  return vaccines.map((vaccine) => {
    const newest = !seen.has(vaccine.name);
    seen.add(vaccine.name);
    const next = vaccine.nextDoseDate;
    const late = newest && next !== undefined && time(next) < today(now);
    return { name: vaccine.name, date: short(vaccine.date), next: next === undefined ? "—" : late ? "atrasado" : `${MONTHS[Number(next.slice(5, 7)) - 1]}/${next.slice(2, 4)}`, late };
  });
}

/** The rows of the flea and deworm medications of the card, newest first. The next date is the date plus the interval (RN-81). */
export function medicationRows(medications: CardMedication[], now: Date = new Date()): MedicationRow[] {
  const seen = new Set<string>();
  return medications.map((medication) => {
    const newest = !seen.has(medication.category);
    seen.add(medication.category);
    const name = medication.category === "flea" ? "Antipulgas" : "Vermífugo";
    const row = { name, product: medication.name, date: short(medication.date) };
    if (!medication.intervalDays) {
      return { ...row, next: "—", late: false };
    }
    const due = new Date(time(medication.date) + medication.intervalDays * DAY);
    const late = newest && due.getTime() < today(now);
    const two = (value: number) => String(value).padStart(2, "0");
    return { ...row, next: late ? "atrasado" : `${two(due.getUTCDate())}/${two(due.getUTCMonth() + 1)}`, late };
  });
}

/** The card of the owner, built from the pet and its events with the rules of the API (RN-83). */
export function cardFromEvents(pet: Pick<Pet, "name" | "species"> & Partial<Pet>, events: HealthEvent[]): HealthCard {
  const newest = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return {
    pet: {
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      birthDate: pet.birthDate,
      weightKg: pet.weightKg,
      neutered: pet.neutered,
      photoUrl: pet.photoUrl,
      vetName: pet.vetName,
      vetClinic: pet.vetClinic,
      vetPhone: pet.vetPhone,
    },
    vaccines: newest
      .filter((event) => event.type === "vaccine")
      .map((event) => ({ name: event.name ?? "", date: event.date, nextDoseDate: event.nextDoseDate, manufacturer: event.manufacturer, batch: event.batch, dose: event.dose, vet: event.vet })),
    parasiteControl: newest
      .filter((event) => event.type === "medication" && (event.medicationCategory === "flea" || event.medicationCategory === "deworm"))
      .map((event) => ({ name: event.name ?? "", category: event.medicationCategory as "flea" | "deworm", date: event.date, intervalDays: event.intervalDays })),
  };
}
