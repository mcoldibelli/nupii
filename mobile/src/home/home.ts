import type { Pet } from "../api/pets";
import { sexLabels, speciesLabels } from "../pets/labels";

/** The age of a pet in years, or in months under one year. */
function age(birthDate: string, now: Date): string {
  const [year, month, day] = birthDate.split("-").map(Number);
  let months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  if (now.getUTCDate() < day) {
    months -= 1;
  }
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return years === 1 ? "1 ano" : `${years} anos`;
  }
  return months === 1 ? "1 mês" : `${Math.max(months, 0)} meses`;
}

/** "Shih Tzu · fêmea · 1 ano": the breed (or the species), the sex and the age, as in the canvas. */
export function petSubtitle(pet: Pick<Pet, "species" | "breed" | "sex" | "birthDate">, now: Date = new Date()): string {
  const parts = [pet.breed ?? speciesLabels[pet.species]];
  if (pet.sex && pet.sex !== "unknown") {
    parts.push(sexLabels[pet.sex].toLowerCase());
  }
  if (pet.birthDate) {
    parts.push(age(pet.birthDate, now));
  }
  return parts.join(" · ");
}

/** The pet that the home shows: the saved one, or the first. */
export function pickPet<T extends { id: string }>(pets: T[], savedId: string | null): T | null {
  return pets.find((pet) => pet.id === savedId) ?? pets[0] ?? null;
}

const kg = (value: number) => `${value.toFixed(1).replace(".", ",")} kg`;

/**
 * The weight of the pet from its health events (RN-51): the last six points,
 * the latest weight, and the change from the first point of the last 6 months.
 */
export function weightTrend(events: { date: string; weightKg?: number }[], now: Date = new Date()): { points: { date: string; kg: number }[]; latest: string; change: string | null } | null {
  const points = events
    .filter((event): event is { date: string; weightKg: number } => typeof event.weightKg === "number")
    .map((event) => ({ date: event.date, kg: event.weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-6);
  if (points.length === 0) {
    return null;
  }
  const limit = new Date(now);
  limit.setUTCMonth(limit.getUTCMonth() - 6);
  const since = points.find((point) => point.date >= limit.toISOString().slice(0, 10));
  const last = points[points.length - 1];
  const delta = since && since !== last ? Math.round((last.kg - since.kg) * 10) / 10 : null;
  const change = delta === null || delta === 0 ? null : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1).replace(".", ",")} em 6 meses`;
  return { points, latest: kg(last.kg), change };
}

/** How many notifications are not read. */
export function unreadCount(notifications: { read: boolean }[]): number {
  return notifications.filter((notification) => !notification.read).length;
}
