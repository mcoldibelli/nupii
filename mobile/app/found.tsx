import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { confirmIdentification, identifyNose, type Identification } from "../src/api/found";
import type { LocalFile } from "../src/api/pets";
import { apiUrl } from "../src/config";
import { CONTACT_LIMITS, foundFailureMessage, similarityLabel, toContact } from "../src/found/contact";
import { currentLocation } from "../src/found/location";
import { filePart, NOSE_PHOTO_QUALITY, pickPhoto } from "../src/pets/pickPhoto";
import { PublishFound } from "../src/reports/PublishFound";
import { styles } from "../src/screens/styles";

/**
 * The public page "encontrei um pet": a visitor with no account sends the
 * photo of the nose of a dog, sees the candidates and leaves a contact for
 * the owner (RF-12, RF-13).
 */
export default function Found() {
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [shareLocation, setShareLocation] = useState(false);
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function choosePhoto() {
    const picked = await pickPhoto(NOSE_PHOTO_QUALITY);
    if (picked !== null) {
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
    <ScrollView contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Encontrei um pet</Text>
      <Text style={styles.text}>
        Envie uma foto de perto do focinho do cão. Nós procuramos o cão entre os pets cadastrados e avisamos o tutor.
      </Text>

      {photo !== null && <Image testID="found-photo" accessibilityLabel="Foto enviada" source={{ uri: photo.uri }} style={local.photo} />}
      <Pressable testID="found-pick-photo-button" accessibilityRole="button" style={styles.link} disabled={busy} onPress={choosePhoto}>
        <Text style={styles.linkText}>{photo === null ? "Escolher ou tirar a foto" : "Trocar a foto"}</Text>
      </Pressable>

      {photo !== null && identification === null && (
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
      {photo !== null && identification !== null && (identification.candidates.length === 0 || sent) && (
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
  content: { alignSelf: "center", backgroundColor: "#fff", flexGrow: 1, maxWidth: 520, padding: 24, width: "100%" },
  photo: { alignSelf: "center", borderRadius: 12, height: 220, width: 220 },
  checkbox: { borderColor: "#888", borderRadius: 4, borderWidth: 1, height: 24, width: 24 },
  checkboxChecked: { backgroundColor: "#1f5fbf", borderColor: "#1f5fbf" },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 12, marginTop: 24 },
  candidate: { alignItems: "center", borderColor: "#ddd", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 16, marginBottom: 12, padding: 12 },
  candidateSelected: { borderColor: "#1f5fbf", borderWidth: 2 },
  candidateText: { flex: 1 },
  petPhoto: { borderRadius: 32, height: 64, width: 64 },
  petPhotoEmpty: { backgroundColor: "#ddd" },
  petName: { fontSize: 18, fontWeight: "600" },
  similarity: { color: "#555", fontSize: 14 },
  strong: { color: "#1b6e2d", fontSize: 14, fontWeight: "600" },
  message: { minHeight: 88, textAlignVertical: "top" },
  sent: { color: "#1b6e2d", fontSize: 16, marginTop: 24, textAlign: "center" },
});
