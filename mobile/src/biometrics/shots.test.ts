import { allGood, nextSlot, type Shot } from "./shots";

const good: Shot = { uri: "a", state: "good" };
const refused: Shot = { uri: "b", state: "refused", message: "x" };

test("the next slot is the first one without a photo", () => {
  expect(nextSlot([null, null])).toBe(0);
  expect(nextSlot([good, null])).toBe(1);
  expect(nextSlot([null, good])).toBe(0);
  expect(nextSlot([good, refused])).toBeNull();
});

test("the registration needs two photos that passed the check", () => {
  expect(allGood([good, good])).toBe(true);
  expect(allGood([good, refused])).toBe(false);
  expect(allGood([good, null])).toBe(false);
  expect(allGood([{ uri: "c", state: "checking" }, good])).toBe(false);
});
