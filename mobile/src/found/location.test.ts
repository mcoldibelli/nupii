import { currentLocation } from "./location";

/** A geolocation of a browser that answers with the position, or with an error. */
function geolocationThatGives(position: { latitude: number; longitude: number } | null): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if (position === null) {
        failure?.({ code: 1, message: "denied" } as GeolocationPositionError);
      } else {
        success({ coords: position } as GeolocationPosition);
      }
    },
  } as Geolocation;
}

describe("currentLocation", () => {
  it("RN-61: gives the latitude and the longitude of the device", async () => {
    const geolocation = geolocationThatGives({ latitude: -23.55, longitude: -46.63 });

    expect(await currentLocation(geolocation)).toEqual({ latitude: -23.55, longitude: -46.63 });
  });

  it("gives null when the visitor does not allow the position", async () => {
    expect(await currentLocation(geolocationThatGives(null))).toBeNull();
  });

  it("gives null when the device has no geolocation", async () => {
    expect(await currentLocation(undefined)).toBeNull();
  });
});
