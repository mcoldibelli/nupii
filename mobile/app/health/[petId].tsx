import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { listHealthEvents, type HealthEvent, type HealthEventType } from "../../src/api/health";
import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import { apiUrl } from "../../src/config";
import { eventTitle, typeLabels } from "../../src/health/form";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";
import { Icon, type IconName } from "../../src/ui/Icon";
import { colors, fonts } from "../../src/ui/theme";

const typeIcons: Record<HealthEventType, IconName> = {
  vaccine: "syringe",
  consultation: "stethoscope",
  medication: "pill",
  exam: "flask",
  note: "calendar",
};

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
        <Text style={[local.typeText, { color: colors.onDark }]}>Compartilhar carteirinha</Text>
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
            <View style={local.iconTile}>
              <Icon name={typeIcons[item.type]} size={21} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={local.title}>{eventTitle(item)}</Text>
              <Text style={local.line}>{dateText(item.date)}</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, padding: 20 },
  heading: { fontSize: 28, fontFamily: fonts.title, letterSpacing: -0.8, color: colors.ink, marginBottom: 12 },
  share: { alignSelf: "flex-start", backgroundColor: colors.dark, marginBottom: 12 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  type: { backgroundColor: colors.surface, borderRadius: 999, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 },
  typeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 14 },
  row: { alignItems: "center", borderColor: colors.border, borderRadius: 20, borderWidth: 1.5, flexDirection: "row", gap: 12, marginBottom: 8, minHeight: 64, padding: 10, paddingRight: 12 },
  iconTile: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  title: { fontSize: 16, fontFamily: fonts.bodyBold },
  line: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14 },
});
