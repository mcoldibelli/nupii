import { StyleSheet, Text, View } from "react-native";

import { TERMS_SECTIONS, TERMS_VERSION } from "../terms";
import { colors, fonts } from "../ui/theme";

/** Shows the terms of use and the privacy policy, with the version. */
export function TermsView() {
  return (
    <View testID="terms-text">
      <Text style={local.version}>Termos de uso e política de privacidade, versão {TERMS_VERSION}</Text>
      {TERMS_SECTIONS.map((section) => (
        <View key={section.title} style={local.section}>
          <Text style={local.title}>{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={local.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  version: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14, marginBottom: 8 },
  section: { marginBottom: 12 },
  title: { fontSize: 16, fontFamily: fonts.bodyBold, marginBottom: 4 },
  paragraph: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 14, marginBottom: 6 },
});
