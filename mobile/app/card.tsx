import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text } from "react-native";

import { openShareLink, type HealthCard } from "../src/api/cards";
import { cardFailure } from "../src/cards/card";
import { HealthCardView } from "../src/cards/HealthCardView";
import { tokenFromHash } from "../src/cards/link";
import { apiUrl } from "../src/config";
import { styles } from "../src/screens/styles";
import { colors, fonts } from "../src/ui/theme";

/** The public page of the health card, opened by the link (RF-31). It needs no account. */
export default function Card() {
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
    <ScrollView contentContainerStyle={local.screen}>
      <Text style={local.heading} accessibilityRole="header">
        Carteirinha
      </Text>
      <HealthCardView card={card} />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: colors.background, flexGrow: 1, gap: 16, padding: 20, width: "100%", maxWidth: 560, alignSelf: "center" },
  heading: { fontSize: 30, fontFamily: fonts.title, letterSpacing: -0.8, color: colors.ink },
});
