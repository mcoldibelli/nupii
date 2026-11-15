import { useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { LocalFile } from "../api/pets";
import { reportFound } from "../api/reports";
import { apiUrl, webUrl } from "../config";
import type { MapPoint } from "../map/mapHtml";
import { PickMap } from "../map/PickMap";
import { foundReportLink } from "./foundLink";
import { REPORT_LIMITS, reportFailureMessage, toDetails } from "./form";
import { askPetPhoto, filePart, pickPhoto, shrinkPhoto } from "../pets/pickPhoto";
import { styles } from "../screens/styles";
import { Icon } from "../ui/Icon";
import { colors, fonts } from "../ui/theme";

/**
 * Publishes a found dog on the board, with a wide photo of the dog (RF-19,
 * RN-27). The photo of the nose never goes to the board (RN-86). The page
 * shows the link with the code that resolves the report (RN-69).
 */
export function PublishFound() {
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [form, setForm] = useState({ place: "", description: "" });
  const [link, setLink] = useState<{ url: string; reportId: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choosePhoto() {
    const use = (picked: LocalFile | null | "denied") => {
      if (picked === "denied") {
        setError("O app não tem permissão para usar a câmera. Escolha uma foto da galeria.");
      } else if (picked !== null) {
        setPhoto(picked);
      }
    };
    if (Platform.OS === "web") {
      void pickPhoto().then(shrinkPhoto).then(use);
    } else {
      askPetPhoto(use);
    }
  }

  async function publish() {
    // RN-27: a foto ampla do cachorro é obrigatória.
    if (photo === null) {
      setError("Tire ou escolha uma foto do cachorro.");
      return;
    }
    // RN-70: o ponto do achado é obrigatório.
    if (point === null) {
      setError("Toque no mapa onde o cão está.");
      return;
    }
    const details = toDetails(form);
    if (!details.ok) {
      setError(details.message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await reportFound(apiUrl, filePart(photo), point, details.details);
    setBusy(false);
    if (!result.ok) {
      setError(reportFailureMessage(result));
      return;
    }
    const { report, resolveCode } = result.value;
    // In the app the link points to the public web (EXPO_PUBLIC_WEB_URL).
    const origin = Platform.OS === "web" ? window.location.origin : webUrl;
    setLink({ url: foundReportLink(origin, report.id, resolveCode), reportId: report.id, code: resolveCode });
  }

  if (link !== null) {
    return (
      <View testID="found-published">
        <Text style={local.section}>O achado está no mural.</Text>
        <Text style={styles.text}>Guarde este link. Com ele, você marca o achado como resolvido quando o tutor buscar o cão:</Text>
        <Text testID="found-link" selectable style={local.link}>
          {link.url}
        </Text>
        <Pressable
          testID="found-open-report"
          accessibilityRole="link"
          style={styles.link}
          onPress={() => {
            // The code goes in the fragment, as in the link that the person keeps.
            if (Platform.OS === "web") {
              window.location.assign(link.url);
            } else {
              void Linking.openURL(link.url);
            }
          }}
        >
          <Text style={styles.linkText}>Abrir o achado</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View>
      <Text style={local.section}>Publicar o achado no mural</Text>
      <Text style={styles.text}>Uma foto do cachorro inteiro ajuda o tutor a reconhecer. A foto do focinho não vai para o mural.</Text>
      <Pressable testID="found-dog-photo" accessibilityRole="button" accessibilityLabel={photo ? "Trocar a foto do cachorro" : "Foto do cachorro"} style={local.photoRow} onPress={choosePhoto}>
        {photo ? <Image source={{ uri: photo.uri }} style={local.photo} /> : <View style={[local.photo, local.photoEmpty]}><Icon name="camera" size={28} /></View>}
        <Text style={local.photoText}>{photo ? "Trocar a foto do cachorro" : "Foto do cachorro (obrigatória)"}</Text>
      </Pressable>
      <Text style={styles.text}>Toque no mapa onde o cão está.</Text>
      <PickMap onPick={setPoint} style={local.map} />
      <Text testID="found-point" style={local.point}>
        {point === null ? "Nenhum ponto escolhido." : "Ponto escolhido."}
      </Text>
      <Text style={styles.label}>Local (opcional)</Text>
      <TextInput
        testID="found-place-input"
        accessibilityLabel="Local do achado"
        style={styles.input}
        maxLength={REPORT_LIMITS.place}
        value={form.place}
        onChangeText={(place) => setForm((current) => ({ ...current, place }))}
      />
      <Text style={styles.label}>Recado (opcional)</Text>
      <TextInput
        testID="found-description-input"
        accessibilityLabel="Recado do achado"
        style={[styles.input, local.message]}
        multiline
        maxLength={REPORT_LIMITS.description}
        value={form.description}
        onChangeText={(description) => setForm((current) => ({ ...current, description }))}
      />
      {error !== null && (
        <Text testID="found-publish-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID="found-publish-button"
        accessibilityRole="button"
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={publish}
      >
        <Text style={styles.buttonText}>{busy ? "Publicando..." : "Publicar no mural"}</Text>
      </Pressable>
    </View>
  );
}

const local = StyleSheet.create({
  section: { fontSize: 18, fontFamily: fonts.titleBold, marginBottom: 8, marginTop: 24 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 12 },
  photo: { width: 96, height: 96, borderRadius: 20 },
  photoEmpty: { backgroundColor: colors.surface, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed, alignItems: "center", justifyContent: "center" },
  photoText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  map: { height: 260, marginVertical: 8, width: "100%" },
  point: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14, marginBottom: 12 },
  message: { minHeight: 80, textAlignVertical: "top" },
  link: { fontFamily: fonts.body, color: colors.primary, fontSize: 14, marginVertical: 8 },
});
