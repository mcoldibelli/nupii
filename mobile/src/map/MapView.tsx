import { useMemo } from "react";
import { Linking, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { mapHtml, mapNavigation, parsePick, type MapMarker, type MapPoint } from "./mapHtml";

export type MapViewProps = {
  markers: MapMarker[];
  /** When set, the person chooses a point with a tap. */
  onPick?: (point: MapPoint) => void;
  /** The position of the person: the map starts there (#306). */
  here?: MapPoint | null;
  style?: StyleProp<ViewStyle>;
};

/** The map of ADR 0023 in the app: the map page in a WebView. */
export function MapView({ markers, onPick, here = null, style }: MapViewProps) {
  const key = JSON.stringify([markers, here]);
  const pickable = onPick !== undefined;
  // key has the markers and the position: the page is made again only when they change.
  const html = useMemo(() => mapHtml({ markers, pickable, here }), [key, pickable]);
  return (
    <WebView
      testID="map"
      originWhitelist={["about:blank"]}
      source={{ html }}
      onShouldStartLoadWithRequest={({ url }) => {
        const action = mapNavigation(url);
        if (action === "browser") {
          void Linking.openURL(url);
        }
        return action === "allow";
      }}
      style={style}
      onMessage={(event) => {
        const point = parsePick(event.nativeEvent.data);
        if (point !== null && onPick) {
          onPick(point);
        }
      }}
    />
  );
}
