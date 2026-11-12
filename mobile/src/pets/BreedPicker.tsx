import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../ui/Icon";
import { colors, fonts, space } from "../ui/theme";
import { searchBreeds } from "./breeds";

/** The breed of the dog, chosen from the list (AddPet-Novo artboard: "Buscar raça ou SRD"). */
export function BreedPicker({ value, onChange }: { value: string; onChange: (breed: string) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={local.label}>Raça</Text>
      <Pressable testID="pet-breed-input" accessibilityRole="button" accessibilityLabel={value ? `Raça: ${value}` : "Escolher a raça"} style={local.field} onPress={() => setOpen(true)}>
        <Text style={[local.value, !value && { color: colors.textMuted }]} numberOfLines={1}>
          {value || "Buscar raça ou SRD"}
        </Text>
        <Icon name="chevronDown" size={18} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable accessibilityLabel="Fechar" style={local.overlay} onPress={close} />
        <View style={[local.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={local.search}>
            <TextInput testID="breed-search" accessibilityLabel="Buscar raça" autoFocus placeholder="Buscar raça ou SRD" placeholderTextColor={colors.textMuted} style={local.searchInput} value={query} onChangeText={setQuery} />
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10} onPress={close}>
              <Icon name="close" size={18} />
            </Pressable>
          </View>
          <FlatList
            data={searchBreeds(query)}
            keyExtractor={(breed) => breed}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                testID={`breed-${item}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: item === value }}
                style={local.row}
                onPress={() => {
                  onChange(item);
                  close();
                }}
              >
                <Text style={local.rowText}>{item}</Text>
                {item === value && <Icon name="check" size={18} color={colors.success} strokeWidth={2.8} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const local = StyleSheet.create({
  label: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
  field: { minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  value: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  overlay: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  sheet: { height: "75%", backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: space.lg, paddingHorizontal: space.xl, gap: space.md },
  search: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: 48, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
});
