import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { createAccount, signIn } from "../auth/firebase";
import { validateCredentials } from "../auth/validation";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { LogoMark, Mascot } from "../ui/Icon";
import { Body, ErrorText, Title } from "../ui/Text";
import { colors, fonts, space } from "../ui/theme";

/** Sign-in and account creation with e-mail and password (RF-01, RF-02). The look is the Login-Mobile artboard. */
export function AuthScreen() {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = validateCredentials(email, password);
    if (problem !== null) {
      setError(problem);
      return;
    }
    setBusy(true);
    // On success the app gets the new account from the session and changes
    // the screen. This screen only shows the failure.
    setError(creating ? await createAccount(email, password) : await signIn(email, password));
    setBusy(false);
  }

  return (
    <ScrollView style={local.page} contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      <View style={local.hero}>
        <View style={local.brand}>
          <LogoMark size={26} color={colors.onPrimary} eyes={colors.accent} />
          <Text style={local.brandText}>nupii</Text>
        </View>
        <View style={local.mascot}>
          <Mascot width={170} />
        </View>
      </View>
      <View style={local.form}>
        <View style={{ gap: 6 }}>
          <Title>{creating ? "Criar conta" : "Entrar"}</Title>
          <Body style={{ color: colors.textSecondary }}>{creating ? "Cuide da saúde do seu pet e ajude a achar os perdidos." : "Que bom te ver de novo."}</Body>
        </View>
        <Field
          testID="email-input"
          label="E-mail"
          icon="mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          invalid={error !== null}
        />
        <Field
          testID="password-input"
          label={creating ? "Crie uma senha" : "Senha"}
          icon="lock"
          secureTextEntry
          autoComplete={creating ? "new-password" : "current-password"}
          value={password}
          onChangeText={setPassword}
          invalid={error !== null}
        />
        {error !== null && <ErrorText testID="auth-error">{error}</ErrorText>}
        {!creating && (
          <Button testID="forgot-password-link" label="Esqueci minha senha" variant="soft" size="sm" stretch={false} onPress={() => router.push("/forgot-password")} />
        )}
      </View>
      <View style={local.actions}>
        <Button testID="submit-button" label={creating ? "Criar conta" : "Entrar"} trailingIcon="arrowRight" busy={busy} onPress={() => void submit()} />
        <Button
          testID="toggle-mode-button"
          label={creating ? "Já tenho conta. Entrar" : "Não tem conta? Criar conta"}
          variant="soft"
          size="md"
          onPress={() => {
            setCreating(!creating);
            setError(null);
          }}
        />
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  page: { backgroundColor: colors.background },
  content: { flexGrow: 1 },
  hero: { height: 224, backgroundColor: colors.accent, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: "hidden" },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.xl, paddingTop: space.xl },
  brandText: { fontFamily: fonts.title, fontSize: 22, color: colors.onPrimary },
  mascot: { position: "absolute", right: 18, bottom: -2 },
  form: { paddingHorizontal: space.xl, paddingTop: 26, gap: 18 },
  actions: { marginTop: "auto", paddingHorizontal: space.xl, paddingVertical: space.xl, gap: 10 },
});
