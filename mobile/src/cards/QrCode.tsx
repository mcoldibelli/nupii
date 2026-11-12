import { View } from "react-native";

import { qrRuns } from "./qr";

/** Draws the QR code of text, with a light margin of 2 modules (RF-30). Pure black and white on purpose: a reader needs the most contrast. */
export function QrCode({ text, module = 6 }: { text: string; module?: number }) {
  const rows = qrRuns(text);
  return (
    <View testID="share-qr" accessibilityLabel="QR code do link da carteirinha" style={{ backgroundColor: "#fff", padding: module * 2, alignSelf: "center" }}>
      {rows.map((runs, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {runs.map((run, index) => (
            <View key={index} style={{ width: run.length * module, height: module, backgroundColor: run.dark ? "#000" : "#fff" }} />
          ))}
        </View>
      ))}
    </View>
  );
}
