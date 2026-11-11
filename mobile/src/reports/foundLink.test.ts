import { foundReportLink } from "./foundLink";

describe("foundReportLink", () => {
  it("RN-69: gives the address of the detail with the code", () => {
    expect(foundReportLink("https://nupii.test", "id-1", "a-b_c")).toBe("https://nupii.test/reports/id-1?code=a-b_c");
  });
});
