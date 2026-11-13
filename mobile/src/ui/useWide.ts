import { useWindowDimensions } from "react-native";

/** From this width the screens use the web layout of the canvas (1440 px artboards): sidebar or top header, columns. */
export const WIDE_MIN = 960;

/** True on a wide screen, as the browser of a computer. */
export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN;
}
