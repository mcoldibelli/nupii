import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../src/ui/Button";
import { Icon, LogoMark, WelcomeArt, type IconName } from "../src/ui/Icon";
import { colors, fonts, radius, space } from "../src/ui/theme";
import { slides, type Chip } from "../src/welcome/slides";
import { useWelcome } from "../src/welcome/WelcomeContext";

const chipLooks: Record<Chip["kind"], { icon: IconName; background: string; color: string; round: boolean }> = {
  nose: { icon: "scan", background: "#1E2023", color: colors.onDark, round: false },
  calendar: { icon: "calendar", background: colors.brand, color: colors.onPrimary, round: false },
  check: { icon: "check", background: colors.success, color: colors.onPrimary, round: true },
  pin: { icon: "pin", background: colors.danger, color: colors.onPrimary, round: true },
  bell: { icon: "bell", background: colors.dark, color: colors.onDark, round: true },
  scan: { icon: "scan", background: colors.surface, color: colors.ink, round: false },
};

/** The welcome of the first open of the app (Landing-Mobile artboard): four slides. */
export default function Welcome() {
  const [index, setIndex] = useState(0);
  const { markSeen } = useWelcome();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const slide = slides[index];
  const last = index === slides.length - 1;
  const heroHeight = (470 * width) / 390;

  const leave = (mode?: "create") => {
    markSeen();
    router.replace(mode ? { pathname: "/sign-in", params: { mode } } : "/sign-in");
  };

  return (
    <ScrollView style={local.page} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[local.hero, { backgroundColor: slide.hero, height: heroHeight + insets.top }]}>
        <View style={{ position: "absolute", top: insets.top, left: 0 }}>
          <WelcomeArt width={width} noseBox={index === 0} />
        </View>
        <View style={[local.top, { marginTop: insets.top + space.xl }]}>
          <LogoMark size={28} color={colors.onPrimary} />
          <Text style={local.brand}>nupii</Text>
          <Pressable testID="welcome-sign-in" accessibilityRole="button" style={local.signIn} onPress={() => leave()}>
            <Text style={local.signInText}>Entrar</Text>
          </Pressable>
        </View>
        <Text testID="welcome-title" accessibilityRole="header" style={local.title}>
          {slide.title}
        </Text>
        {slide.chips.map((chip) => {
          const look = chipLooks[chip.kind];
          return (
            <View key={chip.title} style={[local.chip, chip.side === "left" ? { left: 14 } : { right: 14 }, { bottom: (chip.bottom * width) / 390 }]}>
              <View style={[local.chipIcon, { backgroundColor: look.background, borderRadius: look.round ? 16 : 10 }]}>
                <Icon name={look.icon} size={18} color={look.color} />
              </View>
              <View>
                <Text style={local.chipTitle}>{chip.title}</Text>
                <Text style={local.chipSubtitle}>{chip.subtitle}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={local.body}>
        <Text style={local.bodyText}>{slide.body}</Text>
        <View style={local.dots}>
          {slides.map((item, k) => (
            <Pressable
              key={item.title}
              testID={`welcome-dot-${k}`}
              accessibilityRole="button"
              accessibilityLabel={`Ir para o slide ${k + 1}`}
              onPress={() => setIndex(k)}
              hitSlop={12}
              style={[local.dot, { width: k === index ? 28 : 8, backgroundColor: k === index ? colors.ink : "#DAD9D6" }]}
            />
          ))}
        </View>
      </View>
      <View style={[local.actions, { paddingBottom: insets.bottom + space.xl }]}>
        <Button
          testID="welcome-next"
          label={last ? "Criar conta" : "Próximo"}
          variant={last ? "primary" : "dark"}
          trailingIcon="arrowRight"
          onPress={() => (last ? leave("create") : setIndex(index + 1))}
        />
        <View style={local.row}>
          <View style={{ flex: 1 }}>
            <Button testID="welcome-found" label="Achei um cachorro" icon="scan" variant="soft" size="md" onPress={() => router.push("/found")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="welcome-board" label="Ver mural" icon="pin" variant="soft" size="md" onPress={() => router.push("/reports")} />
          </View>
        </View>
        <View style={local.terms}>
          <Text style={local.termsText}>Ao criar conta, você aceita os</Text>
          <Pressable testID="welcome-terms" accessibilityRole="link" style={local.termsPill} onPress={() => router.push("/terms")}>
            <Text style={local.termsPillText}>Termos e a Privacidade</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  page: { backgroundColor: colors.background },
  hero: { borderBottomLeftRadius: 44, borderBottomRightRadius: 44, overflow: "hidden" },
  top: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: space.xl },
  brand: { color: colors.onPrimary, flex: 1, fontFamily: fonts.title, fontSize: 24, letterSpacing: -0.5 },
  signIn: { backgroundColor: colors.background, borderRadius: radius.pill, height: 44, justifyContent: "center", paddingHorizontal: 16 },
  signInText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15 },
  title: { color: colors.onPrimary, fontFamily: fonts.title, fontSize: 40, letterSpacing: -1.4, lineHeight: 42, marginHorizontal: 24, marginTop: 20 },
  chip: { alignItems: "center", backgroundColor: colors.background, borderRadius: 16, elevation: 6, flexDirection: "row", gap: 8, padding: 8, paddingRight: 12, position: "absolute", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 12 },
  chipIcon: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  chipTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13 },
  chipSubtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  body: { gap: 16, paddingHorizontal: 28, paddingTop: 22 },
  bodyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, minHeight: 72 },
  dots: { alignItems: "center", flexDirection: "row", gap: 6 },
  dot: { borderRadius: 4, height: 8 },
  actions: { gap: 10, marginTop: "auto", paddingHorizontal: space.xl, paddingTop: space.xl },
  row: { flexDirection: "row", gap: 10 },
  terms: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  termsText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  termsPill: { backgroundColor: colors.surface, borderRadius: radius.pill, justifyContent: "center", minHeight: 32, paddingHorizontal: 10 },
  termsPillText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 12 },
});
