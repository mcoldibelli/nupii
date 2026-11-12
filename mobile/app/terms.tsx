import { ScrollView, StyleSheet } from "react-native";

import { TermsView } from "../src/screens/TermsView";
import { colors } from "../src/ui/theme";

/** The public page of the terms of use and the privacy policy. */
export default function Terms() {
  return (
    <ScrollView contentContainerStyle={local.screen}>
      <TermsView />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: colors.background, flexGrow: 1, padding: 20 },
});
