// The map of ADR 0023: a page with Leaflet and the tiles of OpenStreetMap.
// The app shows the page in a WebView, and the web in an iframe.

/** A point on the map, in degrees. */
export type MapPoint = { latitude: number; longitude: number };

/** A marker: the point of the report, a sighting, or the point that the person chose. */
export type MapMarker = MapPoint & { label: string; kind: "main" | "sighting" };

export type MapOptions = {
  markers: MapMarker[];
  /** The person chooses a point with a tap. The page sends it as a message. */
  pickable?: boolean;
};

/** The center of the map when there is no marker: the center of São Paulo. */
export const DEFAULT_CENTER: MapPoint = { latitude: -23.5505, longitude: -46.6333 };

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";
// SHA-256 of the files of Leaflet 1.9.4: the browser refuses another file.
const LEAFLET_JS_HASH = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
const LEAFLET_CSS_HASH = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";

/** Returns the HTML of the map page. */
export function mapHtml({ markers, pickable = false }: MapOptions): string {
  const first = markers[0] ?? DEFAULT_CENTER;
  const config = JSON.stringify({
    center: [first.latitude, first.longitude],
    markers,
    pickable,
    // With no marker, the page starts at the position of the device.
    locate: pickable && markers.length === 0,
  })
    // A "<" in a text could close the script of the page.
    .replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="${LEAFLET_CSS_HASH}" crossorigin="">
<script src="${LEAFLET}/leaflet.js" integrity="${LEAFLET_JS_HASH}" crossorigin=""></script>
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div><script>
var config = ${config};
function send(message) {
  var text = JSON.stringify(message);
  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(text); } else { window.parent.postMessage(text, "*"); }
}
var map = L.map("map").setView(config.center, 15);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);
var points = config.markers.map(function (m) {
  var options = m.kind === "main" ? {} : { radius: 8, color: "#b26a00" };
  var marker = m.kind === "main" ? L.marker([m.latitude, m.longitude]) : L.circleMarker([m.latitude, m.longitude], options);
  marker.addTo(map).bindPopup(document.createTextNode(m.label));
  return [m.latitude, m.longitude];
});
if (points.length > 1) { map.fitBounds(points, { padding: [32, 32], maxZoom: 16 }); }
if (config.locate && navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function (p) { map.setView([p.coords.latitude, p.coords.longitude], 16); });
}
var picked = null;
if (config.pickable) {
  map.on("click", function (e) {
    if (picked) { picked.setLatLng(e.latlng); } else { picked = L.marker(e.latlng).addTo(map); }
    send({ type: "pick", latitude: e.latlng.lat, longitude: e.latlng.lng });
  });
}
</script></body></html>`;
}

/** Reads the message of the page. Returns the chosen point, or null for another message. */
export function parsePick(message: string): MapPoint | null {
  try {
    const data: unknown = JSON.parse(message);
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const { type, latitude, longitude } = data as Record<string, unknown>;
    if (type !== "pick" || typeof latitude !== "number" || typeof longitude !== "number") {
      return null;
    }
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/**
 * What the WebView does with a navigation of the map page (#246). The page
 * itself loads as about:blank and stays. A link of the page, as the Leaflet
 * link of the attribution, opens in the browser of the device: another site
 * in the WebView would get the message bridge of the map. Any other address
 * is blocked.
 */
export function mapNavigation(url: string): "allow" | "browser" | "block" {
  if (url === "about:blank") {
    return "allow";
  }
  return /^https?:\/\//.test(url) ? "browser" : "block";
}
