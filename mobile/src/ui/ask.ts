import { Alert, Platform, type AlertButton } from "react-native";

type Dialogs = { alert: (text: string) => void; confirm: (text: string) => boolean; prompt: (text: string) => string | null };

/** A dialog of the app: the title, the text and the buttons. */
export type AppDialog = { title: string; message: string | undefined; buttons: AlertButton[] };
type Host = (dialog: AppDialog) => void;

/** The function that shows a dialog of the app (DialogHost, #313), or null when none is on the screen. */
let host: Host | null = null;

/** Registers the dialog of the app. Returns the function that removes it. */
export function setDialogHost(next: Host): () => void {
  host = next;
  return () => {
    if (host === next) {
      host = null;
    }
  };
}

/**
 * Alert.alert with buttons, also on the web (#263). React Native Web shows no
 * Alert with buttons, so the web shows the dialog of the app (DialogHost, #313).
 */
export function ask(title: string, message: string | undefined, buttons: AlertButton[]): void {
  if (Platform.OS === "web") {
    askOnWeb(title, message, buttons, host, window);
  } else {
    Alert.alert(title, message, buttons);
  }
}

/**
 * On the web, the dialog of the app when it is on the screen (#313); the
 * dialogs of the browser only when it is not.
 */
export function askOnWeb(title: string, message: string | undefined, buttons: AlertButton[], show: Host | null, dialogs: Dialogs): void {
  if (show) {
    show({ title, message, buttons });
  } else {
    askInBrowser(title, message, buttons, dialogs);
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
