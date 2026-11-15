import type { HealthEvent, HealthEventType, UpcomingCare } from "../api/health";
import { dateText } from "./form";

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** A care closer than this many days shows in orange. */
const SOON_DAYS = 7;

/** The tabs of the Saude-Mobile artboard, one per type of event. The canvas has no tab for the notes. */
export const tabs: { type: HealthEventType; label: string; add: string }[] = [
  { type: "vaccine", label: "Vacinas", add: "Adicionar vacina" },
  { type: "medication", label: "Remédios", add: "Adicionar remédio" },
  { type: "consultation", label: "Consultas", add: "Adicionar consulta" },
  { type: "exam", label: "Exames", add: "Adicionar exame" },
  { type: "note", label: "Anotações", add: "Adicionar anotação" },
];

export type Status = { label: string; tone: "ok" | "info" | "brand" | "late" };

function daysUntil(dueDate: string, now: Date): number {
  const [year, month, day] = dueDate.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY);
}

/** The oldest care with a due date before today (RN-81), for the late banner. */
export function lateCare(care: UpcomingCare[], now: Date = new Date()): { care: UpcomingCare; days: number } | null {
  const late = care.filter((item) => daysUntil(item.dueDate, now) < 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return late === undefined ? null : { care: late, days: -daysUntil(late.dueDate, now) };
}

/** The pill of an item of the list: from its next care (RN-81), or from its type. */
export function itemStatus(event: HealthEvent, care: UpcomingCare[], now: Date = new Date()): Status {
  const next = care.find((item) => item.eventId === event.id);
  if (next) {
    const days = daysUntil(next.dueDate, now);
    if (days < 0) {
      return { label: "Atrasado", tone: "late" };
    }
    if (days <= SOON_DAYS) {
      return { label: days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`, tone: "brand" };
    }
    const [year, month, day] = next.dueDate.split("-");
    return { label: event.type === "vaccine" ? `${MONTHS[Number(month) - 1]}/${year.slice(2)}` : `${day}/${month}`, tone: "info" };
  }
  switch (event.type) {
    case "vaccine":
      return { label: "Aplicada", tone: "ok" };
    case "medication":
      return event.inUse === false ? { label: "Concluído", tone: "ok" } : { label: "Em uso", tone: "info" };
    case "consultation":
      return { label: "Feita", tone: "ok" };
    case "exam":
      return { label: "Feito", tone: "ok" };
    case "note":
      return { label: event.weightKg === undefined ? "Anotado" : `${String(event.weightKg).replace(".", ",")} kg`, tone: "info" };
  }
}

/** The second line of an item: the date and who or what (Saude-Mobile artboard). */
export function itemLine(event: HealthEvent): string {
  const parts = [dateText(event.date), event.vet ?? event.clinic ?? event.lab, event.dosage, event.frequency];
  return parts.filter((part) => part !== undefined && part !== "").join(" · ");
}

/** The second line of a row of the wide table: what the columns of date and professional do not show (Saude-Web artboard). */
export function itemDetail(event: HealthEvent): string {
  const parts = [event.dose, event.batch && `lote ${event.batch}`, event.dosage, event.frequency, event.reason, event.diagnosis, event.result];
  return parts.filter((part) => part !== undefined && part !== "").join(" · ");
}

/** The care late or due in the next days, oldest first ("Próximos 60 dias" of the Saude-Web artboard, RN-81). */
export function careWithin(care: UpcomingCare[], days: number, now: Date = new Date()): UpcomingCare[] {
  return care.filter((item) => daysUntil(item.dueDate, now) <= days).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
