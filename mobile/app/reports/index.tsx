import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { listBoard, type ReportPage } from "../../src/api/reports";
import { formatDateTime } from "../../src/biometrics/messages";
import { apiUrl } from "../../src/config";
import { reportFailureMessage, reportTitle } from "../../src/reports/form";
import { speciesLabels } from "../../src/pets/labels";
import { styles } from "../../src/screens/styles";
import { colors, fonts } from "../../src/ui/theme";
import { TabBar } from "../../src/ui/TabBar";

/** The board: the open lost and found reports (RF-16, RN-24). */
export default function Board() {
  const [pages, setPages] = useState<ReportPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (page: number) => {
    setBusy(true);
    const result = await listBoard(apiUrl, page);
    if (result.ok) {
      setPages((current) => (page === 1 ? [result.value] : [...current, result.value]));
      setError(null);
    } else {
      setError(reportFailureMessage(result));
    }
    setBusy(false);
  }, []);

  // The board is read again each time the screen gets the focus.
  useFocusEffect(
    useCallback(() => {
      void load(1);
    }, [load]),
  );

  const last = pages[pages.length - 1];
  const reports = pages.flatMap((page) => page.reports);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={local.screen}>
      {last !== undefined && (
        <Text testID="board-counts" style={local.counts}>
          {last.openLost} perdidos e {last.openFound} achados no mural
        </Text>
      )}
      {error !== null && (
        <Text testID="board-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={reports}
        keyExtractor={(report) => report.id}
        ListEmptyComponent={
          last === undefined ? undefined : (
            <Text testID="board-empty" style={styles.text}>
              Nenhuma ocorrência aberta.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`report-row-${item.id}`}
            accessibilityRole="button"
            style={local.row}
            onPress={() => router.push({ pathname: "/reports/[id]", params: { id: item.id } })}
          >
            {item.photoUrl ? (
              <Image accessibilityLabel={reportTitle(item)} source={{ uri: item.photoUrl }} style={local.photo} />
            ) : (
              <View style={[local.photo, local.photoEmpty]} />
            )}
            <View style={local.rowText}>
              <Text style={local.title}>{reportTitle(item)}</Text>
              {item.petSpecies !== undefined && (
                <Text style={local.line}>
                  {speciesLabels[item.petSpecies]}
                  {item.petHasNoseprint ? ", com focinho cadastrado" : ""}
                </Text>
              )}
              {item.place !== undefined && <Text style={local.line}>{item.place}</Text>}
              <Text style={local.line}>{formatDateTime(item.occurredAt)}</Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          last?.hasNext ? (
            <Pressable testID="board-more" accessibilityRole="button" style={styles.link} disabled={busy} onPress={() => load(last.page + 1)}>
              <Text style={styles.linkText}>Ver mais</Text>
            </Pressable>
          ) : undefined
        }
      />
    </View>
      <TabBar />
    </View>
  );
}

const local = StyleSheet.create({
  screen: { alignSelf: "center", backgroundColor: colors.background, flex: 1, maxWidth: 720, padding: 20, width: "100%" },
  counts: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14, marginBottom: 8 },
  row: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 20, flexDirection: "row", gap: 12, marginBottom: 8, minHeight: 72, padding: 10 },
  rowText: { flex: 1 },
  photo: { borderRadius: 28, height: 56, width: 56 },
  photoEmpty: { backgroundColor: colors.background },
  title: { color: colors.ink, fontSize: 17, fontFamily: fonts.titleBold },
  line: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14 },
});
