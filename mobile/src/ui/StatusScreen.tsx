import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { LogoMark } from "./Icon";
import { colors, fonts, space } from "./theme";

/**
 * The full screen of a state of the app with no other screen: the load of
 * the session, a failure or a missing configuration. It continues the native
 * splash screen: the logo on white, with the name of the app.
 */
export function StatusScreen({ message, busy = false, alert = false, children }: { message: string; busy?: boolean; alert?: boolean; children?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.xl }}>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <LogoMark size={104} />
        <Text style={{ fontFamily: fonts.title, fontSize: 36, letterSpacing: -1, color: colors.ink }}>nupii</Text>
      </View>
      <View style={{ alignItems: "center", gap: space.md, maxWidth: 320 }}>
        {busy && <ActivityIndicator size="large" color={colors.brand} />}
        <Text testID="status-message" accessibilityRole={alert ? "alert" : undefined} style={{ fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: alert ? colors.dangerText : colors.textMuted, textAlign: "center" }}>
          {message}
        </Text>
      </View>
      {children !== undefined && <View style={{ alignSelf: "stretch", maxWidth: 360, width: "100%", alignItems: "stretch", gap: 10 }}>{children}</View>}
    </View>
  );
}
