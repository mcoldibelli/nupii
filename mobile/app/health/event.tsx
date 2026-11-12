import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

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
import { attachmentFailure, emptyValues, fieldsOf, toEventInput, typeLabels, valuesFromEvent, type Field, type Values } from "../../src/health/form";
import { pickAttachment } from "../../src/health/pickFile";
import { filePart } from "../../src/pets/pickPhoto";
import { styles } from "../../src/screens/styles";
import { useSession } from "../../src/session/SessionContext";
import { colors, fonts } from "../../src/ui/theme";

/** Creates or changes a health event of one of the five types (RF-27), with its attachments (RF-28). */
export default function HealthEventForm() {
  const { petId, type, eventId } = useLocalSearchParams<{ petId: string; type: HealthEventType; eventId?: string }>();
  const { idToken } = useSession();
  const [values, setValues] = useState<Values>(emptyValues);
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
      router.replace({ pathname: "/health/event", params: { petId, type, eventId: saved.value.id } });
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
    if (field.kind === "switch") {
      return (
        <View key={field.key} style={styles.row}>
          <Switch
            testID={`field-${field.key}`}
            value={values[field.key] === true}
            onValueChange={(value) => set(field.key, value)}
            trackColor={{ false: colors.borderDashed, true: colors.success }}
            thumbColor={colors.background}
          />
          <Text style={styles.rowText}>{field.label}</Text>
        </View>
      );
    }
    if (field.kind === "choice") {
      return (
        <View key={field.key}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={local.choices}>
            {Object.entries(field.options ?? {}).map(([option, label]) => (
              <Pressable
                key={option}
                testID={`field-${field.key}-${option}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: values[field.key] === option }}
                style={[local.choice, values[field.key] === option && local.choiceSelected]}
                onPress={() => set(field.key, option)}
              >
                <Text style={values[field.key] === option ? local.choiceTextSelected : local.choiceText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }
    return (
      <View key={field.key}>
        <Text style={styles.label}>{field.label}</Text>
        <TextInput
          testID={`field-${field.key}`}
          accessibilityLabel={field.label}
          style={[styles.input, field.kind === "long" && local.long]}
          multiline={field.kind === "long"}
          keyboardType={field.kind === "weight" ? "decimal-pad" : field.kind === "days" ? "number-pad" : field.kind === "date" ? "numbers-and-punctuation" : "default"}
          value={String(values[field.key])}
          onChangeText={(value) => set(field.key, value)}
        />
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
      <Text style={local.heading}>{typeLabels[type]}</Text>
      <Text style={styles.label}>Data (DD/MM/AAAA)</Text>
      <TextInput
        testID="field-date"
        accessibilityLabel="Data"
        style={styles.input}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        value={values.date}
        onChangeText={(value) => set("date", value)}
      />
      {fieldsOf(type).map(input)}
      <Text style={styles.label}>Observações</Text>
      <TextInput
        testID="field-notes"
        accessibilityLabel="Observações"
        style={[styles.input, local.long]}
        multiline
        value={values.notes}
        onChangeText={(value) => set("notes", value)}
      />

      {eventId !== undefined && (
        <>
          <Text style={local.section}>Anexos</Text>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={local.attachment}>
              <Pressable accessibilityRole="link" style={local.attachmentName} onPress={() => void Linking.openURL(attachment.url)}>
                <Text style={styles.linkText}>{attachment.fileName}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => removeAttachment(attachment)}>
                <Text style={local.remove}>Remover</Text>
              </Pressable>
            </View>
          ))}
          <Pressable testID="add-attachment" accessibilityRole="button" style={styles.link} disabled={busy} onPress={addAttachment}>
            <Text style={styles.linkText}>Adicionar anexo (foto ou PDF)</Text>
          </Pressable>
        </>
      )}

      {error !== null && (
        <Text testID="event-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable testID="save-event" accessibilityRole="button" style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} onPress={save}>
        <Text style={styles.buttonText}>Salvar</Text>
      </Pressable>
      {eventId !== undefined && (
        <Pressable testID="delete-event" accessibilityRole="button" style={styles.link} onPress={confirmDelete}>
          <Text style={local.remove}>Apagar evento</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { backgroundColor: colors.background, flexGrow: 1, padding: 16 },
  heading: { fontSize: 22, fontFamily: fonts.titleBold, marginBottom: 12 },
  long: { minHeight: 80, textAlignVertical: "top" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  choice: { borderColor: colors.textMuted, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontFamily: fonts.body, fontSize: 14 },
  choiceTextSelected: { fontFamily: fonts.body, color: colors.background, fontSize: 14 },
  section: { fontSize: 18, fontFamily: fonts.titleBold, marginTop: 16 },
  attachment: { alignItems: "center", flexDirection: "row", paddingVertical: 6 },
  attachmentName: { flex: 1 },
  remove: { fontFamily: fonts.body, color: colors.dangerText, fontSize: 15 },
});
