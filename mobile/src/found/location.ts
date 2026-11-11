import type { Location } from "../api/found";

/**
 * Asks the browser for the position of the device. Returns null when the
 * device has no geolocation, or the visitor does not allow the position
 * (RN-61: the position is optional).
 */
export function currentLocation(
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
): Promise<Location | null> {
  return new Promise((resolve) => {
    if (!geolocation) {
      resolve(null);
      return;
    }
    geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    );
  });
}
