import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getReport, reportSighting, resolveFoundReport, type Report } from "../../src/api/reports";
import { formatDateTime } from "../../src/biometrics/messages";
import { apiUrl, webUrl } from "../../src/config";
import type { MapMarker, MapPoint } from "../../src/map/mapHtml";
import { MapView } from "../../src/map/MapView";
import { PickMap } from "../../src/map/PickMap";
import { codeFromHash } from "../../src/reports/foundLink";
import { REPORT_LIMITS, reportFailureMessage, reportTitle, toDetails } from "../../src/reports/form";
import { speciesLabels } from "../../src/pets/labels";
import { timeAgo } from "../../src/reports/board";
import { Button } from "../../src/ui/Button";
import { Field } from "../../src/ui/Field";
import { Icon } from "../../src/ui/Icon";
import { BackButton } from "../../src/ui/Surfaces";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";
import { useWide } from "../../src/ui/useWide";

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
  const [sighting, setSighting] = useState({ place: "", description: "", open: false });
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
    const form = toDetails({ place: sighting.place, description: sighting.description });
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
      setSighting({ place: "", description: "", open: false });
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

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = useWide();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/reports"));
  if (report === null) {
    return (
      <View style={[local.page, { paddingTop: insets.top + space.lg, paddingHorizontal: space.xl, gap: space.lg }]}>
        <BackButton onPress={back} />
        <Text testID="status-message" style={local.muted}>
          {error ?? "Carregando..."}
        </Text>
      </View>
    );
  }
  const open = report.status === "open";
  const lost = report.type === "lost";
  const name = lost ? (report.petName ?? "Pet perdido") : `${report.petSpecies ? speciesLabels[report.petSpecies] : "Cachorro"} achado`;
  const tag = !open ? { label: "Resolvido", color: colors.textSecondary } : lost ? { label: "Perdido", color: colors.danger } : { label: "Achado", color: colors.success };
  const share = () => void Share.share({ message: `${name}: ${webUrl}/reports/${report.id}` });
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={wide ? local.wideContent : { paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        {/* RN-86: the photo is the profile photo of the pet, or the wide photo of a found dog. */}
        <View style={[local.hero, wide ? local.heroWide : { height: (report.photoUrl !== undefined ? Math.min(width, 520) * 0.85 : 170) + insets.top }, { backgroundColor: lost ? colors.brand : colors.accent }]}>
          {report.photoUrl !== undefined ? (
            <Image testID="report-photo" accessibilityLabel={`Foto de ${name}`} source={{ uri: report.photoUrl }} style={StyleSheet.absoluteFill} />
          ) : (
            <Icon name="pin" size={56} color={colors.onPrimary} />
          )}
          <View style={[local.heroBar, { top: wide ? space.lg : insets.top + space.md }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={local.round} onPress={back}>
              <Icon name="back" size={20} />
            </Pressable>
            <Pressable testID="report-share" accessibilityRole="button" accessibilityLabel="Compartilhar" style={local.round} onPress={share}>
              <Icon name="share" size={18} />
            </Pressable>
          </View>
        </View>

        <View style={[local.sheet, wide && local.sheetWide]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[local.tag, { backgroundColor: tag.color }]}>
              <Text style={local.tagText}>{tag.label}</Text>
            </View>
            <Text style={local.muted}>{timeAgo(report.occurredAt)}</Text>
          </View>
          <Text testID="report-title" style={local.name} accessibilityRole="header">
            {name}
          </Text>

          <View style={local.facts}>
            <View style={local.fact}>
              <Icon name="calendar" size={18} color={colors.textMuted} />
              <Text style={local.factText}>
                {lost ? "Sumiu em" : "Achado em"} {formatDateTime(report.occurredAt)}
              </Text>
            </View>
            {report.place !== undefined && (
              <View style={local.fact}>
                <Icon name="pin" size={18} color={colors.textMuted} />
                <Text style={local.factText}>{report.place}</Text>
              </View>
            )}
            {report.description !== undefined && <Text style={local.note}>{report.description}</Text>}
          </View>

          {lost && open && report.petHasNoseprint === true && (
            <Pressable testID="report-scan" accessibilityRole="button" style={local.scanCard} onPress={() => router.push("/found")}>
              <View style={local.scanIcon}>
                <Icon name="scan" size={22} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={local.scanTitle}>Achou {report.petName ?? "este cachorro"}?</Text>
                <Text style={local.scanText}>Ele tem o focinho cadastrado. Escaneie o focinho e o tutor é avisado na hora.</Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.onDarkMuted} />
            </Pressable>
          )}

          {/* On a wide screen the action stays beside the details. */}
          {wide && open && (lost || code !== undefined) && (
            <View style={{ alignItems: "flex-start" }}>
            {lost ? (
              <Button testID="report-seen" label={report.petSpecies === "dog" ? "Vi este cachorro" : "Vi este pet"} icon="pin" stretch={!wide} onPress={() => setSighting((current) => ({ ...current, open: true }))} />
            ) : (
              <Button testID="found-resolve-button" label="O tutor buscou o cão: resolver" stretch={!wide} busy={busy} onPress={() => void resolveWithCode()} />
            )}
            </View>
          )}
          <Text style={local.section}>{lost ? "Onde sumiu" : "Onde foi achado"}</Text>
          <MapView markers={markersOf(report)} style={local.map} />

          {lost && (
            <View style={{ gap: 10 }}>
              <Text style={local.section}>
                Avistamentos {report.sightings.length > 0 ? `(${report.sightings.length})` : ""}
              </Text>
              {report.sightings.length === 0 && <Text style={local.muted}>Ninguém avisou que viu {report.petName ?? "o pet"} ainda.</Text>}
              {[...report.sightings].reverse().map((item) => (
                <View key={item.id} testID="sighting-row" style={local.sighting}>
                  <View style={local.sightingDot} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={local.sightingTitle}>{timeAgo(item.createdAt)}</Text>
                    {item.place !== undefined && <Text style={local.muted}>{item.place}</Text>}
                    {item.description !== undefined && <Text style={local.muted}>{item.description}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {message !== null && (
            <Text testID="report-message" style={local.success}>
              {message}
            </Text>
          )}
          {error !== null && <ErrorText testID="report-error">{error}</ErrorText>}
        </View>
      </ScrollView>

      {!wide && open && (lost || code !== undefined) && (
        <View style={[local.footer, { paddingBottom: insets.bottom + space.lg }]}>
          {lost ? (
            <Button testID="report-seen" label={report.petSpecies === "dog" ? "Vi este cachorro" : "Vi este pet"} icon="pin" stretch={!wide} onPress={() => setSighting((current) => ({ ...current, open: true }))} />
          ) : (
            <Button testID="found-resolve-button" label="O tutor buscou o cão: resolver" stretch={!wide} busy={busy} onPress={() => void resolveWithCode()} />
          )}
        </View>
      )}

      {/* RF-20: the sighting, in a sheet over the detail. */}
      <Modal visible={sighting.open} transparent animationType="slide" onRequestClose={() => setSighting((current) => ({ ...current, open: false }))}>
        <Pressable accessibilityLabel="Fechar" style={local.overlay} onPress={() => setSighting((current) => ({ ...current, open: false }))} />
        <ScrollView style={local.modal} contentContainerStyle={[local.modalContent, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
          <Text style={local.modalTitle}>Onde você viu {report.petName ?? "o pet"}?</Text>
          <Text style={local.muted}>Toque no mapa. Sem o ponto, vale o local do desaparecimento.</Text>
          <PickMap onPick={setPoint} style={local.map} />
          <Text testID="sighting-point" style={local.muted}>
            {point === null ? "Nenhum ponto escolhido." : "Ponto escolhido."}
          </Text>
          <Field testID="sighting-place-input" label="Local (opcional)" icon="pin" maxLength={REPORT_LIMITS.place} value={sighting.place} onChangeText={(place) => setSighting((current) => ({ ...current, place }))} />
          <Field testID="sighting-description-input" label="Recado (opcional)" multiline style={local.message} maxLength={REPORT_LIMITS.description} placeholder="Ex.: estava indo para a praça, sem coleira" value={sighting.description} onChangeText={(description) => setSighting((current) => ({ ...current, description }))} />
          {error !== null && <ErrorText>{error}</ErrorText>}
          <Button testID="sighting-send-button" label="Enviar avistamento" busy={busy} onPress={() => void sendSighting()} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  wideContent: { flexDirection: "row", alignItems: "flex-start", gap: 40, width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 40, paddingVertical: 32 },
  heroWide: { width: 440, height: 440, borderRadius: 28 },
  sheetWide: { flex: 1, marginTop: 0, paddingTop: 0, paddingHorizontal: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, maxWidth: undefined },
  hero: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroBar: { position: "absolute", left: space.xl, right: space.xl, flexDirection: "row", justifyContent: "space-between" },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sheet: { marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 22, paddingHorizontal: space.xl, gap: space.lg, width: "100%", maxWidth: 720, alignSelf: "center" },
  tag: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center" },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPrimary },
  name: { fontFamily: fonts.title, fontSize: 32, letterSpacing: -0.8, color: colors.ink, marginTop: -6 },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  facts: { gap: 10, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface },
  fact: { flexDirection: "row", alignItems: "center", gap: 10 },
  factText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  scanCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.dark },
  scanIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  scanTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onDark },
  scanText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.onDarkMuted },
  section: { fontFamily: fonts.titleBold, fontSize: 19, color: colors.ink },
  map: { height: 220, width: "100%", borderRadius: radius.card, overflow: "hidden" },
  sighting: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  sightingDot: { width: 12, height: 12, marginTop: 4, borderRadius: 6, backgroundColor: colors.brand },
  sightingTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  success: { fontFamily: fonts.bodySemibold, color: colors.success, fontSize: 15 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  overlay: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  modal: { maxHeight: "88%", flexGrow: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalContent: { padding: space.xl, gap: 14 },
  modalTitle: { fontFamily: fonts.title, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  message: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
});
