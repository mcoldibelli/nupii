import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { LocalFile, PetInput } from "../api/pets";
import { styles } from "../screens/styles";
import { toPetInput, type PetForm } from "./form";
import { neuteredLabels, sexLabels, sizeLabels, speciesLabels } from "./labels";
import { pickPhoto } from "./pickPhoto";

type Props = {
  initial: PetForm;
  /** Temporary URL of the photo that the pet has now. */
  photoUrl?: string;
  /** Saves the pet. Returns null, or the message of the failure. */
  onSubmit: (input: PetInput, photo: LocalFile | null) => Promise<string | null>;
  onDelete?: () => void;
};

/** One choice from a short list. A second tap on the chosen option clears it. */
function Choice<T extends string>(props: {
  name: string;
  labels: Record<T, string>;
  value: T | "";
  required?: boolean;
  onChange: (value: T | "") => void;
}) {
  return (
    <View style={local.choices} accessibilityRole="radiogroup">
      {(Object.keys(props.labels) as T[]).map((option) => {
        const selected = props.value === option;
        return (
          <Pressable
            key={option}
            testID={`${props.name}-${option}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[local.choice, selected && local.choiceSelected]}
            onPress={() => props.onChange(selected && !props.required ? "" : option)}
          >
            <Text style={selected ? local.choiceTextSelected : local.choiceText}>{props.labels[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The form of a pet, for the screens of new pet and of edit pet (RF-09, RF-10). */
export function PetFormView({ initial, photoUrl, onSubmit, onDelete }: Props) {
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
  const text = (label: string, field: "name" | "breed" | "birthDate" | "weightKg" | "vetName" | "vetClinic" | "vetPhone", extra?: object) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`pet-${field}-input`}
        accessibilityLabel={label}
        style={styles.input}
        value={form[field]}
        onChangeText={(value) => set(field, value)}
        {...extra}
      />
    </>
  );

  return (
    <ScrollView contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      <View style={local.photoRow}>
        {shownPhoto ? (
          <Image testID="pet-form-photo" accessibilityLabel="Foto de perfil do pet" source={{ uri: shownPhoto }} style={local.photo} />
        ) : (
          <View style={[local.photo, local.photoEmpty]} />
        )}
        <Pressable
          testID="pick-photo-button"
          accessibilityRole="button"
          style={styles.link}
          onPress={async () => {
            const picked = await pickPhoto();
            if (picked !== null) {
              setPhoto(picked);
            }
          }}
        >
          <Text style={styles.linkText}>{shownPhoto ? "Trocar a foto" : "Escolher uma foto"}</Text>
        </Pressable>
      </View>

      {text("Nome", "name", { maxLength: 100 })}
      <Text style={styles.label}>Espécie</Text>
      <Choice name="species" labels={speciesLabels} value={form.species} required onChange={(value) => set("species", value)} />
      {text("Raça", "breed", { maxLength: 100 })}
      <Text style={styles.label}>Sexo</Text>
      <Choice name="sex" labels={sexLabels} value={form.sex} onChange={(value) => set("sex", value)} />
      <Text style={styles.label}>Porte</Text>
      <Choice name="size" labels={sizeLabels} value={form.size} onChange={(value) => set("size", value)} />
      {text("Data de nascimento (DD/MM/AAAA)", "birthDate", { keyboardType: "numbers-and-punctuation", maxLength: 10 })}
      {text("Peso em quilos", "weightKg", { keyboardType: "decimal-pad", maxLength: 6 })}
      <Text style={styles.label}>Castrado</Text>
      <Choice name="neutered" labels={neuteredLabels} value={form.neutered} onChange={(value) => set("neutered", value)} />
      {text("Veterinário", "vetName", { maxLength: 120 })}
      {text("Clínica", "vetClinic", { maxLength: 120 })}
      {text("Telefone do veterinário", "vetPhone", { keyboardType: "phone-pad", maxLength: 30 })}

      {error !== null && (
        <Text testID="pet-form-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID="save-pet-button"
        accessibilityRole="button"
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.buttonText}>Salvar</Text>
      </Pressable>
      {onDelete && (
        <Pressable testID="delete-pet-button" accessibilityRole="button" style={styles.link} disabled={busy} onPress={onDelete}>
          <Text style={local.deleteText}>Excluir pet</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { backgroundColor: "#fff", padding: 24 },
  photoRow: { alignItems: "center", marginBottom: 16 },
  photo: { borderRadius: 48, height: 96, width: 96 },
  photoEmpty: { backgroundColor: "#ddd" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  choice: { borderColor: "#888", borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  choiceSelected: { backgroundColor: "#1f5fbf", borderColor: "#1f5fbf" },
  choiceText: { fontSize: 14 },
  choiceTextSelected: { color: "#fff", fontSize: 14 },
  deleteText: { color: "#b00020", fontSize: 16 },
});
