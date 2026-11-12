import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors } from "../ui/theme";

/** A floating chip over the dog of a slide. */
export type Chip = { kind: "nose" | "calendar" | "check" | "pin" | "bell" | "scan"; title: string; subtitle: string; side: "left" | "right"; bottom: number };

/** A slide of the welcome (Landing-Mobile artboard). */
export type Slide = { title: string; body: string; hero: string; collar: string; chips: Chip[] };

export const slides: Slide[] = [
  {
    title: "Todo focinho\né único.",
    body: "O focinho funciona como uma digital. Cadastre o do seu cachorro com fotos de perto, pelo celular.",
    hero: colors.brand,
    collar: colors.accent,
    chips: [{ kind: "nose", title: "Focinho", subtitle: "cadastrado", side: "right", bottom: 120 }],
  },
  {
    title: "Saúde em dia,\nsem esquecer.",
    body: "Vacinas, antipulgas, consultas e peso num só lugar, com os próximos cuidados e carteirinha para o veterinário.",
    hero: colors.accent,
    collar: colors.brand,
    chips: [
      { kind: "calendar", title: "Vermífugo", subtitle: "quinta · em 5 dias", side: "left", bottom: 150 },
      { kind: "check", title: "Vacinas em dia", subtitle: "carteirinha pronta", side: "right", bottom: 70 },
    ],
  },
  {
    title: "Sumiu? O bairro\nfica sabendo.",
    body: "Marque seu cachorro como perdido e avisamos quem está perto de onde ele sumiu.",
    hero: colors.ink,
    collar: colors.accent,
    chips: [
      { kind: "pin", title: "Thor sumiu aqui", subtitle: "há 40 min", side: "left", bottom: 150 },
      { kind: "bell", title: "Vizinhos avisados", subtitle: "num raio de 3 km", side: "right", bottom: 70 },
    ],
  },
  {
    title: "Achou um cachorro?\nEscaneie.",
    body: "Quem encontra fotografa o focinho e o tutor recebe o aviso, sem expor os dados de ninguém.",
    hero: colors.success,
    collar: colors.accent,
    chips: [
      { kind: "scan", title: "Focinho escaneado", subtitle: "por quem encontrou", side: "left", bottom: 130 },
      { kind: "check", title: "Tutor avisado", subtitle: "agora mesmo", side: "right", bottom: 60 },
    ],
  },
];

const SEEN_KEY = "nupii.welcome.seen";

/** Tells if this device already showed the welcome. */
export async function welcomeSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    // A storage that fails shows the welcome again; it is not an error.
    return false;
  }
}

/** Marks the welcome as seen on this device. */
export async function markWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, "1");
  } catch {
    // The welcome shows again on the next open; nothing else depends on it.
  }
}
