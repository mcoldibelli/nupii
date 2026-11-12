import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { openShareLink, type HealthCard } from "../src/api/cards";
import { cardFailure } from "../src/cards/card";
import { HealthCardView } from "../src/cards/HealthCardView";
import { tokenFromHash } from "../src/cards/link";
import { apiUrl } from "../src/config";
import { styles } from "../src/screens/styles";
import { colors, fonts } from "../src/ui/theme";
import { useWide } from "../src/ui/useWide";

/** The public page of the health card, opened by the link (RF-31). It needs no account. */
export default function Card() {
  const wide = useWide();
  const [card, setCard] = useState<HealthCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ADR 0027: the token is in the fragment of the address.
    const token = Platform.OS === "web" ? tokenFromHash(window.location.hash) : undefined;
    if (token === undefined) {
      setError(cardFailure({ ok: false, code: "share_link_not_found" }));
      return;
    }
    void openShareLink(apiUrl, token).then((result) => (result.ok ? setCard(result.value) : setError(cardFailure(result))));
  }, []);

  if (error !== null) {
    return (
      <ScrollView contentContainerStyle={local.screen}>
        <Text testID="card-error" accessibilityRole="alert" style={styles.text}>
          {error}
        </Text>
      </ScrollView>
    );
  }
  if (card === null) {
    return null;
  }
  return (
    <ScrollView contentContainerStyle={[local.screen, wide && local.screenWide]}>
      <View style={{ gap: 4 }}>
        <Text style={[local.heading, wide && { fontSize: 36 }]} accessibilityRole="header">
          {wide ? `Carteirinha de ${card.pet.name}` : "Carteirinha"}
        </Text>
        {wide && <Text style={local.lead}>Documento gerado a partir do histórico de saúde no Nupii.</Text>}
      </View>
      <View style={wide && local.frame}>
        <HealthCardView card={card} wide={wide} />
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: colors.background, flexGrow: 1, gap: 16, padding: 20, width: "100%", maxWidth: 560, alignSelf: "center" },
  screenWide: { maxWidth: 960, paddingHorizontal: 40, paddingTop: 32, gap: 24 },
  frame: { padding: 28, borderRadius: 28, borderWidth: 1.5, borderColor: colors.border },
  lead: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
  heading: { fontSize: 30, fontFamily: fonts.title, letterSpacing: -0.8, color: colors.ink },
});
