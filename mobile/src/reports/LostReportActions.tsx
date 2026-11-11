import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { SESSION_FAILURE } from "../api/http";
import { listMyReports, resolveReport, type Report } from "../api/reports";
import { formatDateTime } from "../biometrics/messages";
import { apiUrl } from "../config";
import { styles } from "../screens/styles";
import { useSession } from "../session/SessionContext";
import { openLostReportOf, reportFailureMessage } from "./form";

/**
 * The lost report of a pet, on the screen of the pet: the action to
 * register it (RF-18), or the open report with the action to resolve it
 * (RF-21).
 */
export function LostReportActions({ petId, petName }: { petId: string; petName: string }) {
  const { idToken } = useSession();
  // undefined: not read yet. null: the pet has no open lost report.
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Read again when the owner comes back from the form of the report.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await idToken();
        const result = token === null ? null : await listMyReports(apiUrl, token);
        if (result === null) {
          setError(SESSION_FAILURE);
        } else if (result.ok) {
          setReport(openLostReportOf(result.value, petId) ?? null);
        } else {
          setError(reportFailureMessage(result));
        }
      })();
    }, [idToken, petId]),
  );

  function confirmResolve(open: Report) {
    Alert.alert("Pet encontrado", `${petName} voltou para casa? A ocorrência sai do mural.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sim, voltou",
        onPress: async () => {
          const token = await idToken();
          const result = token === null ? null : await resolveReport(apiUrl, token, open.id);
          if (result === null) {
            setError(SESSION_FAILURE);
          } else if (result.ok) {
            setReport(null);
          } else {
            setError(reportFailureMessage(result));
          }
        },
      },
    ]);
  }

  return (
    <View>
      {report === null && (
        <Pressable
          testID="report-lost-link"
          accessibilityRole="button"
          style={styles.link}
          onPress={() => router.push({ pathname: "/reports/lost", params: { petId, petName } })}
        >
          <Text style={styles.linkText}>Registrar desaparecimento</Text>
        </Pressable>
      )}
      {report && (
        <>
          <Pressable
            testID="open-lost-report-link"
            accessibilityRole="button"
            style={styles.link}
            onPress={() => router.push({ pathname: "/reports/[id]", params: { id: report.id } })}
          >
            <Text style={styles.linkText}>Desaparecido desde {formatDateTime(report.occurredAt)}: ver no mural</Text>
          </Pressable>
          <Pressable testID="resolve-lost-report-button" accessibilityRole="button" style={styles.link} onPress={() => confirmResolve(report)}>
            <Text style={styles.linkText}>Marcar como encontrado</Text>
          </Pressable>
        </>
      )}
      {error !== null && (
        <Text testID="lost-report-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
