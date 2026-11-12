import { StyleSheet } from "react-native";

import { colors, fonts, radius } from "../ui/theme";

/** Styles that the screens share, with the look of the design canvas (ADR 0030). */
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 20 },
  title: { fontFamily: fonts.title, fontSize: 28, letterSpacing: -0.8, color: colors.ink, marginBottom: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.field,
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    marginBottom: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: 8, minHeight: 56, paddingHorizontal: 18 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 17 },
  link: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderRadius: radius.pill, marginTop: 10, minHeight: 48, paddingHorizontal: 16 },
  linkText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15 },
  error: { color: colors.dangerText, fontFamily: fonts.bodySemibold, fontSize: 14, marginBottom: 8 },
  text: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, marginBottom: 16, textAlign: "center" },
  row: { alignItems: "center", flexDirection: "row", marginBottom: 16 },
  rowText: { color: colors.ink, flex: 1, fontFamily: fonts.body, fontSize: 15, marginLeft: 12 },
});
