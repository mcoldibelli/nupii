import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { changePassword } from "../src/auth/firebase";
import { validateNewPassword } from "../src/auth/validation";
import { useSession } from "../src/session/SessionContext";
import { Button } from "../src/ui/Button";
import { Field } from "../src/ui/Field";
import { Icon, type IconName } from "../src/ui/Icon";
import { TabBar } from "../src/ui/TabBar";
import { ErrorText } from "../src/ui/Text";
import { colors, fonts, radius, space } from "../src/ui/theme";
import { ask } from "../src/ui/ask";

/** The profile of the owner (RF-06), the change of the password (RF-07) and the delete of the account (RF-08). */
export default function Profile() {
  const { state, rename, deleteAccount, signOut } = useSession();
  const owner = state.kind === "ready" ? state.owner : null;
  const insets = useSafeAreaInsets();
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
    let changed = false;
    await run(async () => {
      const failure = await changePassword(current, next);
      changed = failure === null;
      return failure;
    }, "Senha trocada.");
    if (changed) {
      setCurrent("");
      setNext("");
    }
  }

  function confirmDelete() {
    ask("Excluir a conta?", "Os seus pets, a saúde deles e os cadastros dos focinhos são apagados. Não dá para desfazer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void run(() => deleteAccount(deletePassword), "Conta excluída.") },
    ]);
  }

  const links: { label: string; icon: IconName; testID: string; go: () => void }[] = [
    { label: "Avisos de encontro", icon: "bell", testID: "profile-found-notices", go: () => router.push("/found-notices") },
    { label: "Termos de uso e privacidade", icon: "lock", testID: "profile-terms", go: () => router.push("/terms") },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[local.screen, { paddingTop: insets.top + space.md }]} keyboardShouldPersistTaps="handled">
        <Text style={local.title} accessibilityRole="header">
          Conta
        </Text>
        <View style={local.card}>
          <View style={local.avatar}>
            <Text style={local.avatarText}>{(owner?.name ?? "?").trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={local.name} numberOfLines={1}>
              {owner?.name}
            </Text>
            <Text testID="profile-email" style={[local.muted, { color: colors.onDarkMuted }]} numberOfLines={1}>
              {owner?.email}
            </Text>
          </View>
        </View>

        <View style={local.section}>
          <Field testID="profile-name-input" label="Como podemos te chamar?" icon="user" value={name} onChangeText={setName} maxLength={100} />
          <Button testID="profile-save" label="Salvar nome" variant="dark" size="md" disabled={busy} onPress={() => void run(() => rename(name), "Nome salvo.")} />
          {error !== null && <ErrorText testID="profile-error">{error}</ErrorText>}
          {message !== null && (
            <Text testID="profile-message" style={[local.muted, { color: colors.success }]}>
              {message}
            </Text>
          )}
        </View>

        <View style={{ gap: 8 }}>
          {links.map((link) => (
            <Pressable key={link.testID} testID={link.testID} accessibilityRole="link" style={local.row} onPress={link.go}>
              <View style={local.rowIcon}>
                <Icon name={link.icon} size={20} />
              </View>
              <Text style={local.rowText}>{link.label}</Text>
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <View style={local.section}>
          <Text style={local.heading}>Trocar a senha</Text>
          <Field testID="current-password-input" label="Senha atual" icon="lock" secureTextEntry value={current} onChangeText={setCurrent} />
          <Field testID="new-password-input" label="Senha nova" icon="lock" secureTextEntry value={next} onChangeText={setNext} />
          <Button testID="password-save" label="Trocar a senha" variant="dark" size="md" disabled={busy} onPress={() => void savePassword()} />
        </View>

        <Button testID="sign-out-button" label="Sair" variant="soft" size="md" onPress={signOut} />

        <View style={local.section}>
          <Text style={local.heading}>Excluir a conta</Text>
          <Text style={local.muted}>Os seus pets, a saúde deles e os cadastros dos focinhos são apagados. Não dá para desfazer.</Text>
          <Field testID="delete-password-input" label="Senha para excluir a conta" icon="lock" secureTextEntry value={deletePassword} onChangeText={setDeletePassword} />
          <Button testID="delete-account" label="Excluir a conta" variant="danger" size="md" disabled={busy} onPress={confirmDelete} />
        </View>
      </ScrollView>
      <TabBar />
    </View>
  );
}

const local = StyleSheet.create({
  screen: { flexGrow: 1, gap: space.xl, paddingHorizontal: space.xl, paddingBottom: space.xl, width: "100%", maxWidth: 560, alignSelf: "center" },
  title: { fontFamily: fonts.title, fontSize: 30, letterSpacing: -0.8, color: colors.ink },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: space.lg, borderRadius: radius.cardLarge, backgroundColor: colors.dark },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.title, fontSize: 24, color: colors.onPrimary },
  name: { fontFamily: fonts.title, fontSize: 22, color: colors.onDark },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  section: { gap: 12 },
  heading: { fontFamily: fonts.titleBold, fontSize: 19, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
