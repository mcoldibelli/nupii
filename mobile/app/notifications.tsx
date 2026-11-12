import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from "../src/api/alerts";
import { failureMessage, SESSION_FAILURE } from "../src/api/http";
import { groupNotifications, notificationTarget } from "../src/alerts/notifications";
import { apiUrl } from "../src/config";
import { timeAgo } from "../src/reports/board";
import { useSession } from "../src/session/SessionContext";
import { Icon, type IconName } from "../src/ui/Icon";
import { ErrorText } from "../src/ui/Text";
import { colors, fonts, radius, space } from "../src/ui/theme";

const kinds: Record<Notification["kind"], { icon: IconName; color: string }> = {
  lost_nearby: { icon: "alert", color: colors.danger },
  sighting: { icon: "pin", color: colors.dark },
  found: { icon: "check", color: colors.success },
};

/** The notifications of the owner, in a panel under the bell (Notificacoes-Modal artboard, RF-25). */
export default function Notifications() {
  const { idToken } = useSession();
  const insets = useSafeAreaInsets();

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
    router.replace(notificationTarget(notification));
  }

  async function readAll() {
    const token = await idToken();
    const result = token === null ? null : await markAllNotificationsRead(apiUrl, token);
    if (result?.ok) {
      setNotifications((current) => current?.map((item) => ({ ...item, read: true })) ?? null);
    } else {
      setError(result === null ? SESSION_FAILURE : failureMessage(result));
    }
  }

  const unread = notifications?.filter((item) => !item.read).length ?? 0;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={local.page}>
      <Pressable testID="notifications-close" accessibilityLabel="Fechar notificações" style={StyleSheet.absoluteFill} onPress={close} />
      <View style={[local.sheet, { marginTop: insets.top + 56 }]} accessibilityLabel="Notificações">
        <View style={local.head}>
          <Text style={local.title} accessibilityRole="header">
            Notificações
          </Text>
          {unread > 0 && (
            <View style={local.count}>
              <Text style={local.countText}>{unread === 1 ? "1 nova" : `${unread} novas`}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable testID="notifications-read-all" accessibilityRole="button" accessibilityLabel="Marcar todas como lidas" disabled={unread === 0} style={[local.round, unread === 0 && { opacity: 0.4 }]} onPress={() => void readAll()}>
            <Icon name="check" size={18} strokeWidth={2.6} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={local.round} onPress={close}>
            <Icon name="close" size={16} strokeWidth={2.4} />
          </Pressable>
        </View>
        {error !== null && <ErrorText testID="notifications-error">{error}</ErrorText>}
        <ScrollView contentContainerStyle={{ gap: 6, paddingBottom: space.md }}>
          {notifications !== null && notifications.length === 0 && (
            <Text testID="notifications-empty" style={local.muted}>
              Nenhuma notificação. Quando um pet desaparecer perto de você, o aviso aparece aqui.
            </Text>
          )}
          {groupNotifications(notifications ?? []).map((group) => (
            <View key={group.title} style={{ gap: 6 }}>
              <Text style={local.group}>{group.title.toUpperCase()}</Text>
              {group.items.map((item) => (
                <Pressable key={item.id} testID={`notification-${item.id}`} accessibilityRole="button" style={[local.item, !item.read && { backgroundColor: colors.surface }]} onPress={() => void open(item)}>
                  <View style={[local.icon, { backgroundColor: kinds[item.kind].color }]}>
                    <Icon name={kinds[item.kind].icon} size={18} color={colors.onPrimary} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={local.itemTitle}>{item.title}</Text>
                    <Text style={local.muted}>
                      {item.body} · {timeAgo(item.createdAt)}
                      {item.distanceMeters !== undefined ? ` · a ${(item.distanceMeters / 1000).toFixed(1).replace(".", ",")} km` : ""}
                    </Text>
                  </View>
                  {!item.read && <View accessibilityLabel="Não lida" style={local.dot} />}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  sheet: { maxHeight: "75%", marginHorizontal: 12, backgroundColor: colors.background, borderRadius: 28, padding: space.lg, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.title, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  count: { minHeight: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.primary, justifyContent: "center" },
  countText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onPrimary },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  group: { marginTop: 6, fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.4, color: colors.textMuted },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, padding: 10, borderRadius: 20 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
