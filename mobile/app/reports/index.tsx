import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Location as Point } from "../../src/api/alerts";
import { devicePosition, locationAllowed } from "../../src/alerts/deviceLocation";
import { listBoard, type BoardFilter, type Report, type ReportPage } from "../../src/api/reports";
import { apiUrl, webUrl } from "../../src/config";
import { speciesLabels } from "../../src/pets/labels";
import { MapView } from "../../src/map/MapView";
import { distanceKm, timeAgo } from "../../src/reports/board";
import { reportFailureMessage } from "../../src/reports/form";
import { useSession } from "../../src/session/SessionContext";
import { Button } from "../../src/ui/Button";
import { Icon } from "../../src/ui/Icon";
import { TabBar } from "../../src/ui/TabBar";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";
import { useWide } from "../../src/ui/useWide";

type Kind = "all" | Report["type"];
type Radius = NonNullable<BoardFilter["radiusKm"]>;

const kinds: { value: Kind; label: string; dot?: string }[] = [
  { value: "all", label: "Todos" },
  { value: "lost", label: "Perdidos", dot: colors.danger },
  { value: "found", label: "Achados", dot: colors.success },
];

/** The texts of a card of the board (Mural-Mobile artboard). */
function cardText(report: Report) {
  const lost = report.type === "lost";
  const species = report.petSpecies ? speciesLabels[report.petSpecies] : "Cachorro";
  return {
    tag: lost ? "Perdido" : "Achado",
    name: lost ? (report.petName ?? "Pet perdido") : `${species} achado`,
    info: [lost ? species : undefined, report.place, report.description].filter(Boolean).join(" · "),
    action: lost ? (report.petSpecies === "dog" ? "Vi este cachorro" : "Vi este pet") : "Pode ser o meu",
  };
}

/** The board (Mural-Mobile artboard): the open lost and found reports, as a list or a map, by type and radius (RF-16, RN-24). */
export default function Board() {
  const { state } = useSession();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>("all");
  const [radiusKm, setRadiusKm] = useState<Radius | null>(3);
  const [center, setCenter] = useState<Point | null | undefined>(undefined);
  const [view, setView] = useState<"list" | "map">("list");
  const [pages, setPages] = useState<ReportPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The radius needs the position of the device. Without it, the board shows everything.
  useEffect(() => {
    void (async () => {
      try {
        setCenter((await locationAllowed()) ? await devicePosition() : null);
      } catch {
        setCenter(null);
      }
    })();
  }, []);

  const filter: BoardFilter = { type: kind === "all" ? undefined : kind, center: center ?? undefined, radiusKm: center && radiusKm ? radiusKm : undefined };
  const load = useCallback(
    async (page: number) => {
      setBusy(true);
      const result = await listBoard(apiUrl, page, filter);
      if (result.ok) {
        setPages((current) => (page === 1 ? [result.value] : [...current, result.value]));
        setError(null);
      } else {
        setError(reportFailureMessage(result));
      }
      setBusy(false);
    },
    // The filter is made of these values.
    [kind, radiusKm, center],
  );

  // The board is read again when the screen gets the focus or the filter changes.
  useFocusEffect(
    useCallback(() => {
      if (center !== undefined) {
        void load(1);
      }
    }, [load, center]),
  );

  const last = pages[pages.length - 1];
  const reports = pages.flatMap((page) => page.reports);
  const open = (report: Report) => router.push({ pathname: "/reports/[id]", params: { id: report.id } });
  const where = (report: Report) => [timeAgo(report.createdAt), center ? `${distanceKm(center, report).toFixed(1).replace(".", ",")} km` : null].filter(Boolean).join(" · ");
  const chooseRadius = () => {
    if (!center) {
      Alert.alert("Localização", "Para ver só o que está perto, permita a localização do aparelho.");
      return;
    }
    Alert.alert("Raio de busca", undefined, [
      ...([1, 3, 5, 10] as Radius[]).map((value) => ({ text: `${value} km`, onPress: () => setRadiusKm(value) })),
      { text: "Todo o mural", onPress: () => setRadiusKm(null) },
    ]);
  };

  const card = (report: Report) => {
    const text = cardText(report);
    const lost = report.type === "lost";
    return (
      <View key={report.id} testID={`report-row-${report.id}`} style={[local.card, wide && local.cardWide]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${text.name}`} style={[local.photo, wide && local.photoWide, { backgroundColor: lost ? colors.brand : colors.accent }]} onPress={() => open(report)}>
          {report.photoUrl ? <Image source={{ uri: report.photoUrl }} style={StyleSheet.absoluteFill} /> : <Icon name="pin" size={30} color={colors.onPrimary} />}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[local.tag, { backgroundColor: lost ? colors.danger : colors.success }]}>
              <Text style={local.tagText}>{text.tag}</Text>
            </View>
            <Text style={local.muted} numberOfLines={1}>
              {where(report)}
            </Text>
          </View>
          <Text style={local.name} numberOfLines={1}>
            {text.name}
          </Text>
          {text.info !== "" && (
            <Text style={local.muted} numberOfLines={1}>
              {text.info}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Pressable testID={`report-action-${report.id}`} accessibilityRole="button" style={local.action} onPress={() => open(report)}>
              <Text style={local.actionText}>{text.action}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar" style={local.shareButton} onPress={() => void Share.share({ message: `${text.name}: ${webUrl}/reports/${report.id}` })}>
              <Icon name="share" size={18} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const filters = (
    <View style={local.filters}>
      {kinds.map((item) => {
        const selected = item.value === kind;
        return (
          <Pressable key={item.value} testID={`filter-${item.value}`} accessibilityRole="button" accessibilityState={{ selected }} style={[local.filter, selected && { backgroundColor: colors.dark }]} onPress={() => setKind(item.value)}>
            {item.dot && <View style={[local.dot, { backgroundColor: item.dot }]} />}
            <Text style={[local.filterText, selected && { color: colors.onDark }]}>{item.label}</Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      {Platform.OS === "web" ? (
        // React Native Web shows no Alert with buttons: the radius is a row of options.
        <View style={{ flexDirection: "row", gap: 6 }}>
          {center ? (
            ([1, 3, 5, 10, null] as (Radius | null)[]).map((value) => {
              const selected = radiusKm === value;
              return (
                <Pressable key={String(value)} testID={`radius-${value ?? "all"}`} accessibilityRole="button" accessibilityState={{ selected }} style={[local.filter, selected && { backgroundColor: colors.dark }]} onPress={() => setRadiusKm(value)}>
                  <Text style={[local.filterText, selected && { color: colors.onDark }]}>{value === null ? "Tudo" : `${value} km`}</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={local.muted}>Sem localização: o mural mostra tudo</Text>
          )}
        </View>
      ) : (
      <Pressable testID="radius" accessibilityRole="button" accessibilityLabel={center && radiusKm ? `Raio de busca: ${radiusKm} km` : "Raio de busca: todo o mural"} style={local.radius} onPress={chooseRadius}>
        <Text style={local.filterText}>{center && radiusKm ? `${radiusKm} km` : "Tudo"}</Text>
        <Icon name="chevronDown" size={14} />
      </Pressable>
      )}
    </View>
  );
  const countsText = last === undefined ? "" : center && radiusKm ? `${last.openLost} perdidos e ${last.openFound} achados em ${radiusKm} km` : `${last.openLost} perdidos e ${last.openFound} achados no mural`;

  if (wide) {
    // Mural-Web: the cards in two columns and the map beside them (#231).
    return (
      <View style={local.page}>
        <View style={local.wide}>
          <View style={{ gap: 4 }}>
            <Text style={local.wideTitle} accessibilityRole="header">
              Mural
            </Text>
            <Text testID="board-counts" style={local.muted}>
              {countsText}
            </Text>
          </View>
          {state.kind !== "ready" && (
            <View style={local.banner}>
              <View style={local.bannerIcon}>
                <Icon name="bell" size={18} color={colors.onPrimary} />
              </View>
              <Text style={[local.bannerText, { flex: 1 }]}>
                <Text style={{ fontFamily: fonts.bodyBold }}>Quer ser avisado quando um cachorro sumir perto de você?</Text> Com uma conta, você também consegue avisar o tutor.
              </Text>
              <Button label="Criar conta" size="sm" stretch={false} onPress={() => router.push({ pathname: "/sign-in", params: { mode: "create" } })} />
            </View>
          )}
          {filters}
          {error !== null && <ErrorText testID="board-error">{error}</ErrorText>}
          <View style={local.wideBody}>
            <ScrollView style={{ flex: 1.4 }} contentContainerStyle={local.wideGrid}>
              {last !== undefined && reports.length === 0 && (
                <Text testID="board-empty" style={local.muted}>
                  Nenhuma ocorrência aberta {center && radiusKm ? "neste raio" : "no mural"}.
                </Text>
              )}
              {reports.map((report) => (
                <View key={report.id} style={local.wideCell}>
                  {card(report)}
                </View>
              ))}
              {last?.hasNext && (
                <View style={{ width: "100%" }}>
                  <Button testID="board-more" label="Ver mais" variant="soft" size="md" disabled={busy} onPress={() => void load(last.page + 1)} />
                </View>
              )}
            </ScrollView>
            <View style={local.wideMap}>
              <MapView here={center ?? null} style={{ flex: 1 }} markers={reports.map((report) => ({ latitude: report.latitude, longitude: report.longitude, label: `${cardText(report).tag}: ${cardText(report).name}`, kind: "main" }))} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={local.page}>
      <View style={[local.header, { paddingTop: insets.top + space.md }]}>
        <View style={local.top}>
          {state.kind !== "ready" && router.canGoBack() && (
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={local.round} onPress={() => router.back()}>
              <Icon name="back" size={18} strokeWidth={2.4} />
            </Pressable>
          )}
          <Text style={local.title} accessibilityRole="header">
            Mural
          </Text>
          <View style={local.views} accessibilityRole="tablist">
            {(["list", "map"] as const).map((value) => {
              const selected = view === value;
              return (
                <Pressable key={value} testID={`view-${value}`} accessibilityRole="tab" accessibilityState={{ selected }} style={[local.viewTab, selected && { backgroundColor: colors.dark }]} onPress={() => setView(value)}>
                  <Icon name={value === "list" ? "menu" : "pin"} size={16} color={selected ? colors.onDark : colors.ink} />
                  <Text style={[local.viewText, selected && { color: colors.onDark }]}>{value === "list" ? "Lista" : "Mapa"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {filters}
      </View>

      {view === "list" ? (
        <ScrollView contentContainerStyle={local.content}>
          {last !== undefined && (
            <Text testID="board-counts" style={local.muted}>
              {countsText}
            </Text>
          )}
          {error !== null && <ErrorText testID="board-error">{error}</ErrorText>}
          {last !== undefined && reports.length === 0 && (
            <Text testID="board-empty" style={local.muted}>
              Nenhuma ocorrência aberta {center && radiusKm ? "neste raio" : "no mural"}.
            </Text>
          )}
          {reports.map(card)}
          {last?.hasNext && <Button testID="board-more" label="Ver mais" variant="soft" size="md" disabled={busy} onPress={() => void load(last.page + 1)} />}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={local.content}>
          {/* The map of ADR 0023. A tap on a marker shows the name of the report. */}
          <MapView here={center ?? null} style={local.map} markers={reports.map((report) => ({ latitude: report.latitude, longitude: report.longitude, label: `${cardText(report).tag}: ${cardText(report).name}`, kind: "main" }))} />
          {error !== null && <ErrorText testID="board-error">{error}</ErrorText>}
          {reports.map(card)}
        </ScrollView>
      )}

      {state.kind === "ready" ? (
        <TabBar />
      ) : (
        <View style={[local.visitor, { paddingBottom: insets.bottom + space.md }]}>
          <Button testID="visitor-sign-in" label="Entrar" variant="soft" size="md" stretch={false} onPress={() => router.push("/sign-in")} />
          <View style={{ flex: 1 }}>
            <Button testID="visitor-create" label="Criar conta e receber alertas" size="md" onPress={() => router.push({ pathname: "/sign-in", params: { mode: "create" } })} />
          </View>
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  wide: { flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 40, paddingTop: 28, paddingBottom: 24, gap: space.lg },
  wideTitle: { fontFamily: fonts.title, fontSize: 40, letterSpacing: -1.2, color: colors.ink },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.surface },
  bannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  bannerText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  wideBody: { flex: 1, flexDirection: "row", gap: 24, minHeight: 520 },
  wideGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingBottom: 24 },
  wideCell: { width: "48%" },
  cardWide: { flexDirection: "column", padding: 10 },
  photoWide: { width: "100%", minHeight: 0, height: 200 },
  wideMap: { flex: 1, borderRadius: radius.cardLarge, overflow: "hidden", minHeight: 520 },
  header: { paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.md, width: "100%", maxWidth: 720, alignSelf: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.title, fontSize: 30, letterSpacing: -0.8, color: colors.ink },
  views: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  viewTab: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill },
  viewText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  filters: { flexDirection: "row", alignItems: "center", gap: 6 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface },
  filterText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  radius: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center" },
  muted: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  card: { flexDirection: "row", gap: 12, padding: 10, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  photo: { width: 104, minHeight: 120, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  tag: { minHeight: 24, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: "center" },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onPrimary },
  name: { fontFamily: fonts.titleBold, fontSize: 18, color: colors.ink },
  action: { flex: 1, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.dark, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onDark },
  shareButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  map: { height: 360, borderRadius: radius.cardLarge, overflow: "hidden" },
  visitor: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
