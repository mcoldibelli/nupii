import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { failureMessage, SESSION_FAILURE } from "../src/api/http";
import { setMyLocation } from "../src/api/alerts";
import { listUpcomingCare, type UpcomingCare } from "../src/api/health";
import { careWhen, dateTile } from "../src/health/care";
import { listPets, type Pet } from "../src/api/pets";
import { devicePosition, locationAllowed } from "../src/alerts/deviceLocation";
import { sendLocation } from "../src/alerts/location";
import { apiUrl } from "../src/config";
import { speciesLabels } from "../src/pets/labels";
import { useSession } from "../src/session/SessionContext";
import { Button } from "../src/ui/Button";
import { Icon } from "../src/ui/Icon";
import { Card } from "../src/ui/Surfaces";
import { TabBar } from "../src/ui/TabBar";
import { Body, ErrorText, Heading, Muted, Title } from "../src/ui/Text";
import { colors, fonts, radius, space } from "../src/ui/theme";

/** The home: the upcoming care (RF-29) and the pets of the owner (RF-09). The look is the Inicio-Mobile artboard. */
export default function PetList() {
  const { state, idToken } = useSession();
  const insets = useSafeAreaInsets();
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [care, setCare] = useState<UpcomingCare[]>([]);

  const load = useCallback(async () => {
    const token = await idToken();
    if (token === null) {
      setError(SESSION_FAILURE);
      return;
    }
    const [result, upcoming] = await Promise.all([listPets(apiUrl, token), listUpcomingCare(apiUrl, token)]);
    // RF-29: the next care of the pets, on the first screen.
    if (upcoming.ok) {
      setCare(upcoming.value);
    }
    if (result.ok) {
      setPets(result.value);
      setError(null);
    } else {
      setError(failureMessage(result));
    }
  }, [idToken]);

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

  // The list is read each time the screen gets the focus, also after the
  // owner comes back from the form.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.lg }]}>
        {state.kind === "ready" && (
          <View>
            <Muted>Meus pets</Muted>
            <Title testID="home-greeting">Olá, {state.owner.name}</Title>
          </View>
        )}
        {care.length > 0 && (
          <View testID="upcoming-care" style={{ gap: 10 }}>
            <Heading>Próximos cuidados</Heading>
            {care.map((item) => {
              const tile = dateTile(item.dueDate);
              return (
                <View key={item.eventId} style={local.careRow}>
                  <View style={local.tile}>
                    <Text style={local.tileMonth}>{tile.month}</Text>
                    <Text style={local.tileDay}>{tile.day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={local.careTitle}>{item.title}</Text>
                    <Muted>
                      {item.petName} · {careWhen(item.dueDate)}
                    </Muted>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {error !== null && <ErrorText testID="pet-list-error">{error}</ErrorText>}
        <View style={{ gap: 10 }}>
          <Heading>Pets</Heading>
          {pets !== null && pets.length === 0 && (
            <Card>
              <Body testID="pet-list-empty" style={{ color: colors.textSecondary }}>
                Você ainda não cadastrou nenhum pet.
              </Body>
            </Card>
          )}
          {(pets ?? []).map((item) => (
            <Pressable
              key={item.id}
              testID={`pet-row-${item.name}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${speciesLabels[item.species]}`}
              style={local.petRow}
              onPress={() => router.push({ pathname: "/pets/[id]", params: { id: item.id } })}
            >
              {item.photoUrl ? (
                <Image testID={`pet-photo-${item.name}`} accessibilityLabel={`Foto de ${item.name}`} source={{ uri: item.photoUrl }} style={local.photo} />
              ) : (
                <View style={[local.photo, local.photoEmpty]}>
                  <Text style={local.initial}>{item.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={local.name}>{item.name}</Text>
                <Muted>{speciesLabels[item.species]}</Muted>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
        <Button testID="new-pet-button" label="Novo pet" icon="plus" variant="dark" size="md" onPress={() => router.push("/pets/new")} />
        <Pressable testID="found-notices-link" accessibilityRole="button" style={local.linkRow} onPress={() => router.push("/found-notices")}>
          <Icon name="alert" size={20} color={colors.ink} />
          <Text style={local.linkText}>Avisos de encontro</Text>
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
      <TabBar />
    </View>
  );
}

const local = StyleSheet.create({
  page: { backgroundColor: colors.background, flex: 1 },
  content: { gap: space.xl, paddingBottom: space.xl, paddingHorizontal: space.xl },
  careRow: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: "row", gap: 14, padding: 8, paddingRight: 12 },
  tile: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, height: 52, justifyContent: "center", width: 50 },
  tileMonth: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  tileDay: { color: colors.onPrimary, fontFamily: fonts.title, fontSize: 21, lineHeight: 24 },
  careTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 16 },
  petRow: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: "row", gap: 12, minHeight: 64, padding: 10, paddingRight: 14 },
  photo: { borderRadius: 24, height: 48, width: 48 },
  photoEmpty: { alignItems: "center", backgroundColor: colors.background, justifyContent: "center" },
  initial: { color: colors.primary, fontFamily: fonts.title, fontSize: 20 },
  name: { color: colors.ink, fontFamily: fonts.titleBold, fontSize: 18 },
  linkRow: { alignItems: "center", borderColor: colors.borderStrong, borderRadius: 16, borderWidth: 1.5, flexDirection: "row", gap: 12, minHeight: 48, paddingHorizontal: 16 },
  linkText: { color: colors.ink, flex: 1, fontFamily: fonts.body, fontSize: 15 },
});
