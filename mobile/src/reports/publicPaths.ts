/**
 * Tells if a path of the web is a public page: a visitor opens it with no
 * account (RNF-04). The page of a new lost report needs the owner. The
 * page of the health card (RF-31) and the terms of use are public too.
 */
export function isPublicPath(path: string): boolean {
  if (path === "/found" || path === "/reports" || path === "/card" || path === "/terms") {
    return true;
  }
  return path.startsWith("/reports/") && path !== "/reports/lost";
}
