import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { devicePosition, locationAllowed } from "../src/alerts/deviceLocation";
import { sendLocation } from "../src/alerts/location";
import { listNotifications, setMyLocation } from "../src/api/alerts";
import { getNoseprint } from "../src/api/biometrics";
import { listHealthEvents, listUpcomingCare, type UpcomingCare } from "../src/api/health";
import { failureMessage, SESSION_FAILURE } from "../src/api/http";
import { listPets, type Pet } from "../src/api/pets";
import { apiUrl } from "../src/config";
import { AnotarSheet } from "../src/health/AnotarSheet";
import { careLine, dateTile } from "../src/health/care";
import { petSubtitle, pickPet, unreadCount, weightTrend } from "../src/home/home";
import { PetSwitcher } from "../src/home/PetSwitcher";
import { useSelectedPet } from "../src/pets/SelectedPetContext";
import { useSession } from "../src/session/SessionContext";
import { Button } from "../src/ui/Button";
import { Icon, WeightChart } from "../src/ui/Icon";
import { TabBar } from "../src/ui/TabBar";
import { Body, ErrorText, Heading, Muted, Title } from "../src/ui/Text";
import { colors, fonts, radius, space } from "../src/ui/theme";

// The first-pet screen (AddPet-Primeiro) opens one time per run of the app.
let firstPetOffered = false;

/** The home of the owner (Inicio-Mobile artboard): the chosen pet, its next care (RF-29) and its weight. */
export default function Home() {
  const { state, idToken } = useSession();
  const { savedId, select } = useSelectedPet();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [care, setCare] = useState<UpcomingCare[]>([]);
  const [unread, setUnread] = useState(0);
  const [noseprints, setNoseprints] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<{ date: string; weightKg?: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [switcher, setSwitcher] = useState(false);
  // The quick access to a new health record (Saude-Mobile-Registrar sheet).
  const [anotar, setAnotar] = useState(false);
  const [loads, setLoads] = useState(0);
  const pet = pickPet(pets ?? [], savedId);

  const load = useCallback(async () => {
    const token = await idToken();
    if (token === null) {
      setError(SESSION_FAILURE);
      return;
    }
    const [result, upcoming, notifications] = await Promise.all([listPets(apiUrl, token), listUpcomingCare(apiUrl, token), listNotifications(apiUrl, token)]);
    if (upcoming.ok) {
      setCare(upcoming.value);
    }
    if (notifications.ok) {
      setUnread(unreadCount(notifications.value));
    }
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    setPets(result.value);
    // The weight chart is read again too: a weight saved from the home must show.
    setLoads((count) => count + 1);
    setError(null);
    if (result.value.length === 0 && !firstPetOffered) {
      firstPetOffered = true;
      router.push({ pathname: "/pets/new", params: { first: "1" } });
    }
    // The noseprint badge of each dog, for the home and the pet switcher.
    const dogs = result.value.filter((item) => item.species === "dog");
    const found = await Promise.all(dogs.map((item) => getNoseprint(apiUrl, token, item.id)));
    setNoseprints(Object.fromEntries(dogs.map((item, i) => [item.id, found[i].ok && found[i].value !== null])));
  }, [idToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The weight chart reads the events of the chosen pet (RN-51), at each load of the home.
  useEffect(() => {
    if (pet === null) {
      return;
    }
    select({ id: pet.id, name: pet.name });
    void (async () => {
      const token = await idToken();
      const events = token === null ? null : await listHealthEvents(apiUrl, token, pet.id);
      setWeights(events?.ok ? events.value : []);
    })();
  }, [pet?.id, pet?.name, idToken, select, loads]);

  // RF-22: the app sends the position of the device one time when it opens.
  useEffect(() => {
    void sendLocation({
      allowed: locationAllowed,
      position: devicePosition,
      send: async (location) => {
        const token = await idToken();
        return token === null ? { ok: false, code: "network" } : setMyLocation(apiUrl, token, location);
      },
    });
  }, [idToken]);

  const next = pet === null ? undefined : care.find((item) => item.petId === pet.id);
  const trend = weightTrend(weights);

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.lg }]}>
        <View style={local.top}>
          {pet !== null ? (
            <Pressable testID="pet-switcher" accessibilityRole="button" accessibilityLabel="Trocar de pet" style={local.switcher} onPress={() => setSwitcher(true)}>
              {pet.photoUrl ? <Image source={{ uri: pet.photoUrl }} style={local.switcherPhoto} /> : <View style={[local.switcherPhoto, local.photoEmpty]}><Text style={local.initialSmall}>{pet.name.slice(0, 1).toUpperCase()}</Text></View>}
              <Text style={local.switcherName}>{pet.name}</Text>
              <Icon name="chevronDown" size={16} strokeWidth={2.2} />
            </Pressable>
          ) : (
            state.kind === "ready" && <Title testID="home-greeting">Olá, {state.owner.name}</Title>
          )}
          <View style={{ flex: 1 }} />
          <Pressable testID="notifications-bell" accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"} style={local.bell} onPress={() => router.push("/notifications")}>
            <Icon name="bell" size={22} strokeWidth={1.9} />
            {unread > 0 && (
              <View style={local.unread}>
                <Text style={local.unreadText}>{unread}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {error !== null && <ErrorText testID="pet-list-error">{error}</ErrorText>}

        {pets !== null && pet === null && (
          <View style={{ gap: space.md }}>
            <View style={local.emptyCard}>
              <Body testID="pet-list-empty" style={{ color: colors.textSecondary }}>
                Você ainda não cadastrou nenhum pet.
              </Body>
            </View>
            <Button testID="new-pet-button" label="Adicionar pet" icon="plus" onPress={() => router.push("/pets/new")} />
          </View>
        )}

        {pet !== null && (
          <View style={{ gap: space.md }}>
            <Pressable testID={`pet-row-${pet.name}`} accessibilityRole="button" accessibilityLabel={`Abrir o perfil de ${pet.name}`} onPress={() => router.push({ pathname: "/pets/[id]", params: { id: pet.id } })}>
              {pet.photoUrl ? (
                <Image testID={`pet-photo-${pet.name}`} accessibilityLabel={`Foto de ${pet.name}`} source={{ uri: pet.photoUrl }} style={local.hero} />
              ) : (
                <View style={[local.hero, local.heroEmpty]}>
                  <Text style={local.heroInitial}>{pet.name.slice(0, 1).toUpperCase()}</Text>
                  <Muted>Toque para pôr uma foto</Muted>
                </View>
              )}
            </Pressable>
            <View style={local.identity}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={local.nameRow}>
                  <Title style={{ fontSize: 28, lineHeight: 30 }}>{pet.name}</Title>
                  {noseprints[pet.id] === true && (
                    <View accessibilityRole="image" accessibilityLabel="Focinho cadastrado" style={local.badge}>
                      <Icon name="check" size={12} strokeWidth={3.2} color={colors.onPrimary} />
                    </View>
                  )}
                </View>
                <Muted>{petSubtitle(pet)}</Muted>
              </View>
              <Button testID="open-card" label="Carteirinha" icon="card" variant="dark" size="md" stretch={false} onPress={() => router.push({ pathname: "/share/[petId]", params: { petId: pet.id, petName: pet.name } })} />
            </View>
            <Pressable testID="report-lost-link" accessibilityRole="button" style={local.lostRow} onPress={() => router.push({ pathname: "/reports/lost", params: { petId: pet.id, petName: pet.name } })}>
              <Icon name="alert" size={20} color={colors.danger} />
              <Text style={local.lostText}>
                {pet.name} sumiu? <Text style={local.lostStrong}>Avisar desaparecimento</Text>
              </Text>
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={local.sectionHead}>
              <Heading>Próximo cuidado</Heading>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button testID="home-anotar" label="Anotar" icon="plus" variant="soft" size="sm" stretch={false} onPress={() => setAnotar(true)} />
                <Button testID="open-health" label="Ver agenda" icon="calendar" variant="dark" size="sm" stretch={false} onPress={() => router.push({ pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } })} />
              </View>
            </View>
            {next !== undefined ? (
              <Pressable testID="upcoming-care" accessibilityRole="button" style={local.careRow} onPress={() => router.push({ pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } })}>
                <View style={local.tile}>
                  <Text style={local.tileMonth}>{dateTile(next.dueDate).month}</Text>
                  <Text style={local.tileDay}>{dateTile(next.dueDate).day}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={local.careTitle}>{next.title}</Text>
                  <Muted>{careLine(next.dueDate)}</Muted>
                </View>
                <Icon name="chevronRight" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" style={local.careEmpty} onPress={() => router.push({ pathname: "/health/[petId]", params: { petId: pet.id, petName: pet.name } })}>
                <View style={local.careEmptyIcon}>
                  <Icon name="calendar" size={20} />
                </View>
                <Text style={local.careEmptyText}>Registre vacinas e consultas para receber lembretes.</Text>
              </Pressable>
            )}

            <View testID="weight-card" style={local.weight}>
              <View style={local.weightHead}>
                <Text style={local.weightLabel}>Peso</Text>
                <Text style={local.weightValue}>{trend?.latest ?? (pet.weightKg !== undefined ? `${String(pet.weightKg).replace(".", ",")} kg` : "—")}</Text>
                {trend?.change && <Text style={local.weightChange}>{trend.change}</Text>}
                <View style={{ flex: 1 }} />
                <Pressable testID="add-weight" accessibilityRole="button" accessibilityLabel="Registrar peso" style={local.plus} onPress={() => router.push({ pathname: "/health/event", params: { petId: pet.id, petName: pet.name, type: "note", preset: "weight" } })}>
                  <Icon name="plus" size={18} strokeWidth={2.2} />
                </Pressable>
              </View>
              {trend !== null && trend.points.length > 1 ? (
                <WeightChart points={trend.points} width={width - space.xl * 2 - 32} />
              ) : (
                <Muted>Registre o peso numa consulta ou numa anotação para ver o gráfico.</Muted>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      <TabBar />
      {pet !== null && (
        <AnotarSheet
          visible={anotar}
          petName={pet.name}
          onClose={() => setAnotar(false)}
          onPick={(type, preset) => {
            setAnotar(false);
            router.push({ pathname: "/health/event", params: { petId: pet.id, petName: pet.name, type, ...(preset ? { preset } : {}) } });
          }}
        />
      )}
      <PetSwitcher
        visible={switcher}
        pets={pets ?? []}
        noseprints={noseprints}
        selectedId={pet?.id ?? null}
        onPick={(item) => {
          select({ id: item.id, name: item.name });
          setSwitcher(false);
        }}
        onAdd={() => {
          setSwitcher(false);
          router.push("/pets/new");
        }}
        onManage={() => {
          setSwitcher(false);
          if (pet !== null) {
            router.push({ pathname: "/pets/[id]", params: { id: pet.id } });
          }
        }}
        onClose={() => setSwitcher(false)}
      />
    </View>
  );
}

const local = StyleSheet.create({
  page: { backgroundColor: colors.background, flex: 1 },
  content: { gap: space.lg, paddingBottom: space.xl, paddingHorizontal: space.xl },
  top: { alignItems: "center", flexDirection: "row", gap: 10 },
  switcher: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill, flexDirection: "row", gap: 10, height: 48, paddingLeft: 4, paddingRight: 14 },
  switcherPhoto: { borderRadius: 20, height: 40, width: 40 },
  switcherName: { color: colors.ink, fontFamily: fonts.titleBold, fontSize: 18 },
  photoEmpty: { alignItems: "center", backgroundColor: colors.background, justifyContent: "center" },
  initialSmall: { color: colors.primary, fontFamily: fonts.title, fontSize: 18 },
  bell: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  unread: { alignItems: "center", backgroundColor: colors.primary, borderColor: colors.surface, borderRadius: 9, borderWidth: 2, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 3, position: "absolute", right: 7, top: 8 },
  unreadText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 10 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg },
  hero: { borderRadius: 26, height: 168, width: "100%" },
  heroEmpty: { alignItems: "center", backgroundColor: colors.surface, gap: 4, justifyContent: "center" },
  heroInitial: { color: colors.primary, fontFamily: fonts.title, fontSize: 56 },
  identity: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 4 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  badge: { alignItems: "center", backgroundColor: colors.success, borderRadius: 11, height: 22, justifyContent: "center", width: 22 },
  lostRow: { alignItems: "center", borderColor: colors.borderStrong, borderRadius: 16, borderWidth: 1.5, flexDirection: "row", gap: 12, minHeight: 48, paddingHorizontal: 16 },
  lostText: { color: colors.ink, flex: 1, fontFamily: fonts.body, fontSize: 15 },
  lostStrong: { color: colors.dangerText, fontFamily: fonts.bodyBold },
  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  careRow: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: "row", gap: 14, padding: 8, paddingRight: 12 },
  tile: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, height: 52, justifyContent: "center", width: 50 },
  tileMonth: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  tileDay: { color: colors.onPrimary, fontFamily: fonts.title, fontSize: 21, lineHeight: 24 },
  careTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 16 },
  careEmpty: { alignItems: "center", borderColor: "#E3E2DF", borderRadius: radius.card, borderStyle: "dashed", borderWidth: 2, flexDirection: "row", gap: 14, padding: 8 },
  careEmptyIcon: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, height: 50, justifyContent: "center", width: 50 },
  careEmptyText: { color: colors.textSecondary, flex: 1, fontFamily: fonts.body, fontSize: 15 },
  weight: { backgroundColor: colors.surface, borderRadius: 22, gap: 6, padding: 16, paddingBottom: 10 },
  weightHead: { alignItems: "center", flexDirection: "row", gap: 8 },
  weightLabel: { color: colors.ink, fontFamily: fonts.titleBold, fontSize: 17 },
  weightValue: { color: colors.ink, fontFamily: fonts.title, fontSize: 22, letterSpacing: -0.5, marginLeft: 4 },
  weightChange: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 13 },
  plus: { alignItems: "center", backgroundColor: colors.background, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
});
