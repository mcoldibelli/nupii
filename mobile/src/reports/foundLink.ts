/**
 * Returns the address of the detail of a found report with its code. Who
 * keeps the address resolves the report later (RN-69). The code is in the
 * fragment: the browser does not send it to a server, so it is not in the
 * logs of the web host.
 */
export function foundReportLink(origin: string, reportId: string, code: string): string {
  return `${origin}/reports/${reportId}#code=${encodeURIComponent(code)}`;
}

/** Reads the code of the fragment of the address, or undefined. */
export function codeFromHash(hash: string): string | undefined {
  const code = new URLSearchParams(hash.replace(/^#/, "")).get("code");
  return code ? code : undefined;
}
