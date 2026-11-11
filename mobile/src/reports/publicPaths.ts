/**
 * Tells if a path of the web is a public page: a visitor opens it with no
 * account (RNF-04). The page of a new lost report needs the owner.
 */
export function isPublicPath(path: string): boolean {
  if (path === "/found" || path === "/reports") {
    return true;
  }
  return path.startsWith("/reports/") && path !== "/reports/lost";
}
