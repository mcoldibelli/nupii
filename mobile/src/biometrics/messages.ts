import { failureMessage } from "../api/http";

/** Texts for the refusals of the photo of a nose, by error code. */
const refusals: Record<string, string> = {
  image_low_quality: "A foto ficou sem nitidez. Tire outra foto, com mais luz e com o aparelho parado.",
  image_framing: "Não achamos um focinho na foto. Chegue mais perto, com o focinho no centro.",
  species_not_supported: "Só um cachorro tem cadastro de focinho.",
  unavailable: "O serviço de identificação não respondeu. Tente de novo em alguns minutos.",
  // RN-59: a foto do focinho é uma imagem JPEG, PNG ou WebP de até 8 MB.
  invalid_request: "A foto precisa ser uma imagem JPEG, PNG ou WebP de até 8 MB.",
};

/** Message for the user for a failure of the registration of a nose. */
export function noseprintFailureMessage(result: { ok: false; code: string }): string {
  return refusals[result.code] ?? failureMessage(result);
}

/** Shows the quality of a photo, from 0 to 1, as a percentage. */
export function qualityLabel(quality: number): string {
  return `${Math.round(quality * 100)}%`;
}

/** Shows an instant of the API as DD/MM/AAAA HH:MM, in the time zone of the device. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/**
 * Returns the address that opens a point in the map app of the device. The
 * coordinates do not go to a web site of a third party.
 */
export function mapUrl(platform: string, latitude: number, longitude: number): string {
  const point = `${latitude},${longitude}`;
  return platform === "ios" ? `maps:?q=${point}` : `geo:${point}?q=${point}`;
}

/** Returns the address that opens the phone app with the number. */
export function phoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}
