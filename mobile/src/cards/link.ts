/**
 * Returns the address of the health card of a share link. The token is in
 * the fragment: the browser does not send it to a server, so it is not in
 * the logs of the web host (ADR 0027).
 */
export function cardLink(webUrl: string, token: string): string {
  return `${webUrl.replace(/\/$/, "")}/card#token=${encodeURIComponent(token)}`;
}

/** Reads the token of the fragment of the address, or undefined. */
export function tokenFromHash(hash: string): string | undefined {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return token ? token : undefined;
}
