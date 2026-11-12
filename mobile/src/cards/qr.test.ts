import { qrRuns } from "./qr";

describe("qrRuns", () => {
  const link = "http://localhost:8097/card#token=" + "a".repeat(43);

  it("RF-30: draws a square QR code with the finder pattern in the top left corner", () => {
    const rows = qrRuns(link);
    const size = rows[0].reduce((total, run) => total + run.length, 0);
    // A QR code of version v has 17 + 4v modules on each side.
    expect((size - 17) % 4).toBe(0);
    expect(rows).toHaveLength(size);
    for (const row of rows) {
      expect(row.reduce((total, run) => total + run.length, 0)).toBe(size);
    }
    // The finder pattern: a dark line of 7 modules, then dark, 5 light, dark.
    expect(rows[0][0]).toEqual({ dark: true, length: 7 });
    expect(rows[1].slice(0, 3)).toEqual([
      { dark: true, length: 1 },
      { dark: false, length: 5 },
      { dark: true, length: 1 },
    ]);
  });
});
