import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Report } from "../api/reports";
import { lostLine } from "../reports/form";
import { Icon } from "../ui/Icon";
import { colors, fonts, radius } from "../ui/theme";

/**
 * The red banner of the home while the chosen pet has an open lost report
 * (proposal A, #259). "Ver ficha" opens the report. "<pet> voltou" asks for a
 * confirmation in the banner itself (no Alert.alert: it does not work on the
 * web) and then resolves the report.
 */
export function LostBanner({ petName, report, busy, onOpen, onResolve }: { petName: string; report: Report; busy: boolean; onOpen: () => void; onResolve: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <View testID="lost-banner" accessibilityRole="summary" accessibilityLabel={`${petName} sumiu`} style={local.banner}>
      <View style={local.head}>
        <View style={local.icon}>
          <Icon name="pin" size={22} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={local.title}>{confirming ? `${petName} voltou para casa?` : `${petName} sumiu`}</Text>
          <Text style={local.line}>{confirming ? "O desaparecimento sai do mural." : lostLine(report)}</Text>
        </View>
      </View>
      {confirming ? (
        <View style={local.actions}>
          <Pressable testID="lost-banner-confirm" accessibilityRole="button" disabled={busy} style={[local.button, local.light]} onPress={onResolve}>
            <Text style={[local.buttonText, { color: colors.success }]}>{busy ? "Enviando..." : "Sim, voltou"}</Text>
          </Pressable>
          <Pressable testID="lost-banner-cancel" accessibilityRole="button" style={[local.button, local.ghost]} onPress={() => setConfirming(false)}>
            <Text style={[local.buttonText, { color: colors.onPrimary }]}>Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={local.actions}>
          <Pressable testID="lost-banner-open" accessibilityRole="button" style={[local.button, local.light]} onPress={onOpen}>
            <Text style={[local.buttonText, { color: colors.dangerText }]}>Ver ficha</Text>
          </Pressable>
          <Pressable testID="lost-banner-back" accessibilityRole="button" style={[local.button, local.ghost]} onPress={() => setConfirming(true)}>
            <Text style={[local.buttonText, { color: colors.onPrimary }]} numberOfLines={1}>
              {petName} voltou
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  banner: { backgroundColor: colors.danger, borderRadius: 22, padding: 14, paddingLeft: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  line: { fontFamily: fonts.body, fontSize: 13, color: colors.onDanger },
  actions: { flexDirection: "row", gap: 8 },
  button: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  light: { backgroundColor: colors.background },
  ghost: { backgroundColor: "rgba(255,255,255,0.18)" },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
