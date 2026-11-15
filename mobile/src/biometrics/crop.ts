// The crop of a photo of the nose on the web (Focinho-Web artboard, #272,
// ADR 0034). The zoom and the square change only the view: the file is the
// square in pixels of the photo.

export type Size = { width: number; height: number };
/** The square on the stage, in pixels of the stage. */
export type Square = { x: number; y: number; size: number };
/** How the photo is drawn on the stage. */
export type View = { scale: number; left: number; top: number };
export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * The crop is the face (ADR 0036): the service finds the nose in it and needs
 * a nose crop of 224 px. In the face crops of #292 the nose crop was from 24%
 * to 37% of the side: 224 / 0.24 is about 930, so the face crop has at least 960 px.
 */
export const MIN_CROP_SIDE = 960;
/** The detector reads at most 640 px, so 1280 px keeps all it uses, and a PNG of that size stays under the 8 MB of RN-59. */
export const MAX_CROP_SIDE = 1280;
/** The smallest square on the stage, to keep the corners usable. */
const MIN_SQUARE = 40;

/** The photo fits the stage at zoom 1, and the zoom scales it around the center. */
export function viewOf(stage: Size, image: Size, zoom: number): View {
  const scale = Math.min(stage.width / image.width, stage.height / image.height) * zoom;
  return { scale, left: (stage.width - image.width * scale) / 2, top: (stage.height - image.height * scale) / 2 };
}

/** The square in pixels of the photo, kept inside the photo. */
export function sourceRect(square: Square, view: View, image: Size): { x: number; y: number; side: number } {
  const side = Math.round(Math.min(square.size / view.scale, image.width, image.height));
  const x = Math.round((square.x - view.left) / view.scale);
  const y = Math.round((square.y - view.top) / view.scale);
  return { x: clamp(x, 0, image.width - side), y: clamp(y, 0, image.height - side), side };
}

/** The side of the file: the crop itself, or 1280 px for a larger crop. */
export function outputSide(side: number): number {
  return Math.min(side, MAX_CROP_SIDE);
}

/** Moves the square by dx and dy, inside the stage. */
export function moveSquare(square: Square, dx: number, dy: number, stage: Size): Square {
  return { size: square.size, x: clamp(square.x + dx, 0, stage.width - square.size), y: clamp(square.y + dy, 0, stage.height - square.size) };
}

/** Resizes the square from a corner; the opposite corner stays, and the square stays inside the stage. */
export function resizeSquare(square: Square, corner: Corner, dx: number, dy: number, stage: Size): Square {
  const right = square.x + square.size;
  const bottom = square.y + square.size;
  const growsRight = corner === "tr" || corner === "br";
  const growsDown = corner === "bl" || corner === "br";
  const delta = Math.max(growsRight ? dx : -dx, growsDown ? dy : -dy);
  const room = Math.min(growsRight ? stage.width - square.x : right, growsDown ? stage.height - square.y : bottom);
  const size = clamp(square.size + delta, MIN_SQUARE, room);
  return { size, x: growsRight ? square.x : right - size, y: growsDown ? square.y : bottom - size };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
