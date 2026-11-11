import { formatDateTime, noseprintFailureMessage, qualityLabel } from "./messages";

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
