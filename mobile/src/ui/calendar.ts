import { parseDate } from "../pets/form";

/** A day of the calendar; month goes from 0 (January) to 11. */
export type Day = { year: number; month: number; day: number };

export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** The cells of a month, by week from Sunday: null before day 1 and after the last day. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/** The text of a day in the forms (DD/MM/AAAA). */
export function dayText({ year, month, day }: Day): string {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

/** The day of a text DD/MM/AAAA, or null when the text is not a real date. */
export function parseDay(text: string): Day | null {
  const date = parseDate(text.trim());
  if (date === null) {
    return null;
  }
  const value = new Date(date.time);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth(), day: value.getUTCDate() };
}

/** The number of a day, to compare two days. */
export const dayNumber = ({ year, month, day }: Day) => Date.UTC(year, month, day);
