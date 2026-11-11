import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { validateProfile } from "../auth/validation";
import { TERMS_TEXT, TERMS_VERSION } from "../terms";
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
      <Text style={styles.label}>Termos de uso, versão {TERMS_VERSION}</Text>
      <Text style={styles.text}>{TERMS_TEXT}</Text>
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
