import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type AlertButton } from "react-native";

import { Button } from "./Button";
import { setDialogHost, type AppDialog } from "./ask";
import { colors, fonts } from "./theme";

/**
 * The dialog of the app for ask() on the web (#313): the title, the text and
 * the buttons in the look of the app, in place of the dialogs of the browser.
 * It is mounted once, at the root of the app.
 */
export function DialogHost() {
  const [dialog, setDialog] = useState<AppDialog | null>(null);
  useEffect(() => setDialogHost(setDialog), []);
  if (dialog === null) {
    return null;
  }
  const cancel = dialog.buttons.find((button) => button.style === "cancel");
  const close = (onPress?: AlertButton["onPress"]) => {
    setDialog(null);
    onPress?.();
  };
  // A dialog with no button of its own still closes with "OK".
  const buttons = dialog.buttons.length > 0 ? dialog.buttons : [{ text: "OK" }];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(cancel?.onPress)}>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Fechar" style={StyleSheet.absoluteFill} onPress={() => close(cancel?.onPress)} />
        <View testID="app-dialog" accessibilityRole="alert" style={local.card}>
          <Text style={local.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={local.message}>{dialog.message}</Text> : null}
          <View style={local.buttons}>
            {buttons.map((button, index) => (
              <Button
                key={`${button.text}-${index}`}
                testID={`app-dialog-${index}`}
                label={button.text ?? "OK"}
                size="md"
                stretch={false}
                variant={button.style === "cancel" ? "soft" : button.style === "destructive" ? "danger" : "dark"}
                onPress={() => close(button.onPress)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(24,22,26,0.45)" },
  card: { width: "100%", maxWidth: 420, gap: 10, padding: 24, borderRadius: 24, backgroundColor: colors.background },
  title: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.ink },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  buttons: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, marginTop: 8 },
});
