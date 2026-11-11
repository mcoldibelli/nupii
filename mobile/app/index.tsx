import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { failureMessage, SESSION_FAILURE } from "../src/api/http";
import { setMyLocation } from "../src/api/alerts";
import { listUpcomingCare, type UpcomingCare } from "../src/api/health";
import { careText } from "../src/health/care";
import { listPets, type Pet } from "../src/api/pets";
import { devicePosition, locationAllowed } from "../src/alerts/deviceLocation";
import { sendLocation } from "../src/alerts/location";
import { apiUrl } from "../src/config";
import { speciesLabels } from "../src/pets/labels";
import { styles } from "../src/screens/styles";
import { useSession } from "../src/session/SessionContext";

/** The list of the pets of the owner (RF-09). */
export default function PetList() {
  const { state, idToken, signOut } = useSession();
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
      setCare(upcoming.value.slice(0, 3));
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
    <View style={local.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable testID="sign-out-button" accessibilityRole="button" onPress={signOut}>
              <Text style={styles.linkText}>Sair</Text>
            </Pressable>
          ),
        }}
      />
      {state.kind === "ready" && (
        <Text testID="home-greeting" style={local.greeting}>
          Olá, {state.owner.name}
        </Text>
      )}
      {care.length > 0 && (
        <View testID="upcoming-care" style={local.care}>
          <Text style={local.careTitle}>Próximos cuidados</Text>
          {care.map((item) => (
            <Text key={item.eventId} style={local.careLine}>
              {careText(item)}
            </Text>
          ))}
        </View>
      )}
      {error !== null && (
        <Text testID="pet-list-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={pets ?? []}
        keyExtractor={(pet) => pet.id}
        ListEmptyComponent={
          pets === null ? undefined : (
            <Text testID="pet-list-empty" style={styles.text}>
              Você ainda não cadastrou nenhum pet.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`pet-row-${item.name}`}
            accessibilityRole="button"
            style={local.row}
            onPress={() => router.push({ pathname: "/pets/[id]", params: { id: item.id } })}
          >
            {item.photoUrl ? (
              <Image
                testID={`pet-photo-${item.name}`}
                accessibilityLabel={`Foto de ${item.name}`}
                source={{ uri: item.photoUrl }}
                style={local.photo}
              />
            ) : (
              <View style={[local.photo, local.photoEmpty]} />
            )}
            <View>
              <Text style={local.name}>{item.name}</Text>
              <Text style={local.species}>{speciesLabels[item.species]}</Text>
            </View>
          </Pressable>
        )}
      />
      <Pressable testID="notifications-link" accessibilityRole="button" style={styles.link} onPress={() => router.push("/notifications")}>
        <Text style={styles.linkText}>Notificações</Text>
      </Pressable>
      <Pressable testID="board-link" accessibilityRole="button" style={styles.link} onPress={() => router.push("/reports")}>
        <Text style={styles.linkText}>Mural de perdidos e achados</Text>
      </Pressable>
      <Pressable testID="found-notices-link" accessibilityRole="button" style={styles.link} onPress={() => router.push("/found-notices")}>
        <Text style={styles.linkText}>Avisos de encontro</Text>
      </Pressable>
      <Pressable testID="new-pet-button" accessibilityRole="button" style={styles.button} onPress={() => router.push("/pets/new")}>
        <Text style={styles.buttonText}>Novo pet</Text>
      </Pressable>
    </View>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: "#fff", flex: 1, padding: 24 },
  greeting: { fontSize: 20, fontWeight: "600", marginBottom: 16 },
  row: { alignItems: "center", borderBottomColor: "#eee", borderBottomWidth: 1, flexDirection: "row", gap: 16, paddingVertical: 12 },
  photo: { borderRadius: 28, height: 56, width: 56 },
  photoEmpty: { backgroundColor: "#ddd" },
  care: { backgroundColor: "#f2f6fd", borderRadius: 8, marginBottom: 12, padding: 12 },
  careTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  careLine: { fontSize: 14 },
  name: { fontSize: 18, fontWeight: "600" },
  species: { color: "#555", fontSize: 14 },
});
