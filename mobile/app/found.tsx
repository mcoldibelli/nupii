import { router } from "expo-router";
import { useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { confirmIdentification, identifyNose, type Identification } from "../src/api/found";
import type { LocalFile } from "../src/api/pets";
import { apiUrl } from "../src/config";
import { CONTACT_LIMITS, foundFailureMessage, similarityLabel, toContact } from "../src/found/contact";
import { currentLocation } from "../src/found/location";
import { filePart, NOSE_PHOTO_QUALITY, pickPhoto, takePhoto } from "../src/pets/pickPhoto";
import { PublishFound } from "../src/reports/PublishFound";
import { styles } from "../src/screens/styles";
import { BackButton } from "../src/ui/Surfaces";
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

  async function choosePhoto(next: "scan" | "publish" = mode === "publish" ? "publish" : "scan", gallery = false) {
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

  const chosen = identification?.candidates.find((candidate) => candidate.id === candidateId);

  return (
    <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.lg }]} keyboardShouldPersistTaps="handled">
      <View style={local.top}>
        <BackButton testID="found-back" onPress={() => (mode !== "start" ? setMode("start") : router.canGoBack() ? router.back() : router.replace("/"))} />
        <LogoMark size={28} />
        <Text style={local.brand}>nupii</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={local.title} accessibilityRole="header">
          Achou um cachorro?
        </Text>
        <Text style={local.lead}>Obrigado por ajudar. Vamos tentar encontrar o tutor dele.</Text>
      </View>

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
              { testID: "found-publish", icon: "camera", color: colors.success, title: "Publicar como achado no mural", line: "foto do focinho, local e como ele está · o tutor pode te achar", go: () => void choosePhoto("publish") },
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

      {mode !== "start" && photo !== null && <Image testID="found-photo" accessibilityLabel="Foto enviada" source={{ uri: photo.uri }} style={local.photo} />}
      {mode !== "start" && (
        <Pressable testID="found-change-photo" accessibilityRole="button" style={styles.link} disabled={busy} onPress={() => void choosePhoto()}>
          <Text style={local.link}>Trocar a foto</Text>
        </Pressable>
      )}
      {mode === "publish" && photo !== null && <PublishFound photo={() => filePart(photo)} />}

      {mode === "scan" && photo !== null && identification === null && (
        <>
          <Pressable
            testID="found-location-toggle"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: shareLocation }}
            style={styles.row}
            onPress={() => setShareLocation((value) => !value)}
          >
            <View style={[local.checkbox, shareLocation && local.checkboxChecked]} />
            <Text style={styles.rowText}>Enviar a minha localização, para o tutor saber onde o cão está</Text>
          </Pressable>
          <Pressable
            testID="found-search-button"
            accessibilityRole="button"
            style={[styles.button, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={search}
          >
            <Text style={styles.buttonText}>{busy ? "Procurando..." : "Procurar o cão"}</Text>
          </Pressable>
        </>
      )}

      {identification !== null && identification.candidates.length === 0 && (
        <Text testID="found-no-candidate" style={styles.text}>
          Não achamos um pet parecido. Tente outra foto, mais de perto e com mais luz.
        </Text>
      )}

      {identification !== null && !sent && identification.candidates.length > 0 && (
        <>
          <Text style={local.section}>É um destes?</Text>
          {identification.candidates.map((candidate) => (
            <Pressable
              key={candidate.id}
              testID={`found-candidate-${candidate.petName}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: candidate.id === candidateId }}
              style={[local.candidate, candidate.id === candidateId && local.candidateSelected]}
              onPress={() => setCandidateId(candidate.id)}
            >
              {candidate.petPhotoUrl ? (
                <Image accessibilityLabel={`Foto de ${candidate.petName}`} source={{ uri: candidate.petPhotoUrl }} style={local.petPhoto} />
              ) : (
                <View style={[local.petPhoto, local.petPhotoEmpty]} />
              )}
              <View style={local.candidateText}>
                <Text style={local.petName}>{candidate.petName}</Text>
                <Text style={local.similarity}>{similarityLabel(candidate.similarity)}</Text>
                {candidate.strong && <Text style={local.strong}>Correspondência forte</Text>}
              </View>
            </Pressable>
          ))}
        </>
      )}

      {chosen !== undefined && !sent && (
        <>
          <Text style={local.section}>Deixe o seu contato para o tutor de {chosen.petName}</Text>
          <Text style={styles.label}>Seu nome</Text>
          <TextInput
            testID="found-name-input"
            accessibilityLabel="Seu nome"
            style={styles.input}
            maxLength={CONTACT_LIMITS.name}
            value={contact.name}
            onChangeText={(name) => setContact((current) => ({ ...current, name }))}
          />
          <Text style={styles.label}>Telefone com DDD</Text>
          <TextInput
            testID="found-phone-input"
            accessibilityLabel="Telefone com DDD"
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={CONTACT_LIMITS.phone}
            value={contact.phone}
            onChangeText={(phone) => setContact((current) => ({ ...current, phone }))}
          />
          <Text style={styles.label}>Mensagem (opcional)</Text>
          <TextInput
            testID="found-message-input"
            accessibilityLabel="Mensagem"
            style={[styles.input, local.message]}
            multiline
            maxLength={CONTACT_LIMITS.message}
            value={contact.message}
            onChangeText={(message) => setContact((current) => ({ ...current, message }))}
          />
          <Pressable
            testID="found-confirm-button"
            accessibilityRole="button"
            style={[styles.button, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={confirm}
          >
            <Text style={styles.buttonText}>{busy ? "Enviando..." : "Avisar o tutor"}</Text>
          </Pressable>
        </>
      )}

      {/* RF-19: with no candidate, or after the contact, the dog can go to the board. */}
      {mode === "scan" && photo !== null && identification !== null && (identification.candidates.length === 0 || sent) && (
        <PublishFound photo={() => filePart(photo)} />
      )}

      {sent && chosen !== undefined && (
        <Text testID="found-sent" style={local.sent}>
          Pronto. O tutor de {chosen.petName} recebeu o seu contato. Obrigado por ajudar.
        </Text>
      )}
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
  checkbox: { borderColor: colors.textMuted, borderRadius: 4, borderWidth: 1, height: 24, width: 24 },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  section: { fontSize: 18, fontFamily: fonts.titleBold },
  candidate: { alignItems: "center", borderColor: colors.border, borderRadius: radius.card, borderWidth: 1.5, flexDirection: "row", gap: 16, padding: 12 },
  candidateSelected: { borderColor: colors.primary, borderWidth: 2 },
  candidateText: { flex: 1 },
  petPhoto: { borderRadius: 32, height: 64, width: 64 },
  petPhotoEmpty: { backgroundColor: colors.borderStrong },
  petName: { fontSize: 18, fontFamily: fonts.titleBold },
  similarity: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14 },
  strong: { color: colors.success, fontSize: 14, fontFamily: fonts.bodyBold },
  message: { minHeight: 88, textAlignVertical: "top" },
  sent: { fontFamily: fonts.body, color: colors.success, fontSize: 16, textAlign: "center" },
});
