import { colors } from "./theme";

/** Contrast ratio of the WCAG 2.2 (relative luminance). */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("theme", () => {
  // Every text color on every background that the components use. Small
  // text needs 4.5:1 (WCAG AA).
  it.each([
    ["ink on background", colors.ink, colors.background],
    ["ink on surface", colors.ink, colors.surface],
    ["secondary text on background", colors.textSecondary, colors.background],
    ["muted text on background", colors.textMuted, colors.background],
    ["muted text on surface", colors.textMuted, colors.surface],
    ["link on background", colors.link, colors.background],
    ["white on the primary button", colors.onPrimary, colors.primary],
    ["orange text on background", colors.primary, colors.background],
    ["white on the dark button", colors.onDark, colors.dark],
    ["danger text on background", colors.dangerText, colors.background],
    ["danger text on the light red", colors.dangerText, colors.dangerSoft],
    ["white on danger", colors.onPrimary, colors.danger],
    ["light text on danger", colors.onDanger, colors.danger],
    ["success on surface", colors.success, colors.surface],
    ["white on the accent", colors.onPrimary, colors.accent],
  ])("%s passes AA", (_, text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("the brand orange is only for icons and shapes: 3:1 for graphics", () => {
    expect(contrast(colors.brand, colors.background)).toBeGreaterThanOrEqual(3);
  });
});
