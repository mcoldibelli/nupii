import qrcode from "qrcode-generator";

/** A sequence of modules of the same color in a row of a QR code. */
export type Run = { dark: boolean; length: number };

/**
 * Returns the rows of the QR code of text, each row as runs of modules of
 * the same color. A screen draws one view for each run (ADR 0027). The
 * correction level M reads a code with up to 15% of damage.
 */
export function qrRuns(text: string): Run[][] {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  const rows: Run[][] = [];
  for (let row = 0; row < size; row++) {
    const runs: Run[] = [];
    for (let col = 0; col < size; col++) {
      const dark = code.isDark(row, col);
      const last = runs[runs.length - 1];
      if (last !== undefined && last.dark === dark) {
        last.length++;
      } else {
        runs.push({ dark, length: 1 });
      }
    }
    rows.push(runs);
  }
  return rows;
}
