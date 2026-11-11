import type { HealthEvent, HealthEventInput, HealthEventType } from "../api/health";
import { failureMessage } from "../api/http";
import { parseDate } from "../pets/form";

/** The kind of input of a field of the form. */
export type FieldKind = "text" | "long" | "date" | "weight" | "days" | "switch" | "choice";

export type Field = {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** The options of a choice, with their texts. */
  options?: Record<string, string>;
};

export type FieldKey =
  | "name"
  | "vet"
  | "manufacturer"
  | "batch"
  | "dose"
  | "nextDoseDate"
  | "clinic"
  | "reason"
  | "diagnosis"
  | "weightKg"
  | "returnDate"
  | "medicationCategory"
  | "activeIngredient"
  | "dosage"
  | "frequency"
  | "endDate"
  | "inUse"
  | "intervalDays"
  | "lab"
  | "result"
  | "noteCategory"
  | "title"
  | "remind";

/** The texts and the switches of the form. An empty text has no value. */
export type Values = { date: string; notes: string } & Record<FieldKey, string | boolean>;

export const typeLabels: Record<HealthEventType, string> = {
  vaccine: "Vacina",
  consultation: "Consulta",
  medication: "Medicação",
  exam: "Exame",
  note: "Anotação",
};

const medicationCategories = { medication: "Medicação", flea: "Antipulgas", deworm: "Vermífugo" };
const noteCategories = {
  disease: "Doença",
  weight: "Peso",
  allergy: "Alergia",
  surgery: "Cirurgia",
  note: "Nota",
  symptom: "Sintoma",
};

/** The fields of each type of event, after the date and before the notes (RN-37, RN-38, RN-77 to RN-79). */
const fields: Record<HealthEventType, Field[]> = {
  vaccine: [
    { key: "name", label: "Nome da vacina", kind: "text", required: true },
    { key: "manufacturer", label: "Fabricante", kind: "text" },
    { key: "batch", label: "Lote", kind: "text" },
    { key: "dose", label: "Dose", kind: "text" },
    { key: "vet", label: "Veterinário", kind: "text" },
    { key: "nextDoseDate", label: "Próxima dose (DD/MM/AAAA)", kind: "date" },
    { key: "remind", label: "Mostrar nos próximos cuidados", kind: "switch" },
  ],
  consultation: [
    { key: "reason", label: "Motivo", kind: "text", required: true },
    { key: "clinic", label: "Clínica", kind: "text" },
    { key: "vet", label: "Veterinário", kind: "text" },
    { key: "diagnosis", label: "Diagnóstico", kind: "long" },
    { key: "weightKg", label: "Peso em quilos", kind: "weight" },
    { key: "returnDate", label: "Retorno (DD/MM/AAAA)", kind: "date" },
  ],
  medication: [
    { key: "name", label: "Nome da medicação", kind: "text", required: true },
    { key: "medicationCategory", label: "Categoria", kind: "choice", required: true, options: medicationCategories },
    { key: "activeIngredient", label: "Princípio ativo", kind: "text" },
    { key: "dosage", label: "Dosagem", kind: "text" },
    { key: "frequency", label: "Frequência", kind: "text" },
    { key: "endDate", label: "Fim (DD/MM/AAAA)", kind: "date" },
    { key: "inUse", label: "Em uso", kind: "switch" },
    { key: "intervalDays", label: "Intervalo entre as doses, em dias", kind: "days" },
    { key: "remind", label: "Mostrar nos próximos cuidados", kind: "switch" },
  ],
  exam: [
    { key: "name", label: "Nome do exame", kind: "text", required: true },
    { key: "lab", label: "Laboratório", kind: "text" },
    { key: "vet", label: "Veterinário", kind: "text" },
    { key: "result", label: "Resultado", kind: "long" },
  ],
  note: [
    { key: "noteCategory", label: "Categoria", kind: "choice", required: true, options: noteCategories },
    { key: "title", label: "Título", kind: "text", required: true },
    { key: "weightKg", label: "Peso em quilos", kind: "weight" },
  ],
};

export function fieldsOf(type: HealthEventType): Field[] {
  return fields[type];
}

const allKeys: FieldKey[] = [...new Set(Object.values(fields).flatMap((list) => list.map((field) => field.key)))];

export function emptyValues(): Values {
  const values = { date: "", notes: "" } as Values;
  for (const key of allKeys) {
    // RN-81: a medication is in use until the owner says it is not.
    values[key] = key === "inUse" ? true : key === "remind" ? false : "";
  }
  return values;
}

const missingText: Partial<Record<FieldKey, string>> = { reason: "Informe o motivo.", title: "Informe o título." };

export type InputResult = { ok: true; input: HealthEventInput } | { ok: false; message: string };

// RN-80: textos curtos com até 120 caracteres, e longos com até 2.000.
const maxLength = { text: 120, long: 2000 } as const;

/** Converts the texts of the form to the input of the API, with the rules of the type. */
export function toEventInput(type: HealthEventType, values: Values, now: Date = new Date()): InputResult {
  const invalid = (message: string): InputResult => ({ ok: false, message });
  // RN-76: todo evento tem data, e a data não é futura.
  const date = parseDate(values.date.trim());
  if (date === null) {
    return invalid("Informe a data no formato DD/MM/AAAA.");
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.time > today) {
    return invalid("A data do evento não pode ser futura.");
  }
  const input: Record<string, unknown> = { type, date: date.iso };
  const notes = values.notes.trim();
  if ([...notes].length > maxLength.long) {
    return invalid("As observações podem ter no máximo 2.000 caracteres.");
  }
  if (notes !== "") {
    input.notes = notes;
  }

  for (const field of fieldsOf(type)) {
    const value = values[field.key];
    if (field.kind === "switch") {
      if (value === true) {
        input[field.key] = true;
      } else if (field.key === "inUse" && value === false && type === "medication") {
        // A medication that is not in use leaves the upcoming care.
        input[field.key] = false;
      }
      continue;
    }
    const text = String(value).trim();
    if (text === "") {
      if (field.required) {
        return invalid(field.kind === "choice" ? "Escolha a categoria." : (missingText[field.key] ?? "Informe o nome."));
      }
      continue;
    }
    switch (field.kind) {
      case "text":
      case "long":
        if ([...text].length > maxLength[field.kind]) {
          const what = field.key === "name" ? "O nome" : field.label;
          return invalid(`${what} pode ter no máximo ${maxLength[field.kind]} caracteres.`);
        }
        input[field.key] = text;
        break;
      case "choice":
        input[field.key] = text;
        break;
      case "date": {
        const later = parseDate(text);
        if (later === null) {
          return invalid(`Informe a data de "${field.label}" no formato DD/MM/AAAA.`);
        }
        if (later.time < date.time) {
          const names: Partial<Record<FieldKey, string>> = { nextDoseDate: "A próxima dose", returnDate: "O retorno", endDate: "O fim" };
          return invalid(`${names[field.key]} não pode ser antes da data do evento.`);
        }
        input[field.key] = later.iso;
        break;
      }
      case "weight": {
        // RN-51: de 0,01 kg a 999,99 kg, com até 2 casas decimais.
        const number = text.replace(",", ".");
        const weight = Number(number);
        if (!/^\d{1,3}(\.\d{1,2})?$/.test(number) || weight < 0.01 || weight > 999.99) {
          return invalid("Informe o peso em quilos, de 0,01 a 999,99, com até 2 casas decimais.");
        }
        input[field.key] = weight;
        break;
      }
      case "days": {
        // RN-37: o intervalo vai de 1 a 365 dias.
        const days = Number(text);
        if (!/^\d+$/.test(text) || days < 1 || days > 365) {
          return invalid("O intervalo vai de 1 a 365 dias.");
        }
        input[field.key] = days;
        break;
      }
    }
  }
  // RN-37, RN-77: com a opção de lembrar, a medicação tem o intervalo e a
  // vacina tem a próxima dose.
  if (input.remind === true && type === "medication" && input.intervalDays === undefined) {
    return invalid("Informe o intervalo para mostrar nos próximos cuidados.");
  }
  if (input.remind === true && type === "vaccine" && input.nextDoseDate === undefined) {
    return invalid("Informe a próxima dose para mostrar nos próximos cuidados.");
  }
  return { ok: true, input: input as HealthEventInput };
}

/** The message of a failed upload of an attachment (RN-82). */
export function attachmentFailure(result: { ok: false; code: string }): string {
  if (result.code === "attachment_limit") {
    return "O evento já tem 10 anexos.";
  }
  if (result.code === "invalid_request") {
    return "O anexo precisa ser uma imagem JPEG, PNG ou WebP, ou um PDF, de até 10 MB.";
  }
  return failureMessage(result);
}

export function dateText(iso: string | undefined): string {
  if (iso === undefined) {
    return "";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Converts an event of the API to the texts and the switches of the form. */
export function valuesFromEvent(event: HealthEvent): Values {
  const values = emptyValues();
  values.date = dateText(event.date);
  values.notes = event.notes ?? "";
  for (const field of fieldsOf(event.type)) {
    const value = (event as Record<string, unknown>)[field.key];
    if (value === undefined || value === null) {
      continue;
    }
    if (field.kind === "switch") {
      values[field.key] = value === true;
    } else if (field.kind === "date") {
      values[field.key] = dateText(String(value));
    } else if (field.kind === "weight") {
      values[field.key] = String(value).replace(".", ",");
    } else {
      values[field.key] = String(value);
    }
  }
  return values;
}

/** The title of an event in the list. */
export function eventTitle(event: HealthEvent): string {
  const name = event.name ?? event.reason ?? event.title ?? "";
  return name === "" ? typeLabels[event.type] : `${typeLabels[event.type]}: ${name}`;
}
