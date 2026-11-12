import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { colors } from "./theme";

// The stroke icons of the design canvas (ADR 0030). Only this file imports
// react-native-svg.
const icons = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pin: (
    <>
      <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <Circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  heart: <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
      <Path d="M10 21h4" />
    </>
  ),
  scan: (
    <>
      <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <Ellipse cx="12" cy="12.5" rx="4.5" ry="3.5" />
    </>
  ),
  card: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="3" />
      <Circle cx="9" cy="11" r="2" />
      <Path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M15 10h3M15 13.5h3" />
    </>
  ),
  calendar: (
    <>
      <Rect x="4" y="5" width="16" height="15" rx="3" />
      <Path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  alert: (
    <>
      <Path d="M12 4 2.5 20h19z" />
      <Path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  check: <Path d="M5 12.5l4.5 4.5L19 7" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  chevronRight: <Path d="M9 6l6 6-6 6" />,
  back: <Path d="M15 6l-6 6 6 6" />,
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  mail: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="3" />
      <Path d="m4 7 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <Rect x="5" y="10" width="14" height="10" rx="2.5" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  syringe: <Path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2 2 0 0 1-2.8 0l-1.2-1.2a2 2 0 0 1 0-2.8L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />,
  pill: (
    <>
      <Path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z" />
      <Path d="m8.5 8.5 7 7" />
    </>
  ),
  stethoscope: (
    <>
      <Path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <Path d="M9 13v2a5 5 0 0 0 10 0v-2" />
      <Circle cx="19" cy="11" r="2" />
    </>
  ),
  flask: (
    <>
      <Path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
      <Path d="M7.5 15h9" />
    </>
  ),
} as const;

export type IconName = keyof typeof icons;

/** A stroke icon of the canvas. The icon is decoration: the control around it has the label. */
export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {icons[name]}
    </Svg>
  );
}
