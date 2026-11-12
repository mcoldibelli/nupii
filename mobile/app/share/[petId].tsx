import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getNoseprint } from "../../src/api/biometrics";
import { createShareLink, listShareLinks, revokeShareLink, type HealthCard, type ShareLink } from "../../src/api/cards";
import { listHealthEvents } from "../../src/api/health";
import { failureMessage, SESSION_FAILURE, type ApiResult } from "../../src/api/http";
import { getPet } from "../../src/api/pets";
import { cardFromEvents, linkText } from "../../src/cards/card";
import { HealthCardView } from "../../src/cards/HealthCardView";
import { cardLink } from "../../src/cards/link";
import { QrCode } from "../../src/cards/QrCode";
import { apiUrl, webUrl } from "../../src/config";
import { useSession } from "../../src/session/SessionContext";
import { Button } from "../../src/ui/Button";
import { Icon, type IconName } from "../../src/ui/Icon";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";

const validities: { days: 1 | 7 | 30; label: string }[] = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
];

/** "Marcelo C.": the first name and the initial of the last name, as the canvas. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

/** The health card of a pet for its owner (Carteirinha-Mobile artboard), and the links to share it (RF-30). */
export default function OwnerCard() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName: string }>();
  const { idToken, state } = useSession();
  const insets = useSafeAreaInsets();
  const [card, setCard] = useState<HealthCard | null>(null);
  const [noseprint, setNoseprint] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  // The address of the link created now: only the answer of the creation has the token (RN-39).
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [validDays, setValidDays] = useState<1 | 7 | 30>(7);
  const [includeExams, setIncludeExams] = useState(false);
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

  const loadLinks = useCallback(async () => {
    const value = await withToken((token) => listShareLinks(apiUrl, token, petId));
    if (value !== null) {
      setLinks(value);
    }
  }, [withToken, petId]);

  useEffect(() => {
    void (async () => {
      const [pet, events] = await Promise.all([withToken((token) => getPet(apiUrl, token, petId)), withToken((token) => listHealthEvents(apiUrl, token, petId))]);
      if (pet !== null && events !== null) {
        setCard(cardFromEvents(pet, events));
      }
      if (pet?.species === "dog") {
        setNoseprint((await withToken((token) => getNoseprint(apiUrl, token, petId))) !== null);
      }
      await loadLinks();
    })();
  }, [withToken, loadLinks, petId]);

  async function create() {
    setBusy(true);
    const link = await withToken((token) => createShareLink(apiUrl, token, petId, { validDays, includeExams }));
    setBusy(false);
    if (link !== null) {
      setCreated({ id: link.id, url: cardLink(webUrl, link.token) });
      await loadLinks();
    }
  }

  async function revoke(link: ShareLink) {
    setBusy(true);
    const done = await withToken((token) => revokeShareLink(apiUrl, token, petId, link.id));
    setBusy(false);
    if (done !== null) {
      setCreated((current) => (current?.id === link.id ? null : current));
      await loadLinks();
    }
  }

  const message = created ? `Carteirinha de saúde de ${petName}: ${created.url}` : "";
  const targets: { label: string; icon: IconName; testID: string; send: () => void }[] = [
    { label: "WhatsApp", icon: "chat", testID: "share-whatsapp", send: () => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`) },
    { label: "E-mail", icon: "mail", testID: "share-email", send: () => void Linking.openURL(`mailto:?subject=${encodeURIComponent(`Carteirinha de ${petName}`)}&body=${encodeURIComponent(message)}`) },
    { label: "Mais", icon: "share", testID: "share-send", send: () => void Share.share({ message }) },
  ];

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.md }]}>
        <View style={local.top}>
          <Pressable testID="card-back" accessibilityRole="button" accessibilityLabel="Voltar" style={local.round} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
            <Icon name="back" size={20} />
          </Pressable>
          <Text style={local.title} accessibilityRole="header">
            Carteirinha
          </Text>
        </View>
        {error !== null && <ErrorText testID="share-error">{error}</ErrorText>}
        {card === null ? <Text style={local.muted}>Carregando...</Text> : <HealthCardView card={card} noseprint={noseprint} qrText={created?.url} tutor={state.kind === "ready" ? shortName(state.owner.name) : undefined} />}
      </ScrollView>
      <View style={[local.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button testID="open-share-sheet" label="Compartilhar" icon="share" onPress={() => setSheet(true)} />
      </View>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable accessibilityLabel="Fechar" style={local.overlay} onPress={() => setSheet(false)} />
        <ScrollView style={local.sheet} contentContainerStyle={[local.sheetContent, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={local.handle} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={local.sheetTitle}>Compartilhar carteirinha</Text>
              <Text style={local.muted}>Quem recebe vê só a carteirinha de {petName}, sem entrar na sua conta.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={local.round} onPress={() => setSheet(false)}>
              <Icon name="close" size={16} strokeWidth={2.4} />
            </Pressable>
          </View>
          {created === null ? (
            <>
              <View style={local.optionRow}>
                <Text style={local.optionLabel}>Link vale por</Text>
                <View style={local.segment} accessibilityRole="radiogroup">
                  {validities.map((validity) => {
                    const selected = validity.days === validDays;
                    return (
                      <Pressable key={validity.days} testID={`valid-${validity.days}`} accessibilityRole="radio" accessibilityState={{ selected }} style={[local.segmentItem, selected && { backgroundColor: colors.dark }]} onPress={() => setValidDays(validity.days)}>
                        <Text style={[local.segmentText, selected && { color: colors.onDark }]}>{validity.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={local.optionRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={local.optionLabel}>Incluir exames</Text>
                  <Text style={local.muted}>{includeExams ? "ligado: vacinas, remédios e exames, sem os anexos" : "desligado: só vacinas e remédios"}</Text>
                </View>
                <Switch testID="include-exams" accessibilityLabel="Incluir exames" value={includeExams} onValueChange={setIncludeExams} trackColor={{ false: colors.borderDashed, true: colors.success }} thumbColor={colors.background} />
              </View>
              <Button testID="share-create" label="Criar link" icon="link" busy={busy} onPress={() => void create()} />
            </>
          ) : (
            <>
              <View style={local.linkRow}>
                <Icon name="link" size={20} color={colors.textMuted} />
                <Text testID="share-url" selectable style={local.url} numberOfLines={1}>
                  {created.url}
                </Text>
              </View>
              <QrCode text={created.url} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                {targets.map((target) => (
                  <Pressable key={target.label} testID={target.testID} accessibilityRole="button" style={local.target} onPress={target.send}>
                    <Icon name={target.icon} size={22} />
                    <Text style={local.optionLabel}>{target.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Button testID="share-new" label="Criar outro link" variant="soft" size="md" onPress={() => setCreated(null)} />
            </>
          )}
          {error !== null && <ErrorText>{error}</ErrorText>}
          <Text style={local.optionLabel}>Links ativos</Text>
          {links.length === 0 && <Text style={local.muted}>Nenhum link ativo.</Text>}
          {links.map((link) => (
            <View key={link.id} style={local.activeRow}>
              <Text testID={`share-link-${link.id}`} style={[local.muted, { flex: 1 }]}>
                {linkText(link)}
                {link.includeExams ? " Com exames." : ""}
              </Text>
              <Pressable testID={`share-revoke-${link.id}`} accessibilityRole="button" hitSlop={10} disabled={busy} onPress={() => void revoke(link)}>
                <Text style={local.revoke}>Revogar</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </Modal>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.title, fontSize: 30, letterSpacing: -0.8, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: colors.background },
  overlay: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  sheet: { maxHeight: "85%", flexGrow: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  sheetContent: { paddingTop: 10, paddingHorizontal: space.xl, gap: space.lg },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderDashed },
  sheetTitle: { fontFamily: fonts.title, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  segment: { flex: 1, flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  segmentItem: { flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textSecondary },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surface },
  url: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  target: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 20, backgroundColor: colors.surface },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.border },
  revoke: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.dangerText },
});
