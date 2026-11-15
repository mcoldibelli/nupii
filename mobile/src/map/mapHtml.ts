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
  /**
   * The position of the person, from the device (ADR 0025, #306). The map
   * starts there, with a mark. The map page does not ask for the position:
   * the web blocks it in the iframe of the map.
   */
  here?: MapPoint | null;
};

/** The center of the map when there is no marker: the center of São Paulo. */
export const DEFAULT_CENTER: MapPoint = { latitude: -23.5505, longitude: -46.6333 };

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";
// SHA-256 of the files of Leaflet 1.9.4: the browser refuses another file.
const LEAFLET_JS_HASH = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
const LEAFLET_CSS_HASH = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
/** SHA-256 of MAP_SCRIPT, in the script-src of the CSP of app.nupii.com.br (deploy/Caddyfile.nupii-self). */
export const MAP_SCRIPT_HASH = "sha256-VVkWnEfZKbTOafVGdg04fyFk6+l4Yu39aD4Pn1+M3i8=";

/** Returns the HTML of the map page. */
export function mapHtml({ markers, pickable = false, here = null }: MapOptions): string {
  const start = here ?? markers[0] ?? DEFAULT_CENTER;
  const config = JSON.stringify({
    center: [start.latitude, start.longitude],
    here: here ? [here.latitude, here.longitude] : null,
    markers,
    pickable,
  })
    // A "<" in a text could close the script of the page.
    .replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="${LEAFLET_CSS_HASH}" crossorigin="">
<script src="${LEAFLET}/leaflet.js" integrity="${LEAFLET_JS_HASH}" crossorigin=""></script>
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div><script type="application/json" id="config">${config}</script><script>${MAP_SCRIPT}</script></body></html>`;
}

/**
 * The script of the map page. It does not change with the markers, which come
 * in the JSON block: the CSP of the web allows it by its hash (#270). The srcdoc
 * iframe of the web uses the CSP of the page.
 */
const MAP_SCRIPT = `
var config = JSON.parse(document.getElementById("config").textContent);
function send(message) {
  var text = JSON.stringify(message);
  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(text); } else { window.parent.postMessage(text, "*"); }
}
var map = L.map("map").setView(config.center, config.here ? 14 : 15);
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
if (config.here) {
  L.circleMarker(config.here, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 })
    .addTo(map).bindPopup("Você está aqui");
} else if (points.length > 1) {
  map.fitBounds(points, { padding: [32, 32], maxZoom: 16 });
}
var picked = null;
if (config.pickable) {
  map.on("click", function (e) {
    if (picked) { picked.setLatLng(e.latlng); } else { picked = L.marker(e.latlng).addTo(map); }
    send({ type: "pick", latitude: e.latlng.lat, longitude: e.latlng.lng });
  });
}
`;

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
