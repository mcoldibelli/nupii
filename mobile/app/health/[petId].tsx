import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { listHealthEvents, type HealthEvent, type HealthEventType } from "../../src/api/health";
import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import { apiUrl } from "../../src/config";
import { eventTitle, typeLabels } from "../../src/health/form";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";

function dateText(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** The health events of a pet, from the newest to the oldest (RF-27). */
export default function HealthEvents() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName: string }>();
  const { idToken } = useSession();
  const [events, setEvents] = useState<HealthEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The list is read again when the owner comes back from the form.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await idToken();
        const result = token === null ? null : await listHealthEvents(apiUrl, token, petId);
        if (result === null) {
          setError(SESSION_FAILURE);
        } else if (result.ok) {
          setEvents(result.value);
          setError(null);
        } else {
          setError(failureMessage(result));
        }
      })();
    }, [idToken, petId]),
  );

  const open = (type: HealthEventType, eventId?: string) =>
    router.push({ pathname: "/health/event", params: eventId ? { petId, type, eventId } : { petId, type } });

  return (
    <View style={local.screen}>
      <Text style={local.heading}>Saúde de {petName}</Text>
      <Pressable
        testID="open-share"
        accessibilityRole="button"
        style={[local.type, local.share]}
        onPress={() => router.push({ pathname: "/share/[petId]", params: { petId, petName } })}
      >
        <Text style={local.typeText}>Compartilhar carteirinha</Text>
      </Pressable>
      <View style={local.types}>
        {(Object.keys(typeLabels) as HealthEventType[]).map((type) => (
          <Pressable key={type} testID={`new-${type}`} accessibilityRole="button" style={local.type} onPress={() => open(type)}>
            <Text style={local.typeText}>+ {typeLabels[type]}</Text>
          </Pressable>
        ))}
      </View>
      {error !== null && (
        <Text testID="health-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={events ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          events === null ? undefined : (
            <Text testID="health-empty" style={styles.text}>
              Nenhum evento de saúde.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable testID={`event-${item.id}`} accessibilityRole="button" style={local.row} onPress={() => open(item.type, item.id)}>
            <Text style={local.title}>{eventTitle(item)}</Text>
            <Text style={local.line}>{dateText(item.date)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: "#fff", flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  share: { alignSelf: "flex-start", marginBottom: 12 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  type: { borderColor: "#1f5fbf", borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  typeText: { color: "#1f5fbf", fontSize: 14 },
  row: { borderBottomColor: "#eee", borderBottomWidth: 1, paddingVertical: 10 },
  title: { fontSize: 16, fontWeight: "600" },
  line: { color: "#555", fontSize: 14 },
});
