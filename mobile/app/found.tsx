import { router } from "expo-router";
import { useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { confirmIdentification, identifyNose, type Identification } from "../src/api/found";
import type { LocalFile } from "../src/api/pets";
import { apiUrl } from "../src/config";
import { CONTACT_LIMITS, foundFailureMessage, similarityLabel, toContact } from "../src/found/contact";
import { currentLocation } from "../src/found/location";
import { filePart, NOSE_PHOTO_QUALITY, pickPhoto, takePhoto } from "../src/pets/pickPhoto";
import { PublishFound } from "../src/reports/PublishFound";
import { styles } from "../src/screens/styles";
import { Button } from "../src/ui/Button";
import { Field } from "../src/ui/Field";
import { BackButton, Checkbox } from "../src/ui/Surfaces";
import { Icon, LogoMark, type IconName } from "../src/ui/Icon";
import { colors, fonts, radius, space } from "../src/ui/theme";

/**
 * The public page "encontrei um pet": a visitor with no account sends the
 * photo of the nose of a dog, sees the candidates and leaves a contact for
 * the owner (RF-12, RF-13).
 */
export default function Found() {
  const insets = useSafeAreaInsets();
  // "start" is the Achei-Mobile artboard; "scan" sends the photo to the search; "publish" goes to the board.
  const [mode, setMode] = useState<"start" | "scan" | "publish">("start");
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [shareLocation, setShareLocation] = useState(false);
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // The candidate on the screen, and true when the person said that none is the dog.
  const [current, setCurrent] = useState(0);
  const [noneIsTheDog, setNoneIsTheDog] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function choosePhoto(next: "scan" = "scan", gallery = false) {
    // In the app the camera opens with a square crop; the web and a refused camera use the gallery.
    const taken = gallery || Platform.OS === "web" ? "denied" : await takePhoto(true);
    const picked = taken === "denied" ? await pickPhoto(NOSE_PHOTO_QUALITY) : taken;
    if (picked !== null) {
      setMode(next);
      setPhoto(picked);
      setIdentification(null);
      setCandidateId(null);
      setSent(false);
      setError(null);
    }
  }

  async function search() {
    if (photo === null) {
      return;
    }
    setBusy(true);
    setError(null);
    const location = shareLocation ? await currentLocation() : null;
    const result = await identifyNose(apiUrl, filePart(photo), location);
    if (result.ok) {
      setIdentification(result.value);
      setCurrent(0);
      setNoneIsTheDog(false);
    } else {
      setError(foundFailureMessage(result));
    }
    setBusy(false);
  }

  async function confirm() {
    if (photo === null || identification === null || candidateId === null) {
      return;
    }
    const form = toContact(contact);
    if (!form.ok) {
      setError(form.message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await confirmIdentification(apiUrl, identification.id, candidateId, form.contact, filePart(photo));
    if (result.ok) {
      setSent(true);
    } else {
      setError(foundFailureMessage(result));
    }
    setBusy(false);
  }

  const candidates = identification?.candidates ?? [];
  const candidate = noneIsTheDog ? undefined : candidates[current];
  const chosen = candidates.find((item) => item.id === candidateId);

  return (
    <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.lg }]} keyboardShouldPersistTaps="handled">
      <View style={local.top}>
        <BackButton testID="found-back" onPress={() => (mode !== "start" ? setMode("start") : router.canGoBack() ? router.back() : router.replace("/"))} />
        <LogoMark size={28} />
        <Text style={local.brand}>nupii</Text>
      </View>
      {identification === null && (
        <View style={{ gap: 8 }}>
          <Text style={local.title} accessibilityRole="header">
            Achou um cachorro?
          </Text>
          <Text style={local.lead}>Obrigado por ajudar. Vamos tentar encontrar o tutor dele.</Text>
        </View>
      )}

      {mode === "start" && (
        <>
          <View style={local.scanCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={local.scanArt}>
                <Icon name="scan" size={44} color={colors.brand} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={local.scanTitle}>Escaneie o focinho</Text>
                <Text style={local.scanText}>Se ele tiver cadastro, o tutor é avisado na hora. Leva menos de 1 minuto.</Text>
              </View>
            </View>
            <Pressable testID="found-pick-photo-button" accessibilityRole="button" style={local.scanButton} disabled={busy} onPress={() => void choosePhoto("scan")}>
              <Icon name="scan" size={22} color={colors.onPrimary} strokeWidth={2.1} />
              <Text style={local.scanButtonText}>Escanear focinho</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable testID="found-gallery" accessibilityRole="button" style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }} onPress={() => void choosePhoto("scan", true)}>
                <Text style={[local.link, { color: colors.onDarkMuted }]}>Escolher da galeria</Text>
              </Pressable>
            )}
          </View>
          <Text style={local.overline}>NÃO DÁ PARA ESCANEAR AGORA?</Text>
          {(
            [
              { testID: "found-board", icon: "pin", color: colors.danger, title: "Ver perdidos perto daqui", line: "compare com os cachorros que sumiram no bairro", go: () => router.push("/reports") },
              { testID: "found-publish", icon: "camera", color: colors.success, title: "Publicar como achado no mural", line: "foto do cachorro, local e como ele está · o tutor pode te achar", go: () => setMode("publish") },
            ] as { testID: string; icon: IconName; color: string; title: string; line: string; go: () => void }[]
          ).map((option) => (
            <Pressable key={option.testID} testID={option.testID} accessibilityRole="button" style={local.option} onPress={option.go}>
              <View style={[local.optionIcon, { backgroundColor: option.color }]}>
                <Icon name={option.icon} size={20} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={local.optionTitle}>{option.title}</Text>
                <Text style={local.optionLine}>{option.line}</Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
          <View style={local.tip}>
            <Text style={local.optionLine}>
              <Text style={{ fontFamily: fonts.bodyBold, color: colors.ink }}>Enquanto isso: </Text>
              deixe ele num lugar seguro, com água, e evite dar comida diferente.
            </Text>
          </View>
        </>
      )}

      {/* Before the search: the photo of the nose, to confirm it. After the search it is not shown (RN-86). */}
      {mode === "scan" && photo !== null && identification === null && (
        <>
          <Image testID="found-photo" accessibilityLabel="Foto do focinho" source={{ uri: photo.uri }} style={local.photo} />
          <Button testID="found-change-photo" label="Trocar a foto" variant="soft" size="sm" stretch={false} disabled={busy} onPress={() => void choosePhoto()} />
          <Checkbox testID="found-location-toggle" label="Enviar a minha localização, para o tutor saber onde o cão está" checked={shareLocation} onChange={setShareLocation} />
          <Button testID="found-search-button" label={busy ? "Procurando..." : "Procurar o tutor"} icon="scan" busy={busy} onPress={() => void search()} />
        </>
      )}
      {mode === "publish" && <PublishFound />}

      {/* The result (Match artboard), without the photos of the nose. */}
      {identification !== null && !sent && chosen === undefined && candidate !== undefined && (
        <View style={{ gap: space.lg }}>
          <View style={{ gap: 6 }}>
            <Text style={local.overline}>RESULTADO DA BUSCA</Text>
            <Text style={local.title} accessibilityRole="header">
              {candidates.length === 1 ? "Achamos uma possível correspondência" : `Achamos ${candidates.length} cães parecidos`}
            </Text>
          </View>
          {(showAll ? candidates : [candidate]).map((item) => (
            <Pressable
              key={item.id}
              testID={`found-candidate-${item.petName}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.petName}, ${similarityLabel(item.similarity)}`}
              style={[local.match, item.id === candidate.id && local.matchCurrent]}
              onPress={() => setCurrent(candidates.indexOf(item))}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {item.petPhotoUrl ? <Image source={{ uri: item.petPhotoUrl }} style={local.matchPhoto} /> : <View style={[local.matchPhoto, local.matchPhotoEmpty]}><Icon name="camera" size={22} color={colors.onPrimary} /></View>}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={local.matchName}>{item.petName}</Text>
                  <Text style={local.muted}>{similarityLabel(item.similarity)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={local.bar}>
                  <View style={[local.barFill, { width: `${Math.round(Math.max(0, Math.min(1, item.similarity)) * 100)}%` }]} />
                </View>
                <View style={local.confidence}>
                  <Text style={[local.confidenceText, !item.strong && { color: colors.textSecondary }]}>{item.strong ? "Alta confiança" : "Parecido"}</Text>
                </View>
              </View>
            </Pressable>
          ))}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Icon name="lock" size={18} color={colors.textMuted} />
            <Text style={[local.muted, { flex: 1 }]}>A confirmação final é do tutor. Seu contato só vai para o tutor do cão que você escolher.</Text>
          </View>
          {candidates.length > 1 && !showAll && (
            <Pressable testID="found-show-all" accessibilityRole="button" hitSlop={8} onPress={() => setShowAll(true)}>
              <Text style={local.link}>Ver {candidates.length - 1 === 1 ? "outro parecido" : `outros ${candidates.length - 1} parecidos`}</Text>
            </Pressable>
          )}
          <Button testID="found-pick-candidate" label="Avisar o tutor" onPress={() => setCandidateId(candidate.id)} />
          <Button
            testID="found-not-this"
            label="Não é este cão"
            variant="soft"
            size="md"
            onPress={() => {
              if (current + 1 < candidates.length) {
                setCurrent(current + 1);
              } else {
                setNoneIsTheDog(true);
              }
            }}
          />
        </View>
      )}

      {/* The contact for the owner of the chosen dog (RF-13, RN-63). */}
      {chosen !== undefined && !sent && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {chosen.petPhotoUrl ? <Image source={{ uri: chosen.petPhotoUrl }} style={local.contactPhoto} /> : null}
            <Text style={[local.title, { flex: 1, fontSize: 26 }]} accessibilityRole="header">
              Avise o tutor de {chosen.petName}
            </Text>
          </View>
          <Text style={local.muted}>O tutor recebe o seu nome, o telefone e o recado na hora. Ele liga ou manda mensagem para você.</Text>
          <Field testID="found-name-input" label="Seu nome" icon="user" maxLength={CONTACT_LIMITS.name} value={contact.name} onChangeText={(name) => setContact((value) => ({ ...value, name }))} />
          <Field testID="found-phone-input" label="Telefone com DDD" icon="phone" keyboardType="phone-pad" maxLength={CONTACT_LIMITS.phone} value={contact.phone} onChangeText={(phone) => setContact((value) => ({ ...value, phone }))} />
          <Field testID="found-message-input" label="Recado (opcional)" multiline maxLength={CONTACT_LIMITS.message} style={local.message} placeholder="Ex.: ele está comigo, perto da praça" value={contact.message} onChangeText={(message) => setContact((value) => ({ ...value, message }))} />
          <Button testID="found-confirm-button" label={busy ? "Enviando..." : "Avisar o tutor"} busy={busy} onPress={() => void confirm()} />
          <Button testID="found-back-to-candidates" label="Escolher outro cão" variant="soft" size="md" disabled={busy} onPress={() => setCandidateId(null)} />
        </View>
      )}

      {sent && chosen !== undefined && (
        <View testID="found-sent" style={local.sentCard}>
          <View style={local.sentIcon}>
            <Icon name="check" size={26} color={colors.onPrimary} strokeWidth={2.8} />
          </View>
          <Text style={local.sentTitle}>O tutor de {chosen.petName} foi avisado</Text>
          <Text style={local.muted}>Ele recebeu o seu contato. Obrigado por ajudar.</Text>
        </View>
      )}

      {/* RF-19: with no candidate, or none is the dog, or after the contact, the dog can go to the board. */}
      {mode === "scan" && identification !== null && (candidates.length === 0 || noneIsTheDog) && !sent && (
        <View style={{ gap: 6 }}>
          <Text testID="found-no-candidate" style={local.title} accessibilityRole="header">
            Não achamos o tutor
          </Text>
          <Text style={local.muted}>Nenhum cão cadastrado tem esse focinho. Publique o achado no mural com uma foto do cachorro: o tutor pode te achar.</Text>
        </View>
      )}
      {mode === "scan" && identification !== null && (candidates.length === 0 || noneIsTheDog || sent) && <PublishFound />}
      {error !== null && (
        <Text testID="found-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { alignSelf: "center", backgroundColor: colors.background, flexGrow: 1, maxWidth: 520, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg, width: "100%" },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontFamily: fonts.title, fontSize: 22, color: colors.ink },
  title: { fontFamily: fonts.title, fontSize: 32, letterSpacing: -0.9, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary },
  scanCard: { gap: 16, padding: 18, borderRadius: radius.cardLarge, backgroundColor: colors.dark },
  scanArt: { width: 96, height: 96, borderRadius: 22, backgroundColor: "#2A2622", alignItems: "center", justifyContent: "center" },
  scanTitle: { fontFamily: fonts.title, fontSize: 22, letterSpacing: -0.5, color: colors.onDark },
  scanText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.onDarkMuted },
  scanButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.primary },
  scanButtonText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPrimary },
  overline: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6, color: colors.textMuted },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border },
  optionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  optionLine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  tip: { padding: 14, borderRadius: 18, backgroundColor: colors.surface },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.link },
  photo: { alignSelf: "center", borderRadius: radius.card, height: 220, width: 220 },
  message: { minHeight: 88, textAlignVertical: "top", paddingTop: 12 },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  match: { gap: 12, padding: 12, borderRadius: radius.cardLarge, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.surface },
  matchCurrent: { borderColor: colors.brand },
  matchPhoto: { width: 76, height: 76, borderRadius: 20 },
  matchPhotoEmpty: { backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  matchName: { fontFamily: fonts.titleBold, fontSize: 21, color: colors.ink },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  confidence: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.background, justifyContent: "center" },
  confidenceText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.success },
  contactPhoto: { width: 56, height: 56, borderRadius: 28 },
  sentCard: { alignItems: "center", gap: 10, padding: space.xl, borderRadius: radius.cardLarge, backgroundColor: colors.surface },
  sentIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  sentTitle: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.ink, textAlign: "center" },
});
