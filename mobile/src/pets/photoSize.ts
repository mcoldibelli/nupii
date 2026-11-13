/**
 * The larger side of a profile photo or of a found-dog photo, in pixels
 * (#254). The largest place that shows one is about 1200 px wide (the
 * full width of a phone at 3x), so 1600 px keeps the detail and drops the
 * megabytes of a camera photo. A photo of a nose never goes through this.
 */
export const MAX_PHOTO_SIDE = 1600;

/** The resize of a photo with this size, or null when it is already small. The other side follows the proportion. */
export function shrinkSize(width: number, height: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_PHOTO_SIDE) {
    return null;
  }
  return width >= height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE };
}
