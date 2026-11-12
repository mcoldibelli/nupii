// The look of the app, from the design canvas "Nupii App Screens" (ADR 0030).
// The screens take colors, fonts, spaces and corners only from this file.

export const colors = {
  background: "#FFFFFF",
  surface: "#F3F3F1",
  border: "#ECEBE8",
  borderStrong: "#E8E8E5",
  borderDashed: "#DCDAD6",
  ink: "#18161A",
  textSecondary: "#4A474E",
  textMuted: "#66636A",
  textDisabled: "#8A878E",
  // The brand orange of the canvas passes 3:1 on white, so it is only for
  // icons and shapes. Text on orange and orange text use primary (4.76:1).
  brand: "#F05F0A",
  primary: "#C94800",
  onPrimary: "#FFFFFF",
  link: "#B2470A",
  dark: "#18161A",
  onDark: "#FFFFFF",
  onDarkMuted: "#CFCDD2",
  accent: "#7A4BEA",
  danger: "#C0261A",
  dangerText: "#B3200F",
  success: "#1F6B3A",
} as const;

/** Font families, as loaded in app/_layout.tsx. */
export const fonts = {
  title: "BricolageGrotesque_800ExtraBold",
  titleBold: "BricolageGrotesque_700Bold",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemibold: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
} as const;

export const radius = { field: 18, card: 20, cardLarge: 26, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Minimum height of a control that the user taps. */
export const touch = 44;
