import type { UpcomingCare } from "../api/health";
import type { Pet } from "../api/pets";
import { careWhen } from "../health/care";
import { sexLabels, sizeLabels } from "./labels";

export type Chip = { label: string; tone: "ok" | "warn" | "late" };

const DAY = 24 * 60 * 60 * 1000;
/** A care closer than this many days shows as a warning. */
const WARN_DAYS = 30;

/** The health chips of the Pet artboard: each next care of the pet (RN-81) and the castration. */
export function healthChips(pet: Pick<Pet, "neutered">, care: Pick<UpcomingCare, "title" | "dueDate">[], now: Date = new Date()): Chip[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const chips = care.map(({ title, dueDate }): Chip => {
    const [year, month, day] = dueDate.split("-").map(Number);
    const days = Math.round((Date.UTC(year, month - 1, day) - today) / DAY);
    if (days < 0) {
      return { label: `${title} ${careWhen(dueDate, now)}`, tone: "late" };
    }
    return days <= WARN_DAYS ? { label: `${title} vence ${careWhen(dueDate, now)}`, tone: "warn" } : { label: `${title} em dia`, tone: "ok" };
  });
  if (pet.neutered) {
    chips.push({ label: "Castrado", tone: "ok" });
  }
  return chips;
}

/** The facts row of the Pet artboard: sex, weight and size, only when the pet has them. */
export function petFacts(pet: Pick<Pet, "sex" | "weightKg" | "size">): { icon: "sex" | "weight" | "size"; label: string }[] {
  const facts: { icon: "sex" | "weight" | "size"; label: string }[] = [];
  if (pet.sex && pet.sex !== "unknown") {
    facts.push({ icon: "sex", label: sexLabels[pet.sex] });
  }
  if (pet.weightKg !== undefined) {
    facts.push({ icon: "weight", label: `${String(pet.weightKg).replace(".", ",")} kg` });
  }
  if (pet.size) {
    facts.push({ icon: "size", label: `Porte ${sizeLabels[pet.size].toLowerCase()}` });
  }
  return facts;
}
