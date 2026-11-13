import { BREEDS, SRD, searchBreeds } from "./breeds";

test("the list starts with SRD and has no repeated breed", () => {
  expect(BREEDS[0]).toBe(SRD);
  expect(new Set(BREEDS).size).toBe(BREEDS.length);
});

test("the search ignores accents and case, and keeps SRD at the top", () => {
  expect(searchBreeds("pastor")).toEqual([SRD, "Pastor Alemão", "Pastor Australiano", "Pastor Belga Malinois", "Pastor de Shetland"]);
  expect(searchBreeds("SHIH")).toEqual([SRD, "Shih Tzu"]);
  expect(searchBreeds("buldogue frances")).toEqual([SRD, "Buldogue Francês"]);
  expect(searchBreeds("")).toEqual(BREEDS);
});
