import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

import { mapHtml, parsePick } from "./mapHtml";
import type { MapViewProps } from "./MapView";

/** The map of ADR 0023 on the web: the map page in an iframe. */
export function MapView({ markers, onPick, style }: MapViewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const key = JSON.stringify(markers);
  const pickable = onPick !== undefined;
  // key has the markers: the page is made again only when they change.
  const html = useMemo(() => mapHtml({ markers, pickable }), [key, pickable]);

  useEffect(() => {
    if (!onPick) {
      return;
    }
    const listener = (event: MessageEvent) => {
      // Only the messages of this map, and not of another frame.
      if (event.source !== frame.current?.contentWindow || typeof event.data !== "string") {
        return;
      }
      const point = parsePick(event.data);
      if (point !== null) {
        onPick(point);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onPick]);

  return (
    <View style={style}>
      {/* sandbox: the scripts of the map run in an origin of their own. */}
      <iframe ref={frame} title="Mapa" srcDoc={html} sandbox="allow-scripts" style={{ border: 0, height: "100%", width: "100%" }} />
    </View>
  );
}
