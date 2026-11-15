import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SESSION_FAILURE } from "../../src/api/http";
import { reportLost } from "../../src/api/reports";
import { apiUrl } from "../../src/config";
import type { MapPoint } from "../../src/map/mapHtml";
import { PickMap } from "../../src/map/PickMap";
import { REPORT_LIMITS, reportFailureMessage, toDetails, toOccurredAt } from "../../src/reports/form";
import { useSession } from "../../src/session/SessionContext";
import { Button } from "../../src/ui/Button";
import { DateField } from "../../src/ui/DateField";
import { Field } from "../../src/ui/Field";
import { Icon } from "../../src/ui/Icon";
import { ErrorText, Label } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";

/** The owner registers that a pet is lost (RF-18), with the point on the map, in the layout of the canvas forms (#243). */
export default function NewLostReport() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName: string }>();
  const { idToken } = useSession();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [form, setForm] = useState({ place: "", description: "", occurredAt: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    // RN-70: o ponto é obrigatório.
    if (point === null) {
      setError(`Toque no mapa onde ${petName} desapareceu.`);
      return;
    }
    const details = toDetails(form);
    if (!details.ok) {
      setError(details.message);
      return;
    }
    const occurred = toOccurredAt(form.occurredAt);
    if (!occurred.ok) {
      setError(occurred.message);
      return;
    }
    setBusy(true);
    setError(null);
    const token = await idToken();
    const result = token === null ? null : await reportLost(apiUrl, token, { petId, ...point, ...details.details, occurredAt: occurred.value });
    setBusy(false);
    if (result === null) {
      setError(SESSION_FAILURE);
    } else if (result.ok) {
      router.replace({ pathname: "/reports/[id]", params: { id: result.value.id } });
    } else {
      setError(reportFailureMessage(result));
    }
  }

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.md }]} keyboardShouldPersistTaps="handled">
        <View style={local.top}>
          <Pressable testID="close-lost" accessibilityRole="button" accessibilityLabel="Fechar" style={local.close} onPress={() => router.back()}>
            <Icon name="close" size={18} strokeWidth={2.4} />
          </Pressable>
          <View style={local.petChip}>
            <Text style={local.petName}>{petName}</Text>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={local.heading} accessibilityRole="header">
            {petName} sumiu
          </Text>
          <Text style={local.lead}>O aviso entra no mural, e quem tem o app perto do ponto recebe um alerta.</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Label>Onde foi visto pela última vez</Label>
          <View style={local.mapFrame}>
            <PickMap onPick={setPoint} style={local.map} />
          </View>
          <View testID="lost-point" style={local.pointRow}>
            <Icon name={point === null ? "pin" : "check"} size={16} strokeWidth={2.4} color={point === null ? colors.textMuted : colors.success} />
            <Text style={[local.pointText, point !== null && { color: colors.success }]}>{point === null ? "Toque no mapa para marcar o ponto." : "Ponto marcado."}</Text>
          </View>
        </View>

        {/* RN-71: a data é opcional e não é futura; sem a data, vale hoje. */}
        <DateField testID="lost-date-input" label="Quando (sem data, vale hoje)" noFuture optional value={form.occurredAt} onChange={(occurredAt) => setForm((current) => ({ ...current, occurredAt }))} />
        <Field testID="lost-place-input" label="Local (opcional)" placeholder="Ex.: perto da praça" maxLength={REPORT_LIMITS.place} value={form.place} onChangeText={(place) => setForm((current) => ({ ...current, place }))} />
        <Field
          testID="lost-description-input"
          label="Recado (opcional)"
          placeholder="Ex.: coleira azul, tem medo de moto"
          multiline
          style={local.long}
          maxLength={REPORT_LIMITS.description}
          value={form.description}
          onChangeText={(description) => setForm((current) => ({ ...current, description }))}
        />
      </ScrollView>
      {/* The message stays next to the button: the end of the form can be out of the screen. */}
      <View style={[local.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {error !== null && (
          <ErrorText testID="lost-error" accessibilityRole="alert">
            {error}
          </ErrorText>
        )}
        <Button testID="lost-submit-button" label="Publicar no mural" icon="alert" variant="danger" busy={busy} onPress={() => void submit()} />
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 18 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  petChip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center" },
  petName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  heading: { fontFamily: fonts.title, fontSize: 28, letterSpacing: -0.8, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  mapFrame: { borderRadius: 22, overflow: "hidden", backgroundColor: colors.surface },
  map: { height: 260, width: "100%" },
  pointRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  pointText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textMuted },
  long: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, gap: 10, backgroundColor: colors.background },
});
