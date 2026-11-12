import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";

import { SESSION_FAILURE } from "../../src/api/http";
import { reportLost } from "../../src/api/reports";
import { apiUrl } from "../../src/config";
import type { MapPoint } from "../../src/map/mapHtml";
import { MapView } from "../../src/map/MapView";
import { REPORT_LIMITS, reportFailureMessage, toDetails, toOccurredAt } from "../../src/reports/form";
import { DateField } from "../../src/ui/DateField";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";
import { colors, fonts } from "../../src/ui/theme";

/** The owner registers that a pet is lost (RF-18), with the point on the map. */
export default function NewLostReport() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName: string }>();
  const { idToken } = useSession();
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [form, setForm] = useState({ place: "", description: "", occurredAt: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    // RN-70: o ponto é obrigatório.
    if (point === null) {
      setError("Toque no mapa onde o pet desapareceu.");
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
    <ScrollView contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.text}>Toque no mapa onde {petName} desapareceu.</Text>
      <MapView markers={[]} onPick={setPoint} style={local.map} />
      <Text testID="lost-point" style={local.point}>
        {point === null ? "Nenhum ponto escolhido." : "Ponto escolhido."}
      </Text>
      {/* RN-71: a data é opcional e não é futura; sem a data, vale hoje. */}
      <DateField testID="lost-date-input" label="Data do desaparecimento (opcional, sem data é hoje)" noFuture optional value={form.occurredAt} onChange={(occurredAt) => setForm((current) => ({ ...current, occurredAt }))} />
      <Text style={styles.label}>Local (opcional)</Text>
      <TextInput
        testID="lost-place-input"
        accessibilityLabel="Local"
        style={styles.input}
        maxLength={REPORT_LIMITS.place}
        value={form.place}
        onChangeText={(place) => setForm((current) => ({ ...current, place }))}
      />
      <Text style={styles.label}>Recado (opcional)</Text>
      <TextInput
        testID="lost-description-input"
        accessibilityLabel="Recado"
        style={[styles.input, local.message]}
        multiline
        maxLength={REPORT_LIMITS.description}
        value={form.description}
        onChangeText={(description) => setForm((current) => ({ ...current, description }))}
      />
      {error !== null && (
        <Text testID="lost-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID="lost-submit-button"
        accessibilityRole="button"
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.buttonText}>{busy ? "Enviando..." : "Publicar no mural"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { backgroundColor: colors.background, flexGrow: 1, padding: 16 },
  map: { height: 300, marginVertical: 8, width: "100%" },
  point: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14, marginBottom: 12 },
  message: { minHeight: 80, textAlignVertical: "top" },
});
