import { useEffect, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text } from "react-native";

import { openShareLink, type HealthCard } from "../src/api/cards";
import { cardFailure, medicationLine, petLines, vaccineLine } from "../src/cards/card";
import { tokenFromHash } from "../src/cards/link";
import { apiUrl } from "../src/config";
import { styles } from "../src/screens/styles";

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
      {card.pet.photoUrl !== undefined && <Image source={{ uri: card.pet.photoUrl }} style={local.photo} accessibilityLabel={`Foto de ${card.pet.name}`} />}
      <Text testID="card-name" style={local.heading}>
        {card.pet.name}
      </Text>
      {petLines(card.pet).map((line) => (
        <Text key={line} style={local.line}>
          {line}
        </Text>
      ))}
      <Text style={local.subheading}>Vacinas</Text>
      {card.vaccines.length === 0 && <Text style={local.line}>Nenhuma vacina registrada.</Text>}
      {card.vaccines.map((vaccine, index) => (
        <Text key={index} testID="card-vaccine" style={local.line}>
          {vaccineLine(vaccine)}
        </Text>
      ))}
      <Text style={local.subheading}>Antipulgas e vermífugos</Text>
      {card.parasiteControl.length === 0 && <Text style={local.line}>Nenhum registro.</Text>}
      {card.parasiteControl.map((medication, index) => (
        <Text key={index} style={local.line}>
          {medicationLine(medication)}
        </Text>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: "#fff", flexGrow: 1, gap: 6, padding: 16 },
  photo: { alignSelf: "center", borderRadius: 60, height: 120, width: 120 },
  heading: { fontSize: 22, fontWeight: "600", textAlign: "center" },
  subheading: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  line: { color: "#333", fontSize: 15 },
});
