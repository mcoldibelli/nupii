import { failureMessage } from "../api/http";
import type { Report, ReportDetails } from "../api/reports";
import { parseDate } from "../pets/form";

export type DetailsForm = { place: string; description: string };

export type DetailsResult = { ok: true; details: ReportDetails } | { ok: false; message: string };

/** RN-70: tamanhos máximos dos textos de uma ocorrência, em caracteres. */
export const REPORT_LIMITS = { place: 200, description: 1000 } as const;

/** Applies RN-70 and converts the texts of the form to the texts of the API. */
export function toDetails(form: DetailsForm): DetailsResult {
  const place = form.place.trim();
  // The API counts characters, and the length of a string counts UTF-16 units.
  if ([...place].length > REPORT_LIMITS.place) {
    return { ok: false, message: "O nome do local pode ter no máximo 200 caracteres." };
  }
  const description = form.description.trim();
  if ([...description].length > REPORT_LIMITS.description) {
    return { ok: false, message: "O recado pode ter no máximo 1.000 caracteres." };
  }
  const details: ReportDetails = {};
  if (place !== "") {
    details.place = place;
  }
  if (description !== "") {
    details.description = description;
  }
  return { ok: true, details };
}

/** Returns the open lost report of the pet, among the reports of the owner (RN-68). */
export function openLostReportOf(reports: Report[], petId: string): Report | undefined {
  return reports.find((report) => report.type === "lost" && report.status === "open" && report.petId === petId);
}

/** Texts for the failures of the report operations, by error code. */
const failures: Record<string, string> = {
  lost_report_open: "Este pet já tem um desaparecimento aberto.",
  report_not_open: "Esta ocorrência já foi resolvida.",
  report_not_found: "Esta ocorrência não existe mais.",
  rate_limited: "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.",
};

/** Message for the user for a failure of a report operation. */
export function reportFailureMessage(result: { ok: false; code: string }): string {
  return failures[result.code] ?? failureMessage(result);
}

/** The title of a report on the board and on the detail. */
export function reportTitle(report: Report): string {
  const title = report.type === "lost" ? `Perdido: ${report.petName ?? "pet"}` : "Achado";
  return report.status === "resolved" ? `${title} (resolvido)` : title;
}

export type OccurredAtResult = { ok: true; value?: string } | { ok: false; message: string };

/**
 * Converts the date of the form (DD/MM/AAAA) to the time of the lost report.
 * The date of today, or no date, has no value: the API uses the time of the
 * registration. A date before today is the middle of that day, in UTC.
 *
 * RN-71: a data do desaparecimento é opcional e não é futura.
 */
export function toOccurredAt(text: string, now: Date = new Date()): OccurredAtResult {
  if (text.trim() === "") {
    return { ok: true };
  }
  const date = parseDate(text.trim());
  if (date === null) {
    return { ok: false, message: "Informe a data no formato DD/MM/AAAA." };
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.time > today) {
    return { ok: false, message: "A data do desaparecimento não pode ser futura." };
  }
  if (date.time === today) {
    return { ok: true };
  }
  return { ok: true, value: new Date(date.time + 12 * 60 * 60 * 1000).toISOString() };
}
