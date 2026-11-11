/**
 * Returns the address of the detail of a found report with its code. Who
 * keeps the address resolves the report later (RN-69).
 */
export function foundReportLink(origin: string, reportId: string, code: string): string {
  return `${origin}/reports/${reportId}?code=${encodeURIComponent(code)}`;
}
