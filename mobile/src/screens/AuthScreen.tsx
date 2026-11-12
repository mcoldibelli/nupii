import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { signIn } from "../auth/firebase";
import { passwordLongEnough, validateCredentials, validateProfile } from "../auth/validation";
import { useSession } from "../session/SessionContext";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Icon, LogoMark, Mascot } from "../ui/Icon";
import { BackButton, Checkbox } from "../ui/Surfaces";
import { Body, ErrorText, Title } from "../ui/Text";
import { colors, fonts, space } from "../ui/theme";

/** Sign-in and account creation with e-mail and password (RF-01, RF-02). The look is the Login-Mobile artboard. */
export function AuthScreen({ startCreating = false }: { startCreating?: boolean }) {
  const [creating, setCreating] = useState(startCreating);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const { signUp } = useSession();
  // The purple header goes under the status bar; its content starts below it.
  const insets = useSafeAreaInsets();

  async function submit() {
    const problem = (creating ? validateProfile(name, accepted) : null) ?? validateCredentials(email, password);
    if (problem !== null) {
      setError(problem);
      return;
    }
    setBusy(true);
    // On success the app gets the new account from the session and changes
    // the screen. This screen only shows the failure.
    setError(creating ? await signUp(email, password, name.trim()) : await signIn(email, password));
    setBusy(false);
  }

  if (creating) {
    // Cadastro-Mobile artboard: a white header, the name, the e-mail, the
    // password with its rule, and the acceptance of the terms.
    return (
      <ScrollView style={local.page} contentContainerStyle={[local.content, { paddingTop: insets.top + space.lg }]} keyboardShouldPersistTaps="handled">
        <View style={local.createHeader}>
          <BackButton testID="create-back" onPress={() => (router.canGoBack() ? router.back() : setCreating(false))} />
          <View style={local.createBrand}>
            <LogoMark size={28} />
            <Text style={[local.brandText, { color: colors.ink }]}>nupii</Text>
          </View>
          <Button testID="toggle-mode-button" label="Entrar" variant="soft" size="sm" stretch={false} onPress={() => { setCreating(false); setError(null); }} />
        </View>
        <View style={local.form}>
          <Title>Criar conta</Title>
          <Field testID="name-input" label="Como podemos te chamar?" icon="user" autoComplete="name" maxLength={100} value={name} onChangeText={setName} />
          <Field testID="email-input" label="E-mail" icon="mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} invalid={error !== null} />
          <Field testID="password-input" label="Crie uma senha" icon="lock" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} invalid={error !== null} />
          <View style={local.rule}>
            <Icon name="check" size={14} strokeWidth={3} color={passwordLongEnough(password) ? colors.success : colors.textMuted} />
            <Text style={[local.ruleText, { color: passwordLongEnough(password) ? colors.success : colors.textMuted }]}>8 ou mais caracteres</Text>
          </View>
          <View style={local.termsRow}>
            <Checkbox testID="terms-switch" label="Aceito os" checked={accepted} onChange={setAccepted} />
            <Pressable testID="terms-link" accessibilityRole="link" style={local.termsPill} onPress={() => router.push("/terms")}>
              <Text style={local.termsPillText}>Termos</Text>
            </Pressable>
            <Text style={local.ruleText}>e a</Text>
            <Pressable accessibilityRole="link" style={local.termsPill} onPress={() => router.push("/terms")}>
              <Text style={local.termsPillText}>Privacidade</Text>
            </Pressable>
          </View>
          {error !== null && <ErrorText testID="auth-error">{error}</ErrorText>}
        </View>
        <View style={local.actions}>
          <Button testID="submit-button" label="Criar conta" trailingIcon="arrowRight" busy={busy} disabled={!accepted} onPress={() => void submit()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={local.page} contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      <View style={[local.hero, { height: 224 + insets.top }]}>
        <View style={[local.brand, { paddingTop: space.xl + insets.top }]}>
          <LogoMark size={26} color={colors.onPrimary} eyes={colors.accent} />
          <Text style={local.brandText}>nupii</Text>
        </View>
        <View style={local.mascot}>
          <Mascot width={170} />
        </View>
      </View>
      <View style={local.form}>
        <View style={{ gap: 6 }}>
          <Title>Entrar</Title>
          <Body style={{ color: colors.textSecondary }}>Que bom te ver de novo.</Body>
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
          label="Senha"
          icon="lock"
          secureTextEntry
          autoComplete="current-password"
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
        <Button testID="submit-button" label="Entrar" trailingIcon="arrowRight" busy={busy} onPress={() => void submit()} />
        <Button
          testID="toggle-mode-button"
          label="Não tem conta? Criar conta"
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
  hero: { backgroundColor: colors.accent, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: "hidden" },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.xl },
  brandText: { fontFamily: fonts.title, fontSize: 22, color: colors.onPrimary },
  mascot: { position: "absolute", right: 18, bottom: -2 },
  form: { paddingHorizontal: space.xl, paddingTop: 26, gap: 18 },
  actions: { marginTop: "auto", paddingHorizontal: space.xl, paddingVertical: space.xl, gap: 10 },
  createHeader: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: space.xl },
  createBrand: { alignItems: "center", flex: 1, flexDirection: "row", gap: 6 },
  rule: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: -6 },
  ruleText: { color: colors.textSecondary, fontFamily: fonts.bodySemibold, fontSize: 13 },
  termsRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  termsPill: { backgroundColor: colors.surface, borderRadius: 999, justifyContent: "center", minHeight: 32, paddingHorizontal: 12 },
  termsPillText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13 },
});
