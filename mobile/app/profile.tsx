import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";

import { changePassword } from "../src/auth/firebase";
import { validateNewPassword } from "../src/auth/validation";
import { styles } from "../src/screens/styles";
import { useSession } from "../src/session/SessionContext";

/** The profile of the owner (RF-06), the change of the password (RF-07) and the delete of the account (RF-08). */
export default function Profile() {
  const { state, rename, deleteAccount } = useSession();
  const owner = state.kind === "ready" ? state.owner : null;
  const [name, setName] = useState(owner?.name ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string | null>, success: string) {
    setBusy(true);
    const failure = await action();
    setBusy(false);
    setError(failure);
    setMessage(failure === null ? success : null);
  }

  async function savePassword() {
    const problem = validateNewPassword(current, next);
    if (problem !== null) {
      setError(problem);
      setMessage(null);
      return;
    }
    await run(() => changePassword(current, next), "Senha trocada.");
    setCurrent("");
    setNext("");
  }

  function confirmDelete() {
    Alert.alert("Excluir a conta?", "Os seus pets, a saúde deles e os cadastros dos focinhos são apagados. Não dá para desfazer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void run(() => deleteAccount(deletePassword), "Conta excluída.") },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={local.screen} keyboardShouldPersistTaps="handled">
      <Text style={local.label}>E-mail</Text>
      <Text testID="profile-email" style={local.value}>
        {owner?.email}
      </Text>
      <Text style={local.label}>Nome</Text>
      <TextInput testID="profile-name-input" accessibilityLabel="Nome" style={styles.input} value={name} onChangeText={setName} maxLength={100} />
      <Pressable testID="profile-save" accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => void run(() => rename(name), "Nome salvo.")}>
        <Text style={styles.buttonText}>Salvar nome</Text>
      </Pressable>
      {error !== null && (
        <Text testID="profile-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {message !== null && <Text testID="profile-message">{message}</Text>}

      <Text style={local.heading}>Trocar a senha</Text>
      <TextInput testID="current-password-input" accessibilityLabel="Senha atual" placeholder="Senha atual" secureTextEntry style={styles.input} value={current} onChangeText={setCurrent} />
      <TextInput testID="new-password-input" accessibilityLabel="Senha nova" placeholder="Senha nova" secureTextEntry style={styles.input} value={next} onChangeText={setNext} />
      <Pressable testID="password-save" accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => void savePassword()}>
        <Text style={styles.buttonText}>Trocar a senha</Text>
      </Pressable>

      <Text style={local.heading}>Excluir a conta</Text>
      <TextInput testID="delete-password-input" accessibilityLabel="Senha para excluir a conta" placeholder="Senha" secureTextEntry style={styles.input} value={deletePassword} onChangeText={setDeletePassword} />
      <Pressable testID="delete-account" accessibilityRole="button" style={[styles.button, local.danger]} disabled={busy} onPress={confirmDelete}>
        <Text style={styles.buttonText}>Excluir a conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: "#fff", flexGrow: 1, padding: 16 },
  label: { color: "#555", fontSize: 14 },
  value: { fontSize: 16, marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 8, marginTop: 24 },
  danger: { backgroundColor: "#b00020" },
});
