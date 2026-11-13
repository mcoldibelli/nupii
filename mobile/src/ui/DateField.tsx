import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dayNumber, dayText, MONTH_NAMES, monthGrid, parseDay, type Day } from "./calendar";
import { Icon } from "./Icon";
import { Label } from "./Text";
import { colors, fonts, radius, space } from "./theme";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const FIRST_YEAR = 1990;

const today = (): Day => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
};

/**
 * A date field that opens a calendar in a sheet (#229). The value is the
 * text of the forms, DD/MM/AAAA. "filled" is the Field of the canvas,
 * "outlined" the field of the AddPet-Novo artboard.
 */
export function DateField({
  label,
  value,
  onChange,
  testID,
  noFuture = false,
  min,
  optional = false,
  look = "filled",
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  testID?: string;
  /** RN-50, RN-76: no day after today. */
  noFuture?: boolean;
  /** No day before this text (DD/MM/AAAA), as the next dose after the event. */
  min?: string;
  /** The sheet has "Limpar". */
  optional?: boolean;
  look?: "filled" | "outlined";
}) {
  const insets = useSafeAreaInsets();
  const chosen = parseDay(value);
  const start = chosen ?? today();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState({ year: start.year, month: start.month });
  const [pickYear, setPickYear] = useState(false);
  const minDay = min ? parseDay(min) : null;
  const maxYear = noFuture ? today().year : today().year + 5;
  const allowed = (day: Day) => (!noFuture || dayNumber(day) <= dayNumber(today())) && (minDay === null || dayNumber(day) >= dayNumber(minDay));

  const show = () => {
    const from = parseDay(value) ?? today();
    setShown({ year: from.year, month: from.month });
    setPickYear(false);
    setOpen(true);
  };
  const move = (step: number) =>
    setShown(({ year, month }) => {
      const next = month + step;
      return { year: year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  const pick = (day: Day) => {
    onChange(dayText(day));
    setOpen(false);
  };

  const outlined = look === "outlined";
  return (
    <View style={{ gap: outlined ? 8 : 6 }}>
      {outlined ? <Text style={local.outlinedLabel}>{label}</Text> : <Label>{label}</Label>}
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : `${label}: escolher a data`} style={outlined ? local.outlined : local.filled} onPress={show}>
        <Icon name="calendar" size={20} color={colors.textMuted} />
        <Text style={[local.value, !value && { color: colors.textMuted }]}>{value || "dd/mm/aaaa"}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Fechar" style={local.overlay} onPress={() => setOpen(false)} />
        <View style={[local.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={local.head}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" style={local.round} onPress={() => move(-1)}>
              <Icon name="back" size={18} />
            </Pressable>
            <Pressable testID="calendar-year" accessibilityRole="button" accessibilityLabel="Escolher o ano" style={local.title} onPress={() => setPickYear(!pickYear)}>
              <Text style={local.titleText}>
                {MONTH_NAMES[shown.month]} {shown.year}
              </Text>
              <Icon name="chevronDown" size={16} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" style={local.round} onPress={() => move(1)}>
              <Icon name="chevronRight" size={18} />
            </Pressable>
          </View>
          {pickYear ? (
            <FlatList
              style={{ height: 320 }}
              data={Array.from({ length: maxYear - FIRST_YEAR + 1 }, (_, i) => maxYear - i)}
              keyExtractor={(year) => String(year)}
              numColumns={4}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`calendar-year-${item}`}
                  accessibilityRole="button"
                  style={[local.year, item === shown.year && local.selected]}
                  onPress={() => {
                    setShown(({ month }) => ({ year: item, month }));
                    setPickYear(false);
                  }}
                >
                  <Text style={[local.yearText, item === shown.year && { color: colors.onDark }]}>{item}</Text>
                </Pressable>
              )}
            />
          ) : (
            <View>
              <View style={local.week}>
                {WEEKDAYS.map((name, i) => (
                  <Text key={i} style={local.weekday}>
                    {name}
                  </Text>
                ))}
              </View>
              <View style={local.grid}>
                {monthGrid(shown.year, shown.month).map((number, i) => {
                  if (number === null) {
                    return <View key={i} style={local.cell} />;
                  }
                  const day = { ...shown, day: number };
                  const enabled = allowed(day);
                  const selected = chosen !== null && dayNumber(chosen) === dayNumber(day);
                  const isToday = dayNumber(today()) === dayNumber(day);
                  return (
                    <Pressable
                      key={i}
                      testID={`calendar-day-${number}`}
                      accessibilityRole="button"
                      accessibilityLabel={dayText(day)}
                      accessibilityState={{ disabled: !enabled, selected }}
                      disabled={!enabled}
                      style={local.cell}
                      onPress={() => pick(day)}
                    >
                      <View style={[local.dayCircle, isToday && local.today, selected && local.selected]}>
                        <Text style={[local.dayText, !enabled && { color: colors.textDisabled }, selected && { color: colors.onDark }]}>{number}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {optional && value !== "" && (
              <Pressable
                testID="calendar-clear"
                accessibilityRole="button"
                style={local.action}
                onPress={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Text style={local.actionText}>Limpar</Text>
              </Pressable>
            )}
            {allowed(today()) && (
              <Pressable testID="calendar-today" accessibilityRole="button" style={local.action} onPress={() => pick(today())}>
                <Text style={local.actionText}>Hoje</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const local = StyleSheet.create({
  outlinedLabel: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textSecondary },
  outlined: { minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderStrong, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  filled: { minHeight: 52, borderRadius: radius.field, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  value: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  overlay: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: space.lg, paddingHorizontal: space.xl, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  titleText: { fontFamily: fonts.titleBold, fontSize: 19, color: colors.ink },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  today: { borderWidth: 1.5, borderColor: colors.brand },
  selected: { backgroundColor: colors.dark },
  dayText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  year: { flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  yearText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  action: { flex: 1, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
