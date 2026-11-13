import { MAX_PHOTO_SIDE, shrinkSize } from "./photoSize";

describe("shrinkSize (#254)", () => {
  it("limits the larger side of a camera photo", () => {
    expect(shrinkSize(4000, 3000)).toEqual({ width: MAX_PHOTO_SIDE });
    expect(shrinkSize(3000, 4000)).toEqual({ height: MAX_PHOTO_SIDE });
  });

  it("keeps a photo that is already small", () => {
    expect(shrinkSize(MAX_PHOTO_SIDE, 900)).toBeNull();
    expect(shrinkSize(800, 600)).toBeNull();
  });
});
