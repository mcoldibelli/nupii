// The only file that imports the location of the device (ADR 0025).
import * as Location from "expo-location";
import { useEffect, useState } from "react";

import type { Location as Point } from "../api/alerts";

/** Asks the person for the location while the app is open. */
export async function locationAllowed(): Promise<boolean> {
  const permission = await Location.requestForegroundPermissionsAsync();
  return permission.granted;
}

/** Gives the position of the device, from the GPS: the nearby alert needs a precise point. */
export async function devicePosition(): Promise<Point> {
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

/**
 * The position of the device for a map (#306), or null without the
 * permission or with no answer of the GPS: the map then starts at its default.
 */
export function useDevicePosition(): Point | null {
  const [position, setPosition] = useState<Point | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        if (await locationAllowed()) {
          setPosition(await devicePosition());
        }
      } catch {
        setPosition(null);
      }
    })();
  }, []);
  return position;
}
