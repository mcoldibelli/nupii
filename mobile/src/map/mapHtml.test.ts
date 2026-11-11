import { DEFAULT_CENTER, mapHtml, parsePick } from "./mapHtml";

describe("mapHtml", () => {
  it("loads Leaflet 1.9.4 with the hash of the file (ADR 0023)", () => {
    const html = mapHtml({ markers: [] });

    expect(html).toContain('src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"');
    expect(html).toContain('integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="');
    expect(html).toContain('integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="');
  });

  it("shows the attribution of OpenStreetMap", () => {
    expect(mapHtml({ markers: [] })).toContain("OpenStreetMap");
  });

  it("puts the markers and the center in the page as JSON", () => {
    const html = mapHtml({
      markers: [{ latitude: -23.5, longitude: -46.6, label: "Rex", kind: "main" }],
      pickable: true,
    });

    expect(html).toContain('"label":"Rex"');
    expect(html).toContain('"pickable":true');
  });

  it("escapes a text that could close the script of the page", () => {
    const html = mapHtml({ markers: [{ latitude: 0, longitude: 0, label: "</script><b>", kind: "sighting" }] });

    expect(html).not.toContain("</script><b>");
  });

  it("centers on the first marker, or on the default center", () => {
    expect(mapHtml({ markers: [{ latitude: 1, longitude: 2, label: "a", kind: "main" }] })).toContain('"center":[1,2]');
    expect(mapHtml({ markers: [] })).toContain(`"center":[${DEFAULT_CENTER.latitude},${DEFAULT_CENTER.longitude}]`);
  });
});

describe("parsePick", () => {
  it("reads the point that the page sends", () => {
    expect(parsePick('{"type":"pick","latitude":-23.5,"longitude":-46.6}')).toEqual({ latitude: -23.5, longitude: -46.6 });
  });

  it.each(["not json", '{"type":"other"}', '{"type":"pick","latitude":"x","longitude":1}', "null"])(
    "ignores a message that is not a point: %s",
    (message) => {
      expect(parsePick(message)).toBeNull();
    },
  );
});
