import type { UpcomingCare } from "../api/health";

const DAY = 24 * 60 * 60 * 1000;

/** "hoje", "amanhã", "em 5 dias" or "atrasado há 3 dias", from the due date (RN-81). */
export function careWhen(dueDate: string, now: Date = new Date()): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((Date.UTC(year, month - 1, day) - today) / DAY);
  return days === 0 ? "hoje" : days === 1 ? "amanhã" : days > 1 ? `em ${days} dias` : `atrasado há ${-days} ${days === -1 ? "dia" : "dias"}`;
}

/** The text of an upcoming care, with the days left or late (RN-81). */
export function careText(care: UpcomingCare, now: Date = new Date()): string {
  return `${care.petName}: ${care.title}, ${careWhen(care.dueDate, now)}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** The month and the day of a due date, for the date tile of the home (RN-81). */
export function dateTile(dueDate: string): { month: string; day: string } {
  const [, month, day] = dueDate.split("-").map(Number);
  return { month: MONTHS[month - 1], day: String(day) };
}
