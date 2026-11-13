import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getNoseprint, type Noseprint } from "../../src/api/biometrics";
import { listUpcomingCare, type UpcomingCare } from "../../src/api/health";
import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import { getPet, type Pet } from "../../src/api/pets";
import { listMyReports, resolveReport, type Report } from "../../src/api/reports";
import { formatDateTime } from "../../src/biometrics/messages";
import { apiUrl } from "../../src/config";
import { petSubtitle } from "../../src/home/home";
import { healthChips, petFacts, type Chip } from "../../src/pets/profile";
import { openLostReportOf, reportFailureMessage } from "../../src/reports/form";
import { useSession } from "../../src/session/SessionContext";
import { Icon, ProfileArt } from "../../src/ui/Icon";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";

const chipColors: Record<Chip["tone"], string> = { ok: colors.success, warn: colors.link, late: colors.dangerText };

/** The profile of a pet (Pet artboard): its data, health, noseprint and lost report (RF-10, RF-18, RF-21). */
export default function PetProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { idToken } = useSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pet, setPet] = useState<Pet | null>(null);
  const [care, setCare] = useState<UpcomingCare[]>([]);
  // undefined: not read yet. null: none.
  const [noseprint, setNoseprint] = useState<Noseprint | null | undefined>(undefined);
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Read again when the owner comes back from the edit, the noseprint or the lost report.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await idToken();
        if (token === null) {
          setError(SESSION_FAILURE);
          return;
        }
        const [petResult, careResult, reports, nose] = await Promise.all([getPet(apiUrl, token, id), listUpcomingCare(apiUrl, token), listMyReports(apiUrl, token), getNoseprint(apiUrl, token, id)]);
        if (!petResult.ok) {
          setError(petResult.code === "pet_not_found" ? "Este pet não existe mais." : failureMessage(petResult));
          return;
        }
        setPet(petResult.value);
        setCare(careResult.ok ? careResult.value.filter((item) => item.petId === id) : []);
        setReport(reports.ok ? (openLostReportOf(reports.value, id) ?? null) : undefined);
        setNoseprint(nose.ok ? nose.value : undefined);
        setError(reports.ok ? null : reportFailureMessage(reports));
      })();
    }, [id, idToken]),
  );

  function confirmResolve(open: Report) {
    Alert.alert("Pet encontrado", `${pet?.name ?? "O pet"} voltou para casa? A ocorrência sai do mural.`, [
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

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  if (pet === null) {
    return (
      <View style={[local.page, { paddingTop: insets.top + space.lg, paddingHorizontal: space.xl, gap: space.lg }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={local.round} onPress={back}>
          <Icon name="back" size={20} />
        </Pressable>
        <Text testID="status-message" style={local.muted}>
          {error ?? "Carregando..."}
        </Text>
      </View>
    );
  }

  const facts = petFacts(pet);
  const chips = healthChips(pet, care);
  const health = () => router.push({ pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } });
  return (
    <ScrollView style={local.page} contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
      <View style={[local.hero, { height: 300 + insets.top }]}>
        <View style={[StyleSheet.absoluteFill, { top: insets.top }]}>
          <ProfileArt width={width} height={300} />
        </View>
        <View style={[local.photo, { top: 60 + insets.top }]}>
          {pet.photoUrl ? <Image testID="pet-photo" accessibilityLabel={`Foto de ${pet.name}`} source={{ uri: pet.photoUrl }} style={StyleSheet.absoluteFill} /> : <Icon name="camera" size={40} color={colors.onPrimary} />}
        </View>
        <Pressable testID="profile-back" accessibilityRole="button" accessibilityLabel="Voltar" style={[local.round, local.heroLeft, { top: 24 + insets.top }]} onPress={back}>
          <Icon name="back" size={20} />
        </Pressable>
        <Pressable
          testID="profile-more"
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
          style={[local.round, local.heroRight, { top: 24 + insets.top }]}
          onPress={() =>
            Alert.alert(pet.name, undefined, [
              { text: "Editar dados", onPress: () => router.push({ pathname: "/pets/edit/[id]", params: { id: pet.id } }) },
              { text: "Carteirinha", onPress: () => router.push({ pathname: "/share/[petId]", params: { petId: pet.id, petName: pet.name } }) },
              { text: "Cancelar", style: "cancel" },
            ])
          }
        >
          <Icon name="more" size={20} />
        </Pressable>
      </View>
      <View style={local.sheet}>
        <View style={local.nameRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={local.name} accessibilityRole="header">
              {pet.name}
            </Text>
            <Text style={local.muted}>{petSubtitle(pet)}</Text>
          </View>
          {report !== undefined && (
            <View testID="pet-status" style={local.pill}>
              <Text style={[local.pillText, { color: report ? colors.dangerText : colors.success }]}>{report ? "Perdido" : "Em casa"}</Text>
            </View>
          )}
        </View>
        {facts.length > 0 && (
          <View style={local.facts}>
            {facts.map((fact) => (
              <View key={fact.icon} style={local.fact}>
                <View style={local.factIcon}>
                  <Icon name={fact.icon} size={20} />
                </View>
                <Text style={local.factText}>{fact.label}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={local.section}>
          <View style={local.sectionHead}>
            <Text style={local.heading}>Saúde</Text>
            <Pressable testID="health-link" accessibilityRole="link" hitSlop={10} onPress={health}>
              <Text style={local.link}>Histórico</Text>
            </Pressable>
          </View>
          <View style={local.chips}>
            {chips.length === 0 ? (
              <Text style={local.muted}>Nenhum cuidado com data. Anote vacinas e remédios na saúde.</Text>
            ) : (
              chips.map((chip) => (
                <View key={chip.label} style={local.chip}>
                  <Text style={[local.chipText, { color: chipColors[chip.tone] }]}>{chip.label}</Text>
                </View>
              ))
            )}
          </View>
        </View>
        {/* RN-07: só um cachorro tem cadastro biométrico. */}
        {pet.species === "dog" && (
          <View style={local.section}>
            <View style={local.sectionHead}>
              <Text style={local.heading}>Focinho</Text>
              <Pressable testID="noseprint-link" accessibilityRole="link" hitSlop={10} onPress={() => router.push({ pathname: "/noseprint/[petId]", params: { petId: pet.id, petName: pet.name } })}>
                <Text style={local.link}>{noseprint ? "Recapturar" : "Cadastrar"}</Text>
              </Pressable>
            </View>
            {/* RN-86: a foto do focinho não é mostrada depois do cadastro. */}
            {noseprint ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={local.nose}>
                  <Icon name="check" size={20} strokeWidth={2.8} color={colors.onPrimary} />
                </View>
                <Text testID="noseprint-status" style={[local.muted, { flex: 1 }]}>
                  Cadastrado em {formatDateTime(noseprint.capturedAt).slice(0, 5)} · usado só para identificação
                </Text>
              </View>
            ) : (
              <Text testID="noseprint-status" style={local.muted}>
                {noseprint === null ? "Sem cadastro. Com o focinho, quem achar o cachorro encontra você." : "Carregando..."}
              </Text>
            )}
          </View>
        )}
        {error !== null && <ErrorText testID="lost-report-error">{error}</ErrorText>}
        {report !== undefined && (
          <View style={local.lostRow}>
            <Text style={[local.muted, { flex: 1 }]}>{report ? `No mural desde ${formatDateTime(report.occurredAt).slice(0, 5)}.` : `${pet.name} desapareceu?`}</Text>
            {report ? (
              <Pressable testID="resolve-lost-report-button" accessibilityRole="button" style={[local.outline, { borderColor: colors.success }]} onPress={() => confirmResolve(report)}>
                <Text style={[local.outlineText, { color: colors.success }]}>Ele voltou</Text>
              </Pressable>
            ) : (
              <Pressable testID="report-lost-link" accessibilityRole="button" style={local.outline} onPress={() => router.push({ pathname: "/reports/lost", params: { petId: pet.id, petName: pet.name } })}>
                <Text style={local.outlineText}>Marcar como perdido</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.brand, overflow: "hidden" },
  photo: { position: "absolute", alignSelf: "center", width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderStyle: "dashed", borderColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  heroLeft: { position: "absolute", left: 20 },
  heroRight: { position: "absolute", right: 20 },
  sheet: { marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 22, paddingHorizontal: space.xl, gap: space.lg },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  name: { fontFamily: fonts.title, fontSize: 32, letterSpacing: -0.8, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
  pill: { minHeight: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.surface, justifyContent: "center" },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  facts: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 22, backgroundColor: colors.surface },
  fact: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 6 },
  factIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  factText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  heading: { fontFamily: fonts.titleBold, fontSize: 19, color: colors.ink },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.link },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.surface, justifyContent: "center" },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  nose: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  lostRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14, borderTopWidth: 1.5, borderTopColor: colors.borderStrong },
  outline: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.danger, justifyContent: "center" },
  outlineText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.dangerText },
});
