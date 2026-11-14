import { Alert, Platform, type AlertButton } from "react-native";

type Dialogs = { alert: (text: string) => void; confirm: (text: string) => boolean; prompt: (text: string) => string | null };

/**
 * Alert.alert with buttons, also on the web (#263). React Native Web shows no
 * Alert with buttons, so the web uses the dialogs of the browser.
 */
export function ask(title: string, message: string | undefined, buttons: AlertButton[]): void {
  if (Platform.OS === "web") {
    askInBrowser(title, message, buttons, window);
  } else {
    Alert.alert(title, message, buttons);
  }
}

/**
 * The dialogs of the browser for ask: alert for a message with no action,
 * confirm for one action, and a numbered list for several actions.
 */
export function askInBrowser(title: string, message: string | undefined, buttons: AlertButton[], dialogs: Dialogs): void {
  const actions = buttons.filter((button) => button.style !== "cancel");
  const text = [title, message].filter(Boolean).join("\n\n");
  if (actions.length === 0) {
    dialogs.alert(text);
  } else if (actions.length === 1) {
    if (dialogs.confirm(text)) {
      actions[0].onPress?.();
    }
  } else {
    const list = actions.map((action, i) => `${i + 1}. ${action.text}`).join("\n");
    const answer = Number(dialogs.prompt(`${text}\n\n${list}\n\nDigite o número da opção.`));
    actions[answer - 1]?.onPress?.();
  }
}
