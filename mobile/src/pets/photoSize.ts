/**
 * The larger side of a profile photo or of a found-dog photo, in pixels
 * (#254). The largest place that shows one is about 1200 px wide (the
 * full width of a phone at 3x), so 1600 px keeps the detail and drops the
 * megabytes of a camera photo. A photo of a nose uses MAX_NOSE_PHOTO_SIDE.
 */
export const MAX_PHOTO_SIDE = 1600;

/**
 * The larger side of a photo of the face for the nose (#298, ADR 0036). In the
 * face photos of #292 the nose box was 12% to 21% of the short side, so at
 * 3000 px the crop of the nose has more than 400 px, and the JPEG stays far
 * under the 8 MB of RN-59.
 */
export const MAX_NOSE_PHOTO_SIDE = 3000;

/** The resize of a photo with this size, or null when it is already small. The other side follows the proportion. */
export function shrinkSize(width: number, height: number, maxSide: number = MAX_PHOTO_SIDE): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= maxSide) {
    return null;
  }
  return width >= height ? { width: maxSide } : { height: maxSide };
}
