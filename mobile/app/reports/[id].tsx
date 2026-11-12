import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { getReport, reportSighting, resolveFoundReport, type Report } from "../../src/api/reports";
import { formatDateTime } from "../../src/biometrics/messages";
import { apiUrl } from "../../src/config";
import type { MapMarker, MapPoint } from "../../src/map/mapHtml";
import { MapView } from "../../src/map/MapView";
import { codeFromHash } from "../../src/reports/foundLink";
import { REPORT_LIMITS, reportFailureMessage, reportTitle, toDetails } from "../../src/reports/form";
import { speciesLabels } from "../../src/pets/labels";
import { styles } from "../../src/screens/styles";
import { colors, fonts } from "../../src/ui/theme";

/** The markers of the detail: the point of the report and the sightings. */
function markersOf(report: Report): MapMarker[] {
  const main: MapMarker = { latitude: report.latitude, longitude: report.longitude, label: reportTitle(report), kind: "main" };
  return [
    main,
    ...report.sightings.map((sighting) => ({
      latitude: sighting.latitude,
      longitude: sighting.longitude,
      label: `Avistado em ${formatDateTime(sighting.createdAt)}`,
      kind: "sighting" as const,
    })),
  ];
}

/**
 * The detail of a report (RF-17), with the sightings (RN-25), the form of a
 * new sighting (RF-20) and, with the code of a found report, its resolution
 * (RN-69).
 */
export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // RN-69: on the web, the code of a found report is in the fragment of the address.
  const code = Platform.OS === "web" ? codeFromHash(window.location.hash) : undefined;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sighting, setSighting] = useState({ place: "", description: "" });
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await getReport(apiUrl, id);
    if (result.ok) {
      setReport(result.value);
    } else {
      setError(reportFailureMessage(result));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendSighting() {
    const form = toDetails(sighting);
    if (!form.ok) {
      setError(form.message);
      return;
    }
    setBusy(true);
    setError(null);
    // RN-28: sem o ponto, vale o ponto do desaparecimento.
    const input = point === null ? form.details : { ...form.details, ...point };
    const result = await reportSighting(apiUrl, id, input);
    if (result.ok) {
      setMessage("Obrigado. O avistamento está na ficha.");
      setSighting({ place: "", description: "" });
      setPoint(null);
      await load();
    } else {
      setError(reportFailureMessage(result));
    }
    setBusy(false);
  }

  async function resolveWithCode() {
    if (code === undefined) {
      return;
    }
    setBusy(true);
    const result = await resolveFoundReport(apiUrl, id, code);
    if (result.ok) {
      setReport(result.value);
      setMessage("O achado foi resolvido e saiu do mural.");
    } else {
      setError(reportFailureMessage(result));
    }
    setBusy(false);
  }

  if (report === null) {
    return (
      <View style={styles.screen}>
        <Text testID="status-message" style={styles.text}>
          {error ?? "Carregando..."}
        </Text>
      </View>
    );
  }
  const open = report.status === "open";
  return (
    <ScrollView contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      {report.photoUrl !== undefined && (
        <Image testID="report-photo" accessibilityLabel={reportTitle(report)} source={{ uri: report.photoUrl }} style={local.photo} />
      )}
      <Text testID="report-title" style={styles.title}>
        {reportTitle(report)}
      </Text>
      {report.petSpecies !== undefined && <Text style={local.line}>{speciesLabels[report.petSpecies]}</Text>}
      <Text style={local.line}>
        {report.type === "lost" ? "Desapareceu em" : "Encontrado em"} {formatDateTime(report.occurredAt)}
      </Text>
      {report.place !== undefined && <Text style={local.line}>Local: {report.place}</Text>}
      {report.description !== undefined && <Text style={local.line}>{report.description}</Text>}
      {report.petHasNoseprint === true && open && (
        <Text style={local.tip}>Este pet tem o focinho cadastrado. Se você encontrar o pet, use "Encontrei um pet" com uma foto do focinho.</Text>
      )}

      <MapView markers={markersOf(report)} style={local.map} />

      {report.type === "lost" && (
        <>
          <Text style={local.section}>Avistamentos ({report.sightings.length})</Text>
          {report.sightings.map((item) => (
            <View key={item.id} testID="sighting-row" style={local.sighting}>
              <Text style={local.line}>{formatDateTime(item.createdAt)}</Text>
              {item.place !== undefined && <Text style={local.line}>{item.place}</Text>}
              {item.description !== undefined && <Text style={local.line}>{item.description}</Text>}
            </View>
          ))}
        </>
      )}

      {report.type === "lost" && open && (
        <>
          <Text style={local.section}>Viu este pet?</Text>
          <Text style={local.line}>Toque no mapa onde você viu o pet. Sem o ponto, vale o local do desaparecimento.</Text>
          <MapView markers={[]} onPick={setPoint} style={local.map} />
          <Text style={styles.label}>Local (opcional)</Text>
          <TextInput
            testID="sighting-place-input"
            accessibilityLabel="Local do avistamento"
            style={styles.input}
            maxLength={REPORT_LIMITS.place}
            value={sighting.place}
            onChangeText={(place) => setSighting((current) => ({ ...current, place }))}
          />
          <Text style={styles.label}>Recado (opcional)</Text>
          <TextInput
            testID="sighting-description-input"
            accessibilityLabel="Recado do avistamento"
            style={[styles.input, local.message]}
            multiline
            maxLength={REPORT_LIMITS.description}
            value={sighting.description}
            onChangeText={(description) => setSighting((current) => ({ ...current, description }))}
          />
          <Pressable
            testID="sighting-send-button"
            accessibilityRole="button"
            style={[styles.button, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={sendSighting}
          >
            <Text style={styles.buttonText}>{busy ? "Enviando..." : "Enviar avistamento"}</Text>
          </Pressable>
        </>
      )}

      {report.type === "found" && open && code !== undefined && (
        <Pressable testID="found-resolve-button" accessibilityRole="button" style={styles.button} disabled={busy} onPress={resolveWithCode}>
          <Text style={styles.buttonText}>O tutor buscou o cão: resolver</Text>
        </Pressable>
      )}

      {message !== null && (
        <Text testID="report-message" style={local.success}>
          {message}
        </Text>
      )}
      {error !== null && (
        <Text testID="report-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { alignSelf: "center", backgroundColor: colors.background, flexGrow: 1, maxWidth: 720, padding: 16, width: "100%" },
  photo: { alignSelf: "center", borderRadius: 12, height: 200, marginBottom: 12, width: 200 },
  line: { fontFamily: fonts.body, fontSize: 15, marginBottom: 4 },
  tip: { fontFamily: fonts.body, color: colors.success, fontSize: 14, marginVertical: 8 },
  map: { height: 260, marginVertical: 12, width: "100%" },
  section: { fontSize: 18, fontFamily: fonts.titleBold, marginTop: 16 },
  sighting: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 8 },
  message: { minHeight: 80, textAlignVertical: "top" },
  success: { fontFamily: fonts.body, color: colors.success, fontSize: 15, marginTop: 12 },
});
