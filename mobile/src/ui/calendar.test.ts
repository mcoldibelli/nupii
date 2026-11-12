import { dayText, monthGrid, parseDay, type Day } from "./calendar";

test("the grid of a month starts on Sunday, with blanks before day 1", () => {
  // 1 November 2026 is a Sunday; 1 February 2026 is a Sunday too; 1 October 2026 is a Thursday.
  expect(monthGrid(2026, 10).slice(0, 2)).toEqual([1, 2]);
  expect(monthGrid(2026, 9).slice(0, 5)).toEqual([null, null, null, null, 1]);
  expect(monthGrid(2026, 1).filter((day) => day !== null)).toHaveLength(28);
  expect(monthGrid(2024, 1).filter((day) => day !== null)).toHaveLength(29);
  expect(monthGrid(2026, 9).length % 7).toBe(0);
});

test("a day becomes the text of the form, and back", () => {
  const day: Day = { year: 2026, month: 0, day: 5 };
  expect(dayText(day)).toBe("05/01/2026");
  expect(parseDay("05/01/2026")).toEqual(day);
  expect(parseDay("31/02/2026")).toBeNull();
  expect(parseDay("")).toBeNull();
});
