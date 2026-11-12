import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { createAccount, signIn } from "../auth/firebase";
import { validateCredentials } from "../auth/validation";
import { styles } from "./styles";

/** Sign-in and account creation with e-mail and password (RF-01, RF-02). */
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
    <View style={styles.screen}>
      <Text style={styles.title}>Nupii</Text>
      <Text style={styles.label}>E-mail</Text>
      <TextInput
        testID="email-input"
        accessibilityLabel="E-mail"
        style={styles.input}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Senha</Text>
      <TextInput
        testID="password-input"
        accessibilityLabel="Senha"
        style={styles.input}
        secureTextEntry
        autoComplete={creating ? "new-password" : "current-password"}
        value={password}
        onChangeText={setPassword}
      />
      {error !== null && (
        <Text testID="auth-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID="submit-button"
        accessibilityRole="button"
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.buttonText}>{creating ? "Criar conta" : "Entrar"}</Text>
      </Pressable>
      <Pressable
        testID="toggle-mode-button"
        accessibilityRole="button"
        style={styles.link}
        onPress={() => {
          setCreating(!creating);
          setError(null);
        }}
      >
        <Text style={styles.linkText}>{creating ? "Já tenho conta" : "Criar uma conta"}</Text>
      </Pressable>
      {!creating && (
        <Pressable testID="forgot-password-link" accessibilityRole="button" style={styles.link} onPress={() => router.push("/forgot-password")}>
          <Text style={styles.linkText}>Esqueci a senha</Text>
        </Pressable>
      )}
    </View>
  );
}
