import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { sendPasswordReset } from "../src/auth/firebase";
import { validateEmail } from "../src/auth/validation";
import { styles } from "../src/screens/styles";

/** Sends the link to reset a forgotten password by e-mail (RF-05). */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <View style={styles.screen}>
      <TextInput
        testID="reset-email-input"
        accessibilityLabel="E-mail"
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      {error !== null && (
        <Text testID="reset-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {message !== null && (
        <Text testID="reset-message" style={styles.text}>
          {message}
        </Text>
      )}
      <Pressable testID="reset-button" accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => void send()}>
        <Text style={styles.buttonText}>Enviar link</Text>
      </Pressable>
    </View>
  );
}
