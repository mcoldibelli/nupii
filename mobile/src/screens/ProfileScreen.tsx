import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { validateProfile } from "../auth/validation";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Checkbox, Screen } from "../ui/Surfaces";
import { Body, ErrorText, Title } from "../ui/Text";
import { colors, radius, space } from "../ui/theme";
import { TermsView } from "./TermsView";

type Props = {
  /** Registers the owner. Returns null, or the message of the failure. */
  onRegister: (name: string) => Promise<string | null>;
  onSignOut: () => void;
};

/** First access: the name and the acceptance of the terms of use (RF-01). The look is the Cadastro-Mobile artboard. */
export function ProfileScreen({ onRegister, onSignOut }: Props) {
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = validateProfile(name, termsAccepted);
    if (problem !== null) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(await onRegister(name.trim()));
    setBusy(false);
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Title>Complete o seu cadastro</Title>
        <Body style={{ color: colors.textSecondary }}>Falta pouco: o seu nome e o aceite dos termos.</Body>
      </View>
      <Field testID="name-input" label="Como podemos te chamar?" icon="user" autoComplete="name" maxLength={100} value={name} onChangeText={setName} />
      <ScrollView style={local.terms} nestedScrollEnabled>
        <TermsView />
      </ScrollView>
      <Checkbox testID="terms-switch" label="Li e aceito os termos de uso e a política de privacidade" checked={termsAccepted} onChange={setTermsAccepted} />
      {error !== null && <ErrorText testID="profile-error">{error}</ErrorText>}
      <View style={local.actions}>
        <Button testID="register-button" label="Concluir" trailingIcon="arrowRight" busy={busy} onPress={() => void submit()} />
        <Button testID="profile-sign-out-button" label="Sair" variant="soft" size="md" onPress={onSignOut} />
      </View>
    </Screen>
  );
}

const local = StyleSheet.create({
  // The terms scroll inside the form, so the check box and the button stay on the screen.
  terms: { backgroundColor: colors.surface, borderRadius: radius.card, maxHeight: 260, padding: space.lg },
  actions: { marginTop: "auto", gap: 10 },
});
