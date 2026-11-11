import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { mapHtml, parsePick, type MapMarker, type MapPoint } from "./mapHtml";

export type MapViewProps = {
  markers: MapMarker[];
  /** When set, the person chooses a point with a tap. */
  onPick?: (point: MapPoint) => void;
  style?: StyleProp<ViewStyle>;
};

/** The map of ADR 0023 in the app: the map page in a WebView. */
export function MapView({ markers, onPick, style }: MapViewProps) {
  const key = JSON.stringify(markers);
  const pickable = onPick !== undefined;
  // key has the markers: the page is made again only when they change.
  const html = useMemo(() => mapHtml({ markers, pickable }), [key, pickable]);
  return (
    <WebView
      testID="map"
      originWhitelist={["*"]}
      source={{ html }}
      geolocationEnabled
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
