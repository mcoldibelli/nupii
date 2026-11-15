import { askInBrowser, askOnWeb } from "./ask";

/** A browser that answers the dialogs with the given values and keeps what it showed. */
function browser(answers: { confirm?: boolean; prompt?: string | null }) {
  const shown: string[] = [];
  return {
    shown,
    dialogs: {
      alert: (text: string) => void shown.push(text),
      confirm: (text: string) => (shown.push(text), answers.confirm ?? false),
      prompt: (text: string) => (shown.push(text), answers.prompt ?? null),
    },
  };
}

describe("askInBrowser (#263)", () => {
  it("runs the action of a confirmation that the person accepts", () => {
    const remove = jest.fn();
    const { dialogs, shown } = browser({ confirm: true });

    askInBrowser("Excluir pet", "Excluir Rex?", [{ text: "Cancelar", style: "cancel" }, { text: "Excluir", onPress: remove }], dialogs);

    expect(remove).toHaveBeenCalled();
    expect(shown).toEqual(["Excluir pet\n\nExcluir Rex?"]);
  });

  it("runs nothing when the person cancels", () => {
    const remove = jest.fn();
    askInBrowser("Excluir pet", undefined, [{ text: "Cancelar", style: "cancel" }, { text: "Excluir", onPress: remove }], browser({ confirm: false }).dialogs);

    expect(remove).not.toHaveBeenCalled();
  });

  it("shows a message with no action as an alert", () => {
    const { dialogs, shown } = browser({});
    askInBrowser("Localização", "Permita a localização.", [], dialogs);

    expect(shown).toEqual(["Localização\n\nPermita a localização."]);
  });

  it("asks for the number of an option when there are several", () => {
    const edit = jest.fn();
    const card = jest.fn();
    const { dialogs, shown } = browser({ prompt: "2" });

    askInBrowser("Rex", undefined, [{ text: "Editar dados", onPress: edit }, { text: "Carteirinha", onPress: card }, { text: "Cancelar", style: "cancel" }], dialogs);

    expect(card).toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    expect(shown).toEqual(["Rex\n\n1. Editar dados\n2. Carteirinha\n\nDigite o número da opção."]);
  });

  it("runs nothing for an answer that is not an option", () => {
    const edit = jest.fn();
    for (const answer of [null, "", "9", "x"]) {
      askInBrowser("Rex", undefined, [{ text: "Editar dados", onPress: edit }, { text: "Carteirinha" }], browser({ prompt: answer }).dialogs);
    }
    expect(edit).not.toHaveBeenCalled();
  });
});

describe("askOnWeb (#313)", () => {
  it("shows the dialog of the app when it is on the screen, and not the dialog of the browser", () => {
    const host = jest.fn();
    const { dialogs, shown } = browser({ confirm: true });
    const buttons = [{ text: "Cancelar", style: "cancel" as const }, { text: "Excluir", style: "destructive" as const, onPress: jest.fn() }];

    askOnWeb("Excluir pet", "Excluir Rex?", buttons, host, dialogs);

    expect(host).toHaveBeenCalledWith({ title: "Excluir pet", message: "Excluir Rex?", buttons });
    expect(shown).toEqual([]);
  });

  it("uses the dialog of the browser when the app has no dialog on the screen", () => {
    const remove = jest.fn();

    askOnWeb("Excluir pet", undefined, [{ text: "Excluir", onPress: remove }], null, browser({ confirm: true }).dialogs);

    expect(remove).toHaveBeenCalled();
  });
});
