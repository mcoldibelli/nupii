import { isPublicPath } from "./publicPaths";

describe("isPublicPath", () => {
  it.each([
    ["/found", true],
    ["/reports", true],
    ["/reports/0195f3c8-7a55-7c1e-9d2a-000000000001", true],
    ["/reports/lost", false],
    ["/", false],
    ["/pets/new", false],
    ["/reportsx", false],
    ["/card", true],
    ["/share/0195f3c8-7a55-7c1e-9d2a-000000000001", false],
  ])("%s is public: %s", (path, want) => {
    expect(isPublicPath(path)).toBe(want);
  });
});
