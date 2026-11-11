import { Pressable, Text, View } from "react-native";

import type { Owner } from "../api/owner";
import { styles } from "./styles";

type Props = {
  owner: Owner;
  onSignOut: () => void;
};

/** First screen of a signed-in owner. */
export function HomeScreen({ owner, onSignOut }: Props) {
  return (
    <View style={styles.screen}>
      <Text testID="home-greeting" style={styles.title}>
        Olá, {owner.name}
      </Text>
      <Text style={styles.text}>{owner.email}</Text>
      <Pressable testID="sign-out-button" accessibilityRole="button" style={styles.button} onPress={onSignOut}>
        <Text style={styles.buttonText}>Sair</Text>
      </Pressable>
    </View>
  );
}
