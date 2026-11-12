import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { listNotifications, markNotificationRead, type Notification } from "../src/api/alerts";
import { failureMessage, SESSION_FAILURE } from "../src/api/http";
import { notificationTarget } from "../src/alerts/notifications";
import { formatDateTime } from "../src/biometrics/messages";
import { apiUrl } from "../src/config";
import { styles } from "../src/screens/styles";
import { useSession } from "../src/session/SessionContext";
import { colors } from "../src/ui/theme";
import { TabBar } from "../src/ui/TabBar";

/** The notifications of the owner: nearby alerts, sightings and found pets (RF-25). */
export default function Notifications() {
  const { idToken } = useSession();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The list is read each time the screen gets the focus.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await idToken();
        const result = token === null ? null : await listNotifications(apiUrl, token);
        if (result === null) {
          setError(SESSION_FAILURE);
        } else if (result.ok) {
          setNotifications(result.value);
          setError(null);
        } else {
          setError(failureMessage(result));
        }
      })();
    }, [idToken]),
  );

  async function open(notification: Notification) {
    if (!notification.read) {
      const token = await idToken();
      if (token !== null) {
        // The screen opens also when the mark fails: the mark is not the main action.
        void markNotificationRead(apiUrl, token, notification.id);
      }
    }
    router.push(notificationTarget(notification));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={local.screen}>
      {error !== null && (
        <Text testID="notifications-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          notifications === null ? undefined : (
            <Text testID="notifications-empty" style={styles.text}>
              Nenhuma notificação. Quando um pet desaparecer perto de você, o aviso aparece aqui.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`notification-${item.id}`}
            accessibilityRole="button"
            style={[local.row, !item.read && local.unread]}
            onPress={() => open(item)}
          >
            <Text style={local.title}>
              {item.read ? "" : "● "}
              {item.title}
            </Text>
            <Text style={local.line}>{item.body}</Text>
            <Text style={local.date}>
              {formatDateTime(item.createdAt)}
              {item.distanceMeters !== undefined ? ` · a ${item.distanceMeters} m de você` : ""}
            </Text>
          </Pressable>
        )}
      />
    </View>
      <TabBar />
    </View>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: "#fff", flex: 1, padding: 16 },
  row: { borderBottomColor: "#eee", borderBottomWidth: 1, paddingVertical: 12 },
  unread: { backgroundColor: "#f2f6fd" },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  line: { fontSize: 15, marginBottom: 4 },
  date: { color: "#555", fontSize: 13 },
});
