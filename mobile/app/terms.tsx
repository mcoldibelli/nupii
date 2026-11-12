import { ScrollView, StyleSheet } from "react-native";

import { TermsView } from "../src/screens/TermsView";

/** The public page of the terms of use and the privacy policy. */
export default function Terms() {
  return (
    <ScrollView contentContainerStyle={local.screen}>
      <TermsView />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: "#fff", flexGrow: 1, padding: 16 },
});
