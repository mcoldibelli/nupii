import { Text as NativeText, type TextProps } from "react-native";

import { colors, fonts } from "./theme";

/** The title of a screen: Bricolage Grotesque 800, as in the canvas. */
export function Title({ style, ...props }: TextProps) {
  return <NativeText accessibilityRole="header" style={[{ fontFamily: fonts.title, fontSize: 28, letterSpacing: -0.8, color: colors.ink }, style]} {...props} />;
}

/** The title of a section of a screen. */
export function Heading({ style, ...props }: TextProps) {
  return <NativeText accessibilityRole="header" style={[{ fontFamily: fonts.titleBold, fontSize: 20, letterSpacing: -0.3, color: colors.ink }, style]} {...props} />;
}

/** Running text. */
export function Body({ style, ...props }: TextProps) {
  return <NativeText style={[{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink }, style]} {...props} />;
}

/** Secondary text: dates, descriptions, hints. */
export function Muted({ style, ...props }: TextProps) {
  return <NativeText style={[{ fontFamily: fonts.body, fontSize: 14, color: colors.textMuted }, style]} {...props} />;
}

/** A small bold label above a field or a group. */
export function Label({ style, ...props }: TextProps) {
  return <NativeText style={[{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textSecondary }, style]} {...props} />;
}

/** A message for the user after a failure. */
export function ErrorText({ style, ...props }: TextProps) {
  return <NativeText accessibilityRole="alert" style={[{ fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.dangerText }, style]} {...props} />;
}
