import { MAX_NOSE_PHOTO_SIDE, MAX_PHOTO_SIDE, shrinkSize } from "./photoSize";

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

describe("shrinkSize of a nose photo (#298)", () => {
  it("limits a phone photo of the face to 3000 px, which keeps the nose crop above 224 px", () => {
    expect(MAX_NOSE_PHOTO_SIDE).toBe(3000);
    expect(shrinkSize(8064, 6048, MAX_NOSE_PHOTO_SIDE)).toEqual({ width: 3000 });
    expect(shrinkSize(3000, 4000, MAX_NOSE_PHOTO_SIDE)).toEqual({ height: 3000 });
    expect(shrinkSize(2000, 1500, MAX_NOSE_PHOTO_SIDE)).toBeNull();
  });
});
