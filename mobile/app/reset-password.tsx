import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { checkResetCode, resetPassword } from "../src/auth/firebase";
import { passwordLongEnough, validatePassword } from "../src/auth/validation";
import { AuthSplit } from "../src/ui/AuthSplit";
import { Button } from "../src/ui/Button";
import { Field } from "../src/ui/Field";
import { Icon } from "../src/ui/Icon";
import { Card, Screen } from "../src/ui/Surfaces";
import { Body, ErrorText, Title } from "../src/ui/Text";
import { colors, fonts } from "../src/ui/theme";
import { useWide } from "../src/ui/useWide";

type Step = { kind: "checking" } | { kind: "form"; email: string } | { kind: "invalid"; message: string } | { kind: "done" };

/**
 * The new password of the link of the reset e-mail (RF-05). The template of
 * the e-mail in Firebase points its action URL here: the link comes with
 * mode=resetPassword and the oobCode.
 */
export default function ResetPassword() {
  const { mode, oobCode } = useLocalSearchParams<{ mode?: string; oobCode?: string }>();
  const [step, setStep] = useState<Step>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wide = useWide();

  useEffect(() => {
    if (mode !== "resetPassword" || !oobCode) {
      setStep({ kind: "invalid", message: "Este link não é de redefinição de senha. Peça um link novo." });
      return;
    }
    void checkResetCode(oobCode).then((result) => setStep("email" in result ? { kind: "form", email: result.email } : { kind: "invalid", message: result.message }));
  }, [mode, oobCode]);

  async function save() {
    const problem = validatePassword(password);
    setError(problem);
    if (problem !== null || !oobCode) {
      return;
    }
    setBusy(true);
    const failure = await resetPassword(oobCode, password);
    setBusy(false);
    if (failure === null) {
      setStep({ kind: "done" });
    } else {
      setError(failure);
    }
  }

  const title = (text: string, line: string) => (
    <View style={{ gap: 8 }}>
      <Title style={wide ? { fontSize: 40, lineHeight: 42, letterSpacing: -0.9 } : undefined}>{text}</Title>
      <Body style={{ color: colors.textSecondary }}>{line}</Body>
    </View>
  );
  const signIn = <Button testID="reset-sign-in" label="Entrar" trailingIcon="arrowRight" onPress={() => router.replace("/sign-in")} />;

  let content;
  switch (step.kind) {
    case "checking":
      content = title("Senha nova", "Conferindo o link...");
      break;
    case "invalid":
      content = (
        <>
          {title("Senha nova", "Não foi possível usar este link.")}
          <ErrorText testID="reset-link-error">{step.message}</ErrorText>
          <Button testID="reset-new-link" label="Pedir um link novo" trailingIcon="arrowRight" onPress={() => router.replace("/forgot-password")} />
        </>
      );
      break;
    case "form":
      content = (
        <>
          {title("Senha nova", `Crie a senha nova da conta ${step.email}.`)}
          <Field testID="new-password-input" label="Senha nova" icon="lock" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} invalid={error !== null} />
          <View style={{ alignItems: "center", flexDirection: "row", gap: 4, marginTop: -6 }}>
            <Icon name="check" size={14} strokeWidth={3} color={passwordLongEnough(password) ? colors.success : colors.textMuted} />
            <Text style={{ color: passwordLongEnough(password) ? colors.success : colors.textMuted, fontFamily: fonts.bodySemibold, fontSize: 13 }}>8 ou mais caracteres</Text>
          </View>
          {error !== null && <ErrorText testID="reset-password-error">{error}</ErrorText>}
          <Button testID="reset-save" label="Salvar senha nova" trailingIcon="arrowRight" busy={busy} onPress={() => void save()} />
        </>
      );
      break;
    case "done":
      content = (
        <>
          {title("Senha nova", "Pronto. Entre com a senha nova.")}
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityRole="summary">
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={15} color={colors.onPrimary} strokeWidth={3} />
            </View>
            <Body testID="reset-done" style={{ flex: 1, fontSize: 14 }}>
              Senha salva.
            </Body>
          </Card>
          {signIn}
        </>
      );
      break;
  }

  return wide ? <AuthSplit side="signIn">{content}</AuthSplit> : <Screen>{content}</Screen>;
}
