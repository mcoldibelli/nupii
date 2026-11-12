import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LocalFile, PetInput } from "../api/pets";
import { Button } from "../ui/Button";
import { DateField } from "../ui/DateField";
import { OutlinedField } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { BackButton, Segmented } from "../ui/Surfaces";
import { ErrorText } from "../ui/Text";
import { colors, fonts, space } from "../ui/theme";
import { toPetInput, type PetForm } from "./form";
import { BreedPicker } from "./BreedPicker";
import { neuteredLabels, sizeLabels } from "./labels";
import { askPetPhoto } from "./pickPhoto";

type Props = {
  title: string;
  initial: PetForm;
  /** Temporary URL of the photo that the pet has now. */
  photoUrl?: string;
  /** Saves the pet. Returns null, or the message of the failure. */
  onSubmit: (input: PetInput, photo: LocalFile | null) => Promise<string | null>;
  onDelete: () => void;
  /** A message above the form, as the photo that was not sent. */
  notice?: string | null;
};

/** The options of a segmented choice, from the labels of the contract. */
const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/**
 * The form that changes a pet (RF-10), in the layout of the AddPet-Novo
 * artboard and the EditPet-Mobile artboard. It has all the data of the pet
 * (RN-48 to RN-51, RN-56); the species does not change.
 */
export function PetFormView({ title, initial, photoUrl, onSubmit, onDelete, notice }: Props) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<PetForm>(initial);
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PetForm>(field: K, value: PetForm[K]) => setForm((current) => ({ ...current, [field]: value }));

  async function submit() {
    const result = toPetInput(form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBusy(true);
    setError(await onSubmit(result.input, photo));
    setBusy(false);
  }

  const shownPhoto = photo?.uri ?? photoUrl;
  const text = (label: string, field: "name" | "vetName" | "vetClinic" | "vetPhone", extra: object = {}) => (
    <OutlinedField testID={`pet-${field}-input`} label={label} value={form[field]} onChangeText={(value) => set(field, value)} {...extra} />
  );

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.md }]} keyboardShouldPersistTaps="handled">
        <View style={local.top}>
          <BackButton testID="edit-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          <Text style={local.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {notice ? <ErrorText testID="edit-pet-error">{notice}</ErrorText> : null}

        <Pressable
          testID="pick-photo-button"
          accessibilityRole="button"
          accessibilityLabel={shownPhoto ? "Trocar a foto do pet" : "Escolher a foto do pet"}
          style={local.photoRow}
          onPress={() =>
            askPetPhoto((picked) => {
              if (picked === "denied") {
                setError("O app não tem permissão para usar a câmera. Escolha uma foto da galeria.");
              } else if (picked !== null) {
                setPhoto(picked);
              }
            })
          }
        >
          <View style={local.photo}>
            {shownPhoto ? <Image testID="pet-form-photo" source={{ uri: shownPhoto }} style={local.photoImage} /> : <Icon name="camera" size={28} />}
            <View style={local.badge}>
              <Icon name={shownPhoto ? "pencil" : "plus"} size={14} color={colors.onPrimary} strokeWidth={2.6} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={local.photoTitle}>{shownPhoto ? "Trocar a foto" : "Foto do pet"}</Text>
            <Text style={local.muted}>Da galeria ou câmera. Aparece no perfil e nos alertas.</Text>
          </View>
        </Pressable>

        {text("Nome", "name", { maxLength: 100 })}
        <View style={local.group}>
          <Text style={local.label}>Sexo</Text>
          <Segmented<PetForm["sex"]>
            testID="sex"
            options={[
              { value: "female", label: "Fêmea" },
              { value: "male", label: "Macho" },
            ]}
            value={form.sex}
            onChange={(value) => set("sex", value)}
          />
        </View>
        <BreedPicker value={form.breed} onChange={(value) => set("breed", value)} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <DateField look="outlined" testID="pet-birthDate-input" label="Nascimento (opcional)" noFuture optional value={form.birthDate} onChange={(value) => set("birthDate", value)} />
          </View>
          <View style={{ flex: 1 }}>
            <OutlinedField testID="pet-weightKg-input" label="Peso (opcional)" placeholder="0,0" suffix="kg" keyboardType="decimal-pad" maxLength={6} value={form.weightKg} onChangeText={(value) => set("weightKg", value)} />
          </View>
        </View>
        <View style={local.group}>
          <Text style={local.label}>Porte</Text>
          <Segmented<PetForm["size"]> testID="size" options={options(sizeLabels)} value={form.size} onChange={(value) => set("size", value)} />
        </View>
        <View style={local.group}>
          <Text style={local.label}>Castrado</Text>
          <Segmented<PetForm["neutered"]> testID="neutered" options={options(neuteredLabels)} value={form.neutered} onChange={(value) => set("neutered", value)} />
        </View>

        <Text style={local.section}>Veterinário</Text>
        {text("Nome do veterinário", "vetName", { maxLength: 120 })}
        {text("Clínica", "vetClinic", { maxLength: 120 })}
        {text("Telefone", "vetPhone", { maxLength: 30, keyboardType: "phone-pad" })}

        {error !== null && <ErrorText testID="pet-form-error">{error}</ErrorText>}
        <Button testID="delete-pet-button" label="Excluir pet" variant="soft" size="md" disabled={busy} onPress={onDelete} />
      </ScrollView>
      <View style={[local.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button testID="save-pet-button" label="Salvar alterações" busy={busy} onPress={() => void submit()} />
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontFamily: fonts.title, fontSize: 28, letterSpacing: -0.6, color: colors.ink },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  photo: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  photoImage: { width: 88, height: 88, borderRadius: 44 },
  badge: { position: "absolute", right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.background, alignItems: "center", justifyContent: "center" },
  photoTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  group: { gap: 8 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
  section: { marginTop: 8, fontFamily: fonts.titleBold, fontSize: 19, color: colors.ink },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: colors.background },
});
