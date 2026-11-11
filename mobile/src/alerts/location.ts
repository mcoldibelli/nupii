import type { ApiResult } from "../api/http";
import type { Location } from "../api/alerts";

/** What sendLocation needs: the permission, the position and the API. */
export type LocationSource = {
  /** Asks the person for the location. Returns true when the person allows it. */
  allowed: () => Promise<boolean>;
  /** Gives the position of the device. It throws when there is none. */
  position: () => Promise<Location>;
  /** Sends the position to the API. */
  send: (location: Location) => Promise<ApiResult<void>>;
};

/**
 * Sends the position of the device to the API (RF-22). The nearby alert
 * uses the last position (RN-30, RN-32). The person can say no: then the
 * owner does not get nearby alerts.
 */
export async function sendLocation(source: LocationSource): Promise<"sent" | "denied" | "failed"> {
  if (!(await source.allowed())) {
    return "denied";
  }
  try {
    const result = await source.send(await source.position());
    return result.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
