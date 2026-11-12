import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createHealthEvent,
  deleteHealthAttachment,
  deleteHealthEvent,
  listHealthAttachments,
  listHealthEvents,
  updateHealthEvent,
  uploadHealthAttachment,
  type HealthAttachment,
  type HealthEventType,
} from "../../src/api/health";
import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import { apiUrl } from "../../src/config";
import { attachmentFailure, emptyValues, fieldsOf, presetValues, toEventInput, typeLabels, valuesFromEvent, type Field, type Preset, type Values } from "../../src/health/form";
import { pickAttachment } from "../../src/health/pickFile";
import { filePart } from "../../src/pets/pickPhoto";
import { useSession } from "../../src/session/SessionContext";
import { Button } from "../../src/ui/Button";
import { Field as Input } from "../../src/ui/Field";
import { Icon } from "../../src/ui/Icon";
import { ErrorText, Label } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";

/** The type chips of the Saude-Mobile-Form artboard. A medication chip also sets the category. */
const chips: { label: string; type: HealthEventType; category?: string }[] = [
  { label: "Vacina", type: "vaccine" },
  { label: "Vermífugo", type: "medication", category: "deworm" },
  { label: "Antipulgas", type: "medication", category: "flea" },
  { label: "Medicação", type: "medication", category: "medication" },
  { label: "Consulta", type: "consultation" },
  { label: "Exame", type: "exam" },
  { label: "Anotação", type: "note" },
];

/** The title of the form, as "Nova vacina" and "Dose de antipulgas" in the canvas. */
function formTitle(type: HealthEventType, values: Values, editing: boolean): string {
  if (editing) {
    return typeLabels[type];
  }
  if (type === "medication" && values.medicationCategory === "flea") {
    return "Dose de antipulgas";
  }
  if (type === "medication" && values.medicationCategory === "deworm") {
    return "Dose de vermífugo";
  }
  if (type === "note" && values.noteCategory === "weight") {
    return "Peso de hoje";
  }
  return { vaccine: "Nova vacina", consultation: "Nova consulta", medication: "Nova medicação", exam: "Novo exame", note: "Nova anotação" }[type];
}

/** Creates or changes a health event of one of the five types (RF-27), with its attachments (RF-28). */
export default function HealthEventForm() {
  const params = useLocalSearchParams<{ petId: string; petName?: string; type: HealthEventType; eventId?: string; preset?: Preset; from?: string }>();
  const { petId, petName, eventId, preset, from } = params;
  const { idToken } = useSession();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<HealthEventType>(params.type);
  const [values, setValues] = useState<Values>(() => (preset && preset !== "again" ? presetValues(preset, undefined) : emptyValues()));
  const [attachments, setAttachments] = useState<HealthAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function withToken<T>(work: (token: string) => Promise<T>): Promise<T | null> {
    const token = await idToken();
    if (token === null) {
      setError(SESSION_FAILURE);
      return null;
    }
    return work(token);
  }

  // "Já dei": the new dose copies the event of the late care (RN-81).
  useEffect(() => {
    if (preset !== "again" || from === undefined) {
      return;
    }
    void withToken(async (token) => {
      const list = await listHealthEvents(apiUrl, token, petId);
      const source = list.ok ? list.value.find((item) => item.id === from) : undefined;
      setValues(presetValues("again", source));
    });
    // The screen reads the source one time, when it opens.
  }, [from, petId, preset]);

  useEffect(() => {
    if (eventId === undefined) {
      return;
    }
    void withToken(async (token) => {
      // The list of the pet has the event: the API has no read of one event.
      const [list, files] = await Promise.all([
        listHealthEvents(apiUrl, token, petId),
        listHealthAttachments(apiUrl, token, petId, eventId),
      ]);
      const event = list.ok ? list.value.find((item) => item.id === eventId) : undefined;
      if (event !== undefined) {
        setValues(valuesFromEvent(event));
      } else {
        setError(list.ok ? "Este evento não existe mais." : failureMessage(list));
      }
      if (files.ok) {
        setAttachments(files.value);
      }
    });
    // The screen reads the event one time, when it opens.
  }, [eventId, petId]);

  const set = (key: keyof Values, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));

  async function save() {
    const result = toEventInput(type, values);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBusy(true);
    setError(null);
    const saved = await withToken((token) =>
      eventId === undefined
        ? createHealthEvent(apiUrl, token, petId, result.input)
        : updateHealthEvent(apiUrl, token, petId, eventId, result.input),
    );
    setBusy(false);
    if (saved === null) {
      return;
    }
    if (!saved.ok) {
      setError(failureMessage(saved));
    } else if (eventId === undefined) {
      // A new event opens in the edit mode, where the attachments are.
      router.replace({ pathname: "/health/event", params: { petId, petName, type, eventId: saved.value.id } });
    } else {
      router.back();
    }
  }

  function confirmDelete() {
    Alert.alert("Apagar evento", "Apagar este evento e os anexos dele?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          if (eventId === undefined) {
            return;
          }
          const result = await withToken((token) => deleteHealthEvent(apiUrl, token, petId, eventId));
          if (result?.ok) {
            router.back();
          } else if (result) {
            setError(failureMessage(result));
          }
        },
      },
    ]);
  }

  async function addAttachment() {
    if (eventId === undefined) {
      return;
    }
    const file = await pickAttachment();
    if (file === null) {
      return;
    }
    setBusy(true);
    const result = await withToken((token) => uploadHealthAttachment(apiUrl, token, petId, eventId, filePart(file), file.name));
    setBusy(false);
    if (result?.ok) {
      setAttachments((current) => [...current, result.value]);
    } else if (result) {
      setError(attachmentFailure(result));
    }
  }

  async function removeAttachment(attachment: HealthAttachment) {
    if (eventId === undefined) {
      return;
    }
    const result = await withToken((token) => deleteHealthAttachment(apiUrl, token, petId, eventId, attachment.id));
    if (result?.ok) {
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } else if (result) {
      setError(failureMessage(result));
    }
  }

  const input = (field: Field) => {
    // A new event takes the category of the medication from the chips.
    if (field.key === "medicationCategory" && eventId === undefined) {
      return null;
    }
    if (field.kind === "switch") {
      return (
        <View key={field.key} style={local.switchRow}>
          <Text style={local.switchLabel}>{field.key === "remind" ? "Lembrar antes" : field.label}</Text>
          <Switch
            testID={`field-${field.key}`}
            accessibilityLabel={field.label}
            value={values[field.key] === true}
            onValueChange={(value) => set(field.key, value)}
            trackColor={{ false: colors.borderDashed, true: colors.success }}
            thumbColor={colors.background}
          />
        </View>
      );
    }
    if (field.kind === "choice") {
      return (
        <View key={field.key} style={{ gap: 6 }}>
          <Label>{field.label}</Label>
          <View style={local.choices}>
            {Object.entries(field.options ?? {}).map(([option, label]) => {
              const selected = values[field.key] === option;
              return (
                <Pressable
                  key={option}
                  testID={`field-${field.key}-${option}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[local.chip, selected && local.chipSelected]}
                  onPress={() => set(field.key, option)}
                >
                  <Text style={[local.chipText, selected && { color: colors.onDark }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }
    return (
      <Input
        key={field.key}
        testID={`field-${field.key}`}
        label={field.label}
        icon={field.kind === "date" ? "calendar" : undefined}
        multiline={field.kind === "long"}
        style={field.kind === "long" ? local.long : undefined}
        keyboardType={field.kind === "weight" ? "decimal-pad" : field.kind === "days" ? "number-pad" : field.kind === "date" ? "numbers-and-punctuation" : "default"}
        value={String(values[field.key])}
        onChangeText={(value) => set(field.key, value)}
      />
    );
  };

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.md }]} keyboardShouldPersistTaps="handled">
        <View style={local.top}>
          <Pressable testID="close-event" accessibilityRole="button" accessibilityLabel="Fechar" style={local.close} onPress={() => router.back()}>
            <Icon name="close" size={18} strokeWidth={2.4} />
          </Pressable>
          {petName ? (
            <View style={local.petChip}>
              <Text style={local.petName}>{petName}</Text>
            </View>
          ) : null}
        </View>
        <Text style={local.heading} accessibilityRole="header">
          {formTitle(type, values, eventId !== undefined)}
        </Text>
        {eventId === undefined && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -space.xl }} accessibilityRole="radiogroup">
            <View style={{ width: space.xl - 8 }} />
            {chips.map((chip) => {
              const selected = chip.type === type && (chip.category === undefined || chip.category === values.medicationCategory);
              return (
                <Pressable
                  key={chip.label}
                  testID={`type-${chip.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[local.chip, selected && local.chipSelected]}
                  onPress={() => {
                    setType(chip.type);
                    if (chip.category) {
                      set("medicationCategory", chip.category);
                    }
                  }}
                >
                  <Text style={[local.chipText, selected && { color: colors.onDark }]}>{chip.label}</Text>
                </Pressable>
              );
            })}
            <View style={{ width: space.xl - 8 }} />
          </ScrollView>
        )}
        <Input testID="field-date" label="Data (DD/MM/AAAA)" icon="calendar" keyboardType="numbers-and-punctuation" maxLength={10} value={values.date} onChangeText={(value) => set("date", value)} />
        {fieldsOf(type).map(input)}
        <Input testID="field-notes" label="Observações" multiline style={local.long} value={values.notes} onChangeText={(value) => set("notes", value)} />

        {eventId !== undefined && (
          <View style={local.attachments}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={local.switchLabel}>Anexos</Text>
                <Text style={local.muted}>opcional · foto ou PDF</Text>
              </View>
              <Button testID="add-attachment" label="Adicionar" icon="camera" variant="dark" size="sm" stretch={false} disabled={busy} onPress={() => void addAttachment()} />
            </View>
            {attachments.map((attachment) => (
              <View key={attachment.id} style={local.attachment}>
                <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => void Linking.openURL(attachment.url)}>
                  <Text style={local.link}>{attachment.fileName}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" hitSlop={10} onPress={() => removeAttachment(attachment)}>
                  <Text style={local.remove}>Remover</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {error !== null && <ErrorText testID="event-error">{error}</ErrorText>}
        {eventId !== undefined && <Button testID="delete-event" label="Apagar evento" variant="soft" size="md" onPress={confirmDelete} />}
      </ScrollView>
      <View style={[local.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button testID="save-event" label="Salvar" busy={busy} onPress={() => void save()} />
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  petChip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center" },
  petName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  heading: { fontFamily: fonts.title, fontSize: 28, letterSpacing: -0.8, color: colors.ink },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center" },
  chipSelected: { backgroundColor: colors.dark },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  long: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  switchLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  attachments: { gap: 8, padding: 14, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed },
  attachment: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.link },
  remove: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.dangerText },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: colors.background },
});
