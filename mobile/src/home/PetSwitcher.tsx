import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Pet } from "../api/pets";
import { Icon } from "../ui/Icon";
import { colors, fonts, radius } from "../ui/theme";
import { petSubtitle } from "./home";

/** The sheet "Seus pets" of the canvas (Inicio-Mobile-Seletor artboard). */
export function PetSwitcher({
  visible,
  pets,
  noseprints,
  selectedId,
  onPick,
  onAdd,
  onManage,
  onClose,
}: {
  visible: boolean;
  pets: Pet[];
  /** For each pet, true when it has a noseprint. */
  noseprints: Record<string, boolean>;
  selectedId: string | null;
  onPick: (pet: Pet) => void;
  onAdd: () => void;
  onManage: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable testID="switcher-close" accessibilityLabel="Fechar seletor" style={local.overlay} onPress={onClose} />
      <View accessibilityViewIsModal style={[local.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={local.handle} />
        <View style={local.head}>
          <Text accessibilityRole="header" style={local.title}>
            Seus pets
          </Text>
          <Pressable testID="switcher-manage" accessibilityRole="button" style={local.manage} onPress={onManage}>
            <Icon name="pencil" size={16} color={colors.onDark} />
            <Text style={local.manageText}>Gerenciar</Text>
          </Pressable>
        </View>
        {pets.map((pet) => {
          const selected = pet.id === selectedId;
          const pending = pet.species === "dog" && noseprints[pet.id] === false;
          return (
            <Pressable
              key={pet.id}
              testID={`switcher-pet-${pet.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[local.row, { borderColor: selected ? colors.brand : colors.border }]}
              onPress={() => onPick(pet)}
            >
              {pet.photoUrl ? <Image source={{ uri: pet.photoUrl }} style={local.photo} /> : <View style={[local.photo, local.photoEmpty]}><Text style={local.initial}>{pet.name.slice(0, 1).toUpperCase()}</Text></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={local.nameRow}>
                  <Text style={local.name}>{pet.name}</Text>
                  {noseprints[pet.id] === true && (
                    <View accessibilityLabel="Focinho cadastrado" style={local.badge}>
                      <Icon name="check" size={10} strokeWidth={3.4} color={colors.onPrimary} />
                    </View>
                  )}
                </View>
                <Text style={pending ? local.pending : local.subtitle}>{pending ? "Focinho pendente" : petSubtitle(pet)}</Text>
              </View>
              {selected ? (
                <View accessibilityLabel="Selecionado" style={local.selected}>
                  <Icon name="check" size={14} strokeWidth={3} color={colors.onPrimary} />
                </View>
              ) : (
                <Icon name="chevronRight" size={18} color={colors.textMuted} />
              )}
            </Pressable>
          );
        })}
        <Pressable testID="switcher-add" accessibilityRole="button" style={[local.row, local.add]} onPress={onAdd}>
          <View style={[local.photo, local.photoEmpty]}>
            <Icon name="plus" size={22} strokeWidth={2.2} />
          </View>
          <Text style={local.name}>Adicionar pet</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  overlay: { backgroundColor: "rgba(24,22,26,0.5)", flex: 1 },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  handle: { alignSelf: "center", backgroundColor: "#DAD9D6", borderRadius: 3, height: 5, marginBottom: 6, width: 40 },
  head: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  title: { color: colors.ink, fontFamily: fonts.title, fontSize: 22, letterSpacing: -0.4 },
  manage: { alignItems: "center", backgroundColor: colors.dark, borderRadius: radius.pill, flexDirection: "row", gap: 6, height: 36, paddingHorizontal: 14 },
  manageText: { color: colors.onDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  row: { alignItems: "center", borderRadius: 20, borderWidth: 2, flexDirection: "row", gap: 12, padding: 8, paddingRight: 14 },
  add: { borderColor: "#DAD9D6", borderStyle: "dashed" },
  photo: { borderRadius: 26, height: 52, width: 52 },
  photoEmpty: { alignItems: "center", backgroundColor: colors.surface, justifyContent: "center" },
  initial: { color: colors.primary, fontFamily: fonts.title, fontSize: 20 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  name: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 17 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  pending: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 14 },
  badge: { alignItems: "center", backgroundColor: colors.success, borderRadius: 9, height: 18, justifyContent: "center", width: 18 },
  selected: { alignItems: "center", backgroundColor: colors.brand, borderRadius: 13, height: 26, justifyContent: "center", width: 26 },
});
