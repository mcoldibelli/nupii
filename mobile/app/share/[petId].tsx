import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { createShareLink, listShareLinks, revokeShareLink, type ShareLink } from "../../src/api/cards";
import { failureMessage, SESSION_FAILURE, type ApiResult } from "../../src/api/http";
import { linkText } from "../../src/cards/card";
import { cardLink } from "../../src/cards/link";
import { QrCode } from "../../src/cards/QrCode";
import { apiUrl, webUrl } from "../../src/config";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";
import { colors, fonts } from "../../src/ui/theme";

/** The owner creates a link of the health card, shows its QR code and revokes the links (RF-30). */
export default function ShareCard() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName: string }>();
  const { idToken } = useSession();
  const [links, setLinks] = useState<ShareLink[]>([]);
  // The address of the link created now: only the answer of the creation has the token.
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Calls the API with the ID token, and shows the failure. */
  const withToken = useCallback(
    async <T,>(call: (token: string) => Promise<ApiResult<T>>): Promise<T | null> => {
      const token = await idToken();
      if (token === null) {
        setError(SESSION_FAILURE);
        return null;
      }
      const result = await call(token);
      if (!result.ok) {
        setError(failureMessage(result));
        return null;
      }
      setError(null);
      return result.value;
    },
    [idToken],
  );

  const load = useCallback(async () => {
    const value = await withToken((token) => listShareLinks(apiUrl, token, petId));
    if (value !== null) {
      setLinks(value);
    }
  }, [withToken, petId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    const link = await withToken((token) => createShareLink(apiUrl, token, petId));
    setBusy(false);
    if (link !== null) {
      // RN-39: the token is only in this answer, so the address is shown now.
      setCreated({ id: link.id, url: cardLink(webUrl, link.token) });
      await load();
    }
  }

  async function revoke(link: ShareLink) {
    setBusy(true);
    const done = await withToken((token) => revokeShareLink(apiUrl, token, petId, link.id));
    setBusy(false);
    if (done !== null) {
      setCreated((current) => (current?.id === link.id ? null : current));
      await load();
    }
  }

  return (
    <ScrollView contentContainerStyle={local.screen}>
      <Text style={local.heading}>Carteirinha de {petName}</Text>
      <Text style={styles.text}>Quem tem o link vê o pet, o veterinário, as vacinas, os antipulgas e os vermífugos. O link vale 30 dias.</Text>
      <Pressable testID="share-create" accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => void create()}>
        <Text style={styles.buttonText}>Criar link</Text>
      </Pressable>
      {error !== null && (
        <Text testID="share-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {created !== null && (
        <View style={local.link}>
          <QrCode text={created.url} />
          <Text testID="share-url" selectable style={local.url}>
            {created.url}
          </Text>
          <Pressable testID="share-send" accessibilityRole="button" style={styles.button} onPress={() => void Share.share({ message: created.url })}>
            <Text style={styles.buttonText}>Compartilhar</Text>
          </Pressable>
        </View>
      )}
      <Text style={local.subheading}>Links ativos</Text>
      {links.length === 0 && <Text style={styles.text}>Nenhum link ativo.</Text>}
      {links.map((link) => (
        <View key={link.id} style={local.row}>
          <Text testID={`share-link-${link.id}`} style={local.line}>
            {linkText(link)}
          </Text>
          <Pressable testID={`share-revoke-${link.id}`} accessibilityRole="button" disabled={busy} onPress={() => void revoke(link)}>
            <Text style={local.revoke}>Revogar</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: colors.background, flexGrow: 1, gap: 12, padding: 16 },
  heading: { fontSize: 20, fontFamily: fonts.titleBold },
  subheading: { fontSize: 16, fontFamily: fonts.bodyBold, marginTop: 8 },
  link: { gap: 12 },
  url: { fontFamily: fonts.body, color: colors.primary, fontSize: 13 },
  row: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  line: { fontFamily: fonts.body, color: colors.textSecondary, flexShrink: 1, fontSize: 14 },
  revoke: { fontFamily: fonts.body, color: colors.dangerText, fontSize: 14 },
});
