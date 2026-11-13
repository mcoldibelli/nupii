import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { HealthEventType } from "../api/health";
import { Icon, type IconName } from "../ui/Icon";
import { colors, fonts, radius, space } from "../ui/theme";
import { presetTypes, type Preset } from "./form";

/** The options of the Anotar sheet (Saude-Mobile-Registrar artboard). */
const options: { label: string; line: string; icon: IconName; color: string; type: HealthEventType; preset?: Exclude<Preset, "again"> }[] = [
  { label: "Vacina", line: "V10, raiva, gripe…", icon: "syringe", color: colors.accent, type: "vaccine" },
  { label: "Antipulgas", line: "pulgas e carrapatos", icon: "pill", color: colors.primary, type: "medication", preset: "flea" },
  { label: "Vermífugo", line: "a cada 3 meses", icon: "pill", color: colors.primary, type: "medication", preset: "deworm" },
  { label: "Medicação", line: "remédio com horário", icon: "pill", color: colors.primary, type: "medication", preset: "medication" },
  { label: "Consulta", line: "ida ao veterinário", icon: "stethoscope", color: colors.dark, type: "consultation" },
  { label: "Exame", line: "com laudo em PDF", icon: "flask", color: colors.dark, type: "exam" },
  { label: "Sintoma", line: "vômito, coceira…", icon: "stethoscope", color: colors.danger, type: "note", preset: "symptom" },
  { label: "Peso", line: "anote o peso de hoje", icon: "weight", color: colors.success, type: "note", preset: "weight" },
];

/** The sheet "O que você quer anotar?" (Saude-Mobile-Registrar artboard), in the health screen and in the home. */
export function AnotarSheet({ visible, petName, onClose, onPick }: { visible: boolean; petName: string; onClose: () => void; onPick: (type: HealthEventType, preset?: Exclude<Preset, "again">) => void }) {
  const insets = useSafeAreaInsets();
  return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable testID="registrar-close-overlay" accessibilityLabel="Fechar" style={local.overlay} onPress={onClose} />
    <View style={[local.sheet, { paddingBottom: insets.bottom + space.xl }]}>
      <View style={local.handle} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={local.sheetTitle}>O que você quer anotar?</Text>
          <Text style={local.itemLine}>Fica no histórico de {petName} e gera lembretes</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={local.close} onPress={onClose}>
          <Icon name="close" size={16} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View style={local.grid}>
        {options.map((option) => (
          <Pressable
            key={option.label}
            testID={`option-${option.label}`}
            accessibilityRole="button"
            style={local.option}
            onPress={() => onPick(option.preset ? presetTypes[option.preset] : option.type, option.preset)}
          >
            <View style={[local.optionIcon, { backgroundColor: option.color }]}>
              <Icon name={option.icon} size={19} color={colors.onPrimary} />
            </View>
            <Text style={local.itemTitle}>{option.label}</Text>
            <Text style={local.optionLine}>{option.line}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  </Modal>
  );
}

const local = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: space.xl, gap: space.lg },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderDashed },
  sheetTitle: { fontFamily: fonts.title, fontSize: 22, letterSpacing: -0.4, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: { width: "48%", flexGrow: 1, gap: 8, padding: 12, borderRadius: 20, backgroundColor: colors.surface },
  optionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  optionLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  itemTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  itemLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
