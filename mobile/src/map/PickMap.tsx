import type { StyleProp, ViewStyle } from "react-native";

import { useDevicePosition } from "../alerts/deviceLocation";
import type { MapPoint } from "./mapHtml";
import { MapView } from "./MapView";

/**
 * The map where the person chooses a point (lost report, sighting, found
 * dog). It starts at the position of the device (#306); the position is
 * asked only when this map is on the screen.
 */
export function PickMap({ onPick, style }: { onPick: (point: MapPoint) => void; style?: StyleProp<ViewStyle> }) {
  const here = useDevicePosition();
  return <MapView markers={[]} onPick={onPick} here={here} style={style} />;
}
