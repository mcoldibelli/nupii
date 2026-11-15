/**
 * Tells if a path of the web is a public page: a visitor opens it with no
 * account (RNF-04). The page of a new lost report needs the owner. The
 * page of the health card (RF-31), the terms of use and the landing page of
 * the web are public too, and the page of the link of the reset e-mail (RF-05).
 */
export function isPublicPath(path: string): boolean {
  if (path === "/found" || path === "/reports" || path === "/card" || path === "/terms" || path === "/landing" || path === "/reset-password") {
    return true;
  }
  return path.startsWith("/reports/") && path !== "/reports/lost";
}
