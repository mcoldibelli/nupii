import { formatDateTime, mapUrl, noseprintFailureMessage, phoneUrl, qualityLabel } from "./messages";

describe("noseprintFailureMessage", () => {
  it.each([
    ["image_low_quality", "A foto ficou sem nitidez. Tire outra foto, com mais luz e com o aparelho parado."],
    ["image_framing", "Não achamos um focinho na foto. Chegue mais perto, com o focinho no centro."],
    ["species_not_supported", "Só um cachorro tem cadastro de focinho."],
    ["unavailable", "O serviço de identificação não respondeu. Tente de novo em alguns minutos."],
    ["invalid_request", "A foto precisa ser uma imagem JPEG, PNG ou WebP de até 8 MB."],
  ])("has a text for %s", (code, text) => {
    expect(noseprintFailureMessage({ ok: false, code })).toBe(text);
  });

  it("uses the text of a failure of the API for another code", () => {
    expect(noseprintFailureMessage({ ok: false, code: "network" })).toBe(
      "Sem conexão com o servidor. Confira a internet e tente de novo.",
    );
  });
});

describe("qualityLabel", () => {
  it("shows the quality as a percentage", () => {
    expect(qualityLabel(0.8731)).toBe("87%");
    expect(qualityLabel(1)).toBe("100%");
  });
});

describe("formatDateTime", () => {
  it("shows the date and the time of the device", () => {
    // 11 November 2026, 15:04, in the time zone of the machine of the test.
    const instant = new Date(2026, 10, 11, 15, 4).toISOString();

    expect(formatDateTime(instant)).toBe("11/11/2026 15:04");
  });
});

describe("mapUrl", () => {
  it("opens the map app of the device, with no web site of a third party", () => {
    expect(mapUrl("android", -23.55, -46.63)).toBe("geo:-23.55,-46.63?q=-23.55,-46.63");
    expect(mapUrl("ios", -23.55, -46.63)).toBe("maps:?q=-23.55,-46.63");
  });
});

describe("phoneUrl", () => {
  it("keeps only the digits and the plus sign", () => {
    expect(phoneUrl("+55 (11) 98888-7777")).toBe("tel:+5511988887777");
  });
});
