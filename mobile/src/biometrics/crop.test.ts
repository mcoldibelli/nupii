import { MAX_CROP_SIDE, MIN_CROP_SIDE, moveSquare, outputSide, resizeSquare, sourceRect, viewOf } from "./crop";

describe("crop of a nose photo on the web (#272)", () => {
  const stage = { width: 600, height: 300 };
  const image = { width: 1200, height: 600 };

  it("fits the photo in the stage and scales it with the zoom, around the center", () => {
    expect(viewOf(stage, image, 1)).toEqual({ scale: 0.5, left: 0, top: 0 });
    expect(viewOf(stage, image, 2)).toEqual({ scale: 1, left: -300, top: -150 });
  });

  it("gives the square in pixels of the photo", () => {
    // Zoom 1: one pixel of the stage is two pixels of the photo.
    expect(sourceRect({ x: 100, y: 50, size: 100 }, viewOf(stage, image, 1), image)).toEqual({ x: 200, y: 100, side: 200 });
    // Zoom 2: the image starts 300 px to the left of the stage.
    expect(sourceRect({ x: 100, y: 50, size: 100 }, viewOf(stage, image, 2), image)).toEqual({ x: 400, y: 200, side: 100 });
  });

  it("keeps the square inside the photo", () => {
    expect(sourceRect({ x: 550, y: 250, size: 100 }, viewOf(stage, image, 1), image)).toEqual({ x: 1000, y: 400, side: 200 });
  });

  it("sends the crop pixel for pixel up to 1280 px, and above that at 1280 px", () => {
    expect(outputSide(400)).toBe(400);
    expect(outputSide(MAX_CROP_SIDE)).toBe(MAX_CROP_SIDE);
    expect(outputSide(3000)).toBe(MAX_CROP_SIDE);
    expect(MIN_CROP_SIDE).toBe(224);
  });

  it("moves and resizes the square inside the stage, always square", () => {
    expect(moveSquare({ x: 10, y: 10, size: 100 }, 1000, -50, stage)).toEqual({ x: 500, y: 0, size: 100 });
    // Dragging the bottom-right corner keeps the top-left corner.
    expect(resizeSquare({ x: 100, y: 50, size: 100 }, "br", 40, 10, stage)).toEqual({ x: 100, y: 50, size: 140 });
    // Dragging the top-left corner keeps the bottom-right corner.
    expect(resizeSquare({ x: 100, y: 50, size: 100 }, "tl", -20, -20, stage)).toEqual({ x: 80, y: 30, size: 120 });
    // Never smaller than 40 px on the stage, never out of it.
    expect(resizeSquare({ x: 100, y: 50, size: 100 }, "br", -500, -500, stage).size).toBe(40);
    expect(resizeSquare({ x: 100, y: 50, size: 100 }, "br", 900, 900, stage)).toEqual({ x: 100, y: 50, size: 250 });
  });
});
