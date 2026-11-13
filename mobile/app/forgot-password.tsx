import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { sendPasswordReset } from "../src/auth/firebase";
import { validateEmail } from "../src/auth/validation";
import { AuthSplit } from "../src/ui/AuthSplit";
import { Button } from "../src/ui/Button";
import { Field } from "../src/ui/Field";
import { Icon } from "../src/ui/Icon";
import { BackButton, Card, Screen } from "../src/ui/Surfaces";
import { Body, ErrorText, Title } from "../src/ui/Text";
import { colors } from "../src/ui/theme";
import { useWide } from "../src/ui/useWide";

/** Sends the link to reset a forgotten password by e-mail (RF-05). */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A computer browser gets the split page of Login-Web, step "recuperar senha" (#232).
  const wide = useWide();

  async function send() {
    const problem = validateEmail(email);
    setError(problem);
    if (problem !== null) {
      return;
    }
    setBusy(true);
    const failure = await sendPasswordReset(email);
    setBusy(false);
    setError(failure);
    // The same text for an e-mail with and without an account.
    setMessage(failure === null ? "Se o e-mail tiver uma conta, enviamos um link para criar uma senha nova." : null);
  }

  const content = (
    <>
      <View style={{ gap: 8 }}>
        <Title style={wide ? { fontSize: 40, lineHeight: 42, letterSpacing: -0.9 } : undefined}>Recuperar senha</Title>
        <Body style={{ color: colors.textSecondary }}>Mandamos um link para você criar uma senha nova.</Body>
      </View>
      <Field
        testID="reset-email-input"
        label="E-mail da conta"
        icon="mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        invalid={error !== null}
      />
      {error !== null && <ErrorText testID="reset-error">{error}</ErrorText>}
      {message !== null && (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityRole="summary">
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={15} color={colors.onPrimary} strokeWidth={3} />
          </View>
          <Body testID="reset-message" style={{ flex: 1, fontSize: 14 }}>
            {message} Olhe também o spam.
          </Body>
        </Card>
      )}
    </>
  );
  const sendButton = <Button testID="reset-button" label={message === null ? "Enviar link" : "Reenviar link"} trailingIcon="arrowRight" busy={busy} onPress={() => void send()} />;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));

  if (wide) {
    return (
      <AuthSplit side="signIn">
        {content}
        {sendButton}
        <Button testID="reset-back" label="Voltar para entrar" variant="soft" size="sm" stretch={false} onPress={back} />
      </AuthSplit>
    );
  }

  return (
    <Screen>
      <BackButton testID="reset-back" onPress={back} />
      {content}
      <View style={{ marginTop: "auto" }}>{sendButton}</View>
    </Screen>
  );
}
