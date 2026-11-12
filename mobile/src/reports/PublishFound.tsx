import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { reportFound } from "../api/reports";
import { apiUrl } from "../config";
import type { MapPoint } from "../map/mapHtml";
import { MapView } from "../map/MapView";
import { foundReportLink } from "./foundLink";
import { REPORT_LIMITS, reportFailureMessage, toDetails } from "./form";
import { styles } from "../screens/styles";

/**
 * Publishes a found dog on the board, with the photo of the nose of the
 * identification (RF-19, RN-27). The page shows the link with the code
 * that resolves the report (RN-69).
 */
export function PublishFound({ photo }: { photo: () => Blob }) {
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [form, setForm] = useState({ place: "", description: "" });
  const [link, setLink] = useState<{ url: string; reportId: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish() {
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
    const result = await reportFound(apiUrl, photo(), point, details.details);
    setBusy(false);
    if (!result.ok) {
      setError(reportFailureMessage(result));
      return;
    }
    const { report, resolveCode } = result.value;
    setLink({ url: foundReportLink(window.location.origin, report.id, resolveCode), reportId: report.id, code: resolveCode });
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
            window.location.assign(link.url);
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
      <Text style={styles.text}>O tutor pode ver o cão no mural. Toque no mapa onde o cão está.</Text>
      <MapView markers={[]} onPick={setPoint} style={local.map} />
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
  section: { fontSize: 18, fontWeight: "600", marginBottom: 8, marginTop: 24 },
  map: { height: 260, marginVertical: 8, width: "100%" },
  point: { color: "#555", fontSize: 14, marginBottom: 12 },
  message: { minHeight: 80, textAlignVertical: "top" },
  link: { color: "#1f5fbf", fontSize: 14, marginVertical: 8 },
});
