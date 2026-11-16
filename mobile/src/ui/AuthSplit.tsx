import { router } from "expo-router";
import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthSideArt, Icon } from "./Icon";
import { colors, fonts, space } from "./theme";
import { Brand } from "./WebFrame";

export const signInDog = require("../../assets/photos/signin-dog.webp");
const signUpDog = require("../../assets/photos/signup-dog.webp");

const sides = {
  // Login-Web: purple, the pinscher. Cadastro-Web: orange, the beagle (photos: ADR 0030, item 29).
  signIn: { background: colors.accent, title: "Tudo do seu cachorro num lugar só.", text: "Vacinas, lembretes, carteirinha e o focinho cadastrado, esperando por você.", textColor: "#EDE7FF", dog: signInDog, dogWidth: 239 },
  create: { background: colors.brand, title: "Todo focinho é único. O do seu também.", text: "Crie a conta, cadastre o focinho e o bairro passa a ajudar se ele um dia sumir.", textColor: colors.ink, dog: signUpDog, dogWidth: 380 },
};

/**
 * The page of the web artboards Login-Web and Cadastro-Web (#232): the form
 * on the left, with the logo and the way back to the landing page, and the
 * colored side with the dog on the right. Only for a wide screen.
 */
export function AuthSplit({ side, children }: { side: keyof typeof sides; children: ReactNode }) {
  const look = sides[side];
  return (
    <View style={local.page}>
      {/* On the web a ScrollView does not take a flex share of a row, so a View holds it. */}
      <View style={local.left}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={local.leftContent} keyboardShouldPersistTaps="handled">
        <View style={local.header}>
          <View style={{ flex: 1 }}>
            <Brand href="/landing" />
          </View>
          <Pressable testID="auth-back-landing" accessibilityRole="link" style={local.back} onPress={() => router.replace("/landing")}>
            <Icon name="back" size={18} strokeWidth={2.4} />
            <Text style={local.backText}>Voltar para o início</Text>
          </Pressable>
        </View>
        <View style={local.center}>
          <View style={local.form}>{children}</View>
        </View>
      </ScrollView>
      </View>
      <View style={[local.side, { backgroundColor: look.background }]}>
        <AuthSideArt />
        <View style={local.sideText}>
          <Text style={local.sideTitle}>{look.title}</Text>
          <Text style={[local.sideBody, { color: look.textColor }]}>{look.text}</Text>
        </View>
        <View style={local.dog}>
          <Image source={look.dog} accessibilityIgnoresInvertColors style={{ width: look.dogWidth, height: 430 }} />
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  left: { flex: 52 },
  leftContent: { flexGrow: 1, paddingHorizontal: 64, paddingTop: space.lg, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  form: { width: "100%", maxWidth: 440, gap: 18 },
  side: { flex: 48, overflow: "hidden", minHeight: 640 },
  sideText: { paddingTop: 72, paddingHorizontal: 56, gap: 12, maxWidth: 600 },
  sideTitle: { fontFamily: fonts.title, fontSize: 46, letterSpacing: -1.2, lineHeight: 48, color: colors.onPrimary },
  sideBody: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25 },
  dog: { position: "absolute", left: 0, right: 0, bottom: -2, alignItems: "center" },
});
