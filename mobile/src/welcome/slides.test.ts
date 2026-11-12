import { slides, welcomeSeen, markWelcomeSeen } from "./slides";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
  };
});

describe("welcome", () => {
  it("has the four slides of the canvas, with the colors of each one", () => {
    expect(slides.map((slide) => slide.title)).toEqual([
      "Todo focinho\né único.",
      "Saúde em dia,\nsem esquecer.",
      "Sumiu? O bairro\nfica sabendo.",
      "Achou um cachorro?\nEscaneie.",
    ]);
    expect(slides.map((slide) => slide.hero)).toEqual(["#F05F0A", "#7A4BEA", "#18161A", "#1F6B3A"]);
  });

  it("shows only on the first open of the app", async () => {
    expect(await welcomeSeen()).toBe(false);
    await markWelcomeSeen();
    expect(await welcomeSeen()).toBe(true);
  });
});
