import { codeFromHash, foundReportLink } from "./foundLink";

describe("foundReportLink", () => {
  it("RN-69: puts the code in the fragment, which the browser does not send to a server", () => {
    expect(foundReportLink("https://nupii.test", "id-1", "a-b_c")).toBe("https://nupii.test/reports/id-1#code=a-b_c");
  });
});

describe("codeFromHash", () => {
  it("reads the code of the fragment", () => {
    expect(codeFromHash("#code=a-b_c")).toBe("a-b_c");
  });

  it.each(["", "#", "#other=1", "#code="])("gives undefined for %p", (hash) => {
    expect(codeFromHash(hash)).toBeUndefined();
  });
});
