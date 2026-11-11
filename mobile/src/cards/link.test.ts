import { cardLink, tokenFromHash } from "./link";

describe("card link", () => {
  it("RN-39: puts the token in the fragment, which the browser does not send", () => {
    expect(cardLink("https://web.test", "a-b_c")).toBe("https://web.test/card#token=a-b_c");
    expect(cardLink("https://web.test/", "x")).toBe("https://web.test/card#token=x");
  });

  it("reads the token of the fragment", () => {
    expect(tokenFromHash("#token=a-b_c")).toBe("a-b_c");
    expect(tokenFromHash("")).toBeUndefined();
    expect(tokenFromHash("#code=x")).toBeUndefined();
  });
});
