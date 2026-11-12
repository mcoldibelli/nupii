import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { validateProfile } from "../auth/validation";
import { TermsView } from "./TermsView";
import { styles } from "./styles";

type Props = {
  /** Registers the owner. Returns null, or the message of the failure. */
  onRegister: (name: string) => Promise<string | null>;
  onSignOut: () => void;
};

/** First access: the name and the acceptance of the terms of use (RF-01). */
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
    <View style={styles.screen}>
      <Text style={styles.title}>Complete o seu cadastro</Text>
      <Text style={styles.label}>Nome</Text>
      <TextInput
        testID="name-input"
        accessibilityLabel="Nome"
        style={styles.input}
        autoComplete="name"
        maxLength={100}
        value={name}
        onChangeText={setName}
      />
      <ScrollView style={local.terms}>
        <TermsView />
      </ScrollView>
      <View style={styles.row}>
        <Switch
          testID="terms-switch"
          accessibilityLabel="Li e aceito os termos de uso"
          value={termsAccepted}
          onValueChange={setTermsAccepted}
        />
        <Text style={styles.rowText}>Li e aceito os termos de uso</Text>
      </View>
      {error !== null && (
        <Text testID="profile-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID="register-button"
        accessibilityRole="button"
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.buttonText}>Concluir</Text>
      </Pressable>
      <Pressable testID="profile-sign-out-button" accessibilityRole="button" style={styles.link} onPress={onSignOut}>
        <Text style={styles.linkText}>Sair</Text>
      </Pressable>
    </View>
  );
}

const local = StyleSheet.create({
  // The terms scroll inside the form, so the switch and the button stay on the screen.
  terms: { borderColor: "#ccc", borderRadius: 8, borderWidth: 1, marginBottom: 12, maxHeight: 260, padding: 8 },
});
