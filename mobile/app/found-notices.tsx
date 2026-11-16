import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { listFoundNotices, type FoundNotice } from "../src/api/biometrics";
import { failureMessage, SESSION_FAILURE } from "../src/api/http";
import { apiUrl } from "../src/config";
import { formatDateTime, phoneUrl } from "../src/biometrics/messages";
import { MapView } from "../src/map/MapView";
import { styles } from "../src/screens/styles";
import { useSession } from "../src/session/SessionContext";
import { colors, fonts, radius } from "../src/ui/theme";

/** The notices of the people that found a pet of the owner (RF-14). */
export default function FoundNotices() {
  const { idToken } = useSession();
  const [notices, setNotices] = useState<FoundNotice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The notice whose map is open, below the notice, in the app (no map app or web site).
  const [mapOf, setMapOf] = useState<string | null>(null);

  // The list is read each time the screen gets the focus.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await idToken();
        if (token === null) {
          setError(SESSION_FAILURE);
          return;
        }
        const result = await listFoundNotices(apiUrl, token);
        if (result.ok) {
          setNotices(result.value);
          setError(null);
        } else {
          setError(failureMessage(result));
        }
      })();
    }, [idToken]),
  );

  return (
    <View style={local.screen}>
      {error !== null && (
        <Text testID="found-notices-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={notices ?? []}
        keyExtractor={(notice) => notice.id}
        ListEmptyComponent={
          notices === null ? undefined : (
            <Text testID="found-notices-empty" style={styles.text}>
              Nenhum aviso. Quando alguém encontrar um pet seu pela foto do focinho, o contato aparece aqui.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View testID={`found-notice-${item.petName}`} style={local.notice}>
            <Text style={local.title}>Alguém encontrou {item.petName}</Text>
            <Text style={local.line}>{formatDateTime(item.confirmedAt)}</Text>
            <Text style={local.line}>Contato: {item.contactName}</Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(phoneUrl(item.contactPhone))}>
              <Text style={[local.line, styles.linkText]}>{item.contactPhone}</Text>
            </Pressable>
            {item.message !== undefined && <Text style={local.line}>{item.message}</Text>}
            {item.latitude !== undefined && item.longitude !== undefined && (
              <>
                <Pressable testID={`found-notice-map-${item.petName}`} accessibilityRole="button" onPress={() => setMapOf(mapOf === item.id ? null : item.id)}>
                  <Text style={[local.line, styles.linkText]}>{mapOf === item.id ? "Esconder o mapa" : "Ver o local no mapa"}</Text>
                </Pressable>
                {mapOf === item.id && (
                  <MapView markers={[{ latitude: item.latitude, longitude: item.longitude, label: `Onde ${item.petName} foi encontrado`, kind: "main" }]} style={local.map} />
                )}
              </>
            )}
          </View>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, padding: 24 },
  notice: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 12 },
  title: { fontSize: 18, fontFamily: fonts.titleBold, marginBottom: 4 },
  line: { fontFamily: fonts.body, fontSize: 16, marginBottom: 4 },
  map: { height: 220, width: "100%", marginTop: 4, borderRadius: radius.card, overflow: "hidden" },
});
