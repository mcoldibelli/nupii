import type { UpcomingCare } from "../api/health";

const DAY = 24 * 60 * 60 * 1000;

/** The text of an upcoming care, with the days left or late (RN-81). */
export function careText(care: UpcomingCare, now: Date = new Date()): string {
  const [year, month, day] = care.dueDate.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((Date.UTC(year, month - 1, day) - today) / DAY);
  const when =
    days === 0 ? "hoje" : days === 1 ? "amanhã" : days > 1 ? `em ${days} dias` : `atrasado há ${-days} ${days === -1 ? "dia" : "dias"}`;
  return `${care.petName}: ${care.title}, ${when}`;
}
