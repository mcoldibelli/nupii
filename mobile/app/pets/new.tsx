import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState, type ComponentRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LocalFile } from "../../src/api/pets";
import { apiUrl } from "../../src/config";
import { emptyForm, toPetInput, type PetForm } from "../../src/pets/form";
import { BreedPicker } from "../../src/pets/BreedPicker";
import { askPetPhoto, filePart, shrinkPhoto } from "../../src/pets/pickPhoto";
import { savePet } from "../../src/pets/save";
import { useSession } from "../../src/session/SessionContext";
import { Button } from "../../src/ui/Button";
import { DateField } from "../../src/ui/DateField";
import { OutlinedField } from "../../src/ui/Field";
import { Icon } from "../../src/ui/Icon";
import { Segmented, StepHeader } from "../../src/ui/Surfaces";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, space } from "../../src/ui/theme";
import { useFileDrop } from "../../src/ui/useFileDrop";
import { useWide } from "../../src/ui/useWide";

/**
 * Step 1 of the registration of a pet (RF-09), as the AddPet-Novo artboard,
 * or AddPet-Primeiro when the home opens it for an owner with no pet.
 * The app registers only dogs, because the inference reads only the nose
 * of a dog (RN-48); the dog continues to the noseprint (step 2).
 */
export default function NewPet() {
  const { idToken, state } = useSession();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const firstPet = first === "1";
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<PetForm>({ ...emptyForm, species: "dog" });
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PetForm>(field: K, value: PetForm[K]) => setForm((current) => ({ ...current, [field]: value }));
  // The browser of a computer gets the AddPet-Web artboard (#233).
  const wide = useWide();
  const dropZone = useRef<ComponentRef<typeof Pressable>>(null);
  const dropPhoto = useCallback((file: File) => void shrinkPhoto({ uri: URL.createObjectURL(file), file }).then(setPhoto), []);
  useFileDrop(dropZone, dropPhoto);

  function choosePhoto() {
    const use = (picked: LocalFile | null | "denied") => {
      if (picked === "denied") {
        setError("O app não tem permissão para usar a câmera. Escolha uma foto da galeria.");
      } else if (picked !== null) {
        setPhoto(picked);
      }
    };
    askPetPhoto(use);
  }

  async function save(toNoseprint: boolean) {
    const result = toPetInput(form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await savePet({ baseUrl: apiUrl, idToken }, null, result.input, photo && filePart(photo));
    setBusy(false);
    switch (outcome.kind) {
      case "saved":
        if (toNoseprint) {
          router.replace({ pathname: "/noseprint/[petId]", params: { petId: outcome.petId, petName: result.input.name } });
        } else {
          router.replace("/");
        }
        return;
      case "photoFailed":
        // The pet exists, so this form must not create it again. The edit
        // screen says that the photo was not sent.
        router.replace({ pathname: "/pets/edit/[id]", params: { id: outcome.petId, photoFailed: "1" } });
        return;
      case "failed":
        setError(outcome.message);
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const fields = (
    <>
    <OutlinedField testID="pet-name-input" label="Nome" placeholder="Ex.: Paçoca" maxLength={100} value={form.name} onChangeText={(value) => set("name", value)} />
    <View style={{ gap: 8 }}>
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
    </>
  );

  if (wide) {
    // AddPet-Web: the photo in a large square on the left, the data on the right, the actions at the end.
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={wideStyles.page} keyboardShouldPersistTaps="handled">
        <View style={wideStyles.column}>
          <View style={wideStyles.head}>
            {!firstPet && (
              <Pressable testID="step-close" accessibilityRole="button" accessibilityLabel="Fechar" style={wideStyles.close} onPress={close}>
                <Icon name="close" size={18} strokeWidth={2.4} />
              </Pressable>
            )}
            <View style={wideStyles.progress} accessibilityLabel="Passo 1 de 2">
              <View style={[wideStyles.bar, { backgroundColor: colors.brand }]} />
              <View style={[wideStyles.bar, { backgroundColor: colors.border }]} />
            </View>
            <Text style={wideStyles.step}>1 de 2 · Dados</Text>
          </View>
          <View style={{ gap: 4 }}>
            {firstPet && state.kind === "ready" && <Text style={[local.hello, { fontSize: 16 }]}>Olá, {state.owner.name}</Text>}
            <Text style={[local.title, { fontSize: 36, letterSpacing: -1 }]} accessibilityRole="header">
              {firstPet ? "Vamos cadastrar seu primeiro cachorro" : "Novo cachorro"}
            </Text>
          </View>
          <View style={wideStyles.columns}>
            <View style={wideStyles.photoColumn}>
              <Pressable ref={dropZone} testID="pick-photo-button" accessibilityRole="button" accessibilityLabel="Enviar a foto do cachorro" onPress={choosePhoto} style={wideStyles.drop}>
                {photo ? (
                  <Image testID="pet-form-photo" source={{ uri: photo.uri }} style={wideStyles.dropImage} />
                ) : (
                  <>
                    <View style={wideStyles.dropIcon}>
                      <Icon name="upload" size={28} color={colors.brand} strokeWidth={2} />
                    </View>
                    <Text style={local.photoTitle}>Foto do cachorro</Text>
                    <Text style={[local.photoText, { textAlign: "center" }]}>Arraste uma imagem ou clique para escolher</Text>
                  </>
                )}
              </Pressable>
              <Text style={[local.photoText, { textAlign: "center", fontSize: 13 }]}>Aparece no perfil e nos alertas.</Text>
            </View>
            <View style={wideStyles.fields}>
              {fields}
              {error !== null && <ErrorText testID="pet-form-error">{error}</ErrorText>}
            </View>
          </View>
          <View style={wideStyles.footer}>
            {firstPet ? (
              <Button testID="later-button" label="Fazer depois" variant="soft" size="md" stretch={false} disabled={busy} onPress={() => router.replace("/")} />
            ) : (
              <Button testID="save-without-noseprint-button" label="Salvar sem focinho" variant="soft" size="md" stretch={false} disabled={busy} onPress={() => void save(false)} />
            )}
            <Button testID="save-pet-button" label="Continuar para o focinho" trailingIcon="arrowRight" size="md" stretch={false} busy={busy} onPress={() => void save(true)} />
          </View>
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[local.page, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeader step={1} steps={2} icon="close" onClose={firstPet ? undefined : close} />
      <View style={{ gap: 4 }}>
        {firstPet && state.kind === "ready" && <Text style={local.hello}>Olá, {state.owner.name}</Text>}
        <Text style={local.title} accessibilityRole="header">
          {firstPet ? "Vamos cadastrar seu primeiro cachorro" : "Novo cachorro"}
        </Text>
      </View>
      <View style={local.form}>
        <Pressable testID="pick-photo-button" accessibilityRole="button" accessibilityLabel="Escolher a foto do pet" onPress={choosePhoto} style={local.photoRow}>
          <View style={local.photo}>
            {photo ? (
              <Image testID="pet-form-photo" source={{ uri: photo.uri }} style={local.photoImage} />
            ) : (
              <Icon name="camera" size={28} color={colors.ink} />
            )}
            <View style={local.plus}>
              <Icon name="plus" size={16} color={colors.onPrimary} strokeWidth={3} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={local.photoTitle}>Foto do cachorro</Text>
            <Text style={local.photoText}>Da galeria ou câmera. Aparece no perfil e nos alertas.</Text>
          </View>
        </Pressable>
        {fields}
        {error !== null && <ErrorText testID="pet-form-error">{error}</ErrorText>}
      </View>
      <View style={{ gap: 10 }}>
        <Button testID="save-pet-button" label="Continuar para o focinho" trailingIcon="arrowRight" busy={busy} onPress={() => void save(true)} />
        {!firstPet && <Button testID="save-without-noseprint-button" label="Salvar sem focinho" variant="soft" size="md" disabled={busy} onPress={() => void save(false)} />}
        {firstPet && <Button testID="later-button" label="Fazer depois" variant="soft" size="md" disabled={busy} onPress={() => router.replace("/")} />}
      </View>
    </ScrollView>
  );
}

const wideStyles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 48 },
  column: { width: "100%", maxWidth: 960, alignSelf: "center", gap: 28 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  progress: { flexGrow: 1, flexBasis: 200, maxWidth: 360, flexDirection: "row", gap: 8 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  step: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textMuted },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 28, alignItems: "flex-start" },
  photoColumn: { flexGrow: 1, flexBasis: 260, gap: 10 },
  drop: { aspectRatio: 1, width: "100%", borderRadius: 28, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 12, padding: 20, overflow: "hidden" },
  dropImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  dropIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  fields: { flexGrow: 2, flexBasis: 380, minWidth: 0, gap: 16 },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
});

const local = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.lg },
  hello: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
  title: { fontFamily: fonts.title, fontSize: 30, color: colors.ink, letterSpacing: -0.6 },
  form: { flex: 1, gap: 14 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  photo: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  photoImage: { width: 88, height: 88, borderRadius: 44 },
  plus: { position: "absolute", right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.background, alignItems: "center", justifyContent: "center" },
  photoTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  photoText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  label: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
});
