import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getNoseprint } from "../../src/api/biometrics";
import { listHealthEvents, listUpcomingCare, type HealthEvent, type HealthEventType, type UpcomingCare } from "../../src/api/health";
import { failureMessage, SESSION_FAILURE } from "../../src/api/http";
import { listPets, type Pet } from "../../src/api/pets";
import { apiUrl } from "../../src/config";
import { itemLine, itemStatus, lateCare, tabs, type Status } from "../../src/health/board";
import { careLine } from "../../src/health/care";
import { dateText, eventTitle, presetTypes, type Preset } from "../../src/health/form";
import { PetSwitcher } from "../../src/home/PetSwitcher";
import { useSelectedPet } from "../../src/pets/SelectedPetContext";
import { useSession } from "../../src/session/SessionContext";
import { Icon, type IconName } from "../../src/ui/Icon";
import { TabBar } from "../../src/ui/TabBar";
import { ErrorText } from "../../src/ui/Text";
import { colors, fonts, radius, space } from "../../src/ui/theme";

const typeIcons: Record<HealthEventType, IconName> = { vaccine: "syringe", consultation: "stethoscope", medication: "pill", exam: "flask", note: "calendar" };

const tones: Record<Status["tone"], { background: string; color: string }> = {
  ok: { background: colors.surface, color: colors.success },
  info: { background: colors.surface, color: colors.textSecondary },
  brand: { background: colors.primary, color: colors.onPrimary },
  late: { background: colors.danger, color: colors.onPrimary },
};

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

/** The health of a pet (Saude-Mobile artboard): the late care, the events by type (RF-27) and the Anotar sheet. */
export default function Health() {
  const { petId, petName } = useLocalSearchParams<{ petId: string; petName: string }>();
  const { idToken } = useSession();
  const { select } = useSelectedPet();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<HealthEvent[] | null>(null);
  const [care, setCare] = useState<UpcomingCare[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [noseprints, setNoseprints] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<HealthEventType>("vaccine");
  const [sheet, setSheet] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The list is read again when the owner comes back from the form.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await idToken();
        if (token === null) {
          setError(SESSION_FAILURE);
          return;
        }
        const [list, upcoming, mine] = await Promise.all([listHealthEvents(apiUrl, token, petId), listUpcomingCare(apiUrl, token), listPets(apiUrl, token)]);
        if (list.ok) {
          setEvents(list.value);
          setError(null);
        } else {
          setError(failureMessage(list));
        }
        setCare(upcoming.ok ? upcoming.value.filter((item) => item.petId === petId) : []);
        if (mine.ok) {
          setPets(mine.value);
          const dogs = mine.value.filter((item) => item.species === "dog");
          const found = await Promise.all(dogs.map((item) => getNoseprint(apiUrl, token, item.id)));
          setNoseprints(Object.fromEntries(dogs.map((item, i) => [item.id, found[i].ok && found[i].value !== null])));
        }
      })();
    }, [idToken, petId]),
  );

  const open = (type: HealthEventType, params: { eventId?: string; preset?: Preset; from?: string } = {}) =>
    router.push({ pathname: "/health/event", params: { petId, petName, type, ...params } });
  const pet = pets.find((item) => item.id === petId);
  const today = new Date().toISOString().slice(0, 10);
  const late = lateCare(care);
  const next = care.find((item) => item.dueDate >= today);
  const shown = (events ?? []).filter((event) => event.type === tab);
  const lateTypes = new Set(care.filter((item) => item.dueDate < today).map((item) => item.type));
  const current = tabs.find((item) => item.type === tab)!;

  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={[local.content, { paddingTop: insets.top + space.md }]}>
        <View style={local.top}>
          <Text style={local.title} accessibilityRole="header">
            Saúde
          </Text>
          <Pressable testID="health-pet" accessibilityRole="button" accessibilityLabel="Trocar de pet" style={local.petChip} onPress={() => setSwitcher(true)}>
            {pet?.photoUrl ? <Image source={{ uri: pet.photoUrl }} style={local.petPhoto} /> : <View style={[local.petPhoto, local.petEmpty]} />}
            <Text style={local.petName} numberOfLines={1}>
              {petName}
            </Text>
            <Icon name="chevronDown" size={16} />
          </Pressable>
          <Pressable testID="open-registrar" accessibilityRole="button" style={local.add} onPress={() => setSheet(true)}>
            <Icon name="plus" size={18} color={colors.onDark} strokeWidth={2.6} />
            <Text style={local.addText}>Anotar</Text>
          </Pressable>
        </View>

        {late ? (
          <View testID="late-banner" accessibilityRole="alert" style={[local.banner, { backgroundColor: colors.primary }]}>
            <View style={local.bannerIcon}>
              <Icon name="alert" size={22} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={local.bannerTitle}>{late.care.title} atrasado</Text>
              <Text style={local.bannerLine}>
                era para {dateText(late.care.dueDate).slice(0, 5)} · há {late.days} {late.days === 1 ? "dia" : "dias"}
              </Text>
            </View>
            <Pressable testID="given-button" accessibilityRole="button" style={local.bannerButton} onPress={() => open(late.care.type, { preset: "again", from: late.care.eventId })}>
              <Text style={local.bannerButtonText}>Já dei</Text>
            </Pressable>
          </View>
        ) : (
          <View testID="ok-banner" style={[local.banner, { backgroundColor: colors.dark }]}>
            <View style={[local.bannerIcon, { backgroundColor: colors.success }]}>
              <Icon name="check" size={22} color={colors.onPrimary} strokeWidth={2.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={local.bannerTitle}>Tudo em dia</Text>
              <Text style={[local.bannerLine, { color: colors.onDarkMuted }]}>{next ? `próximo: ${next.title.toLowerCase()} · ${careLine(next.dueDate)}` : "nenhum cuidado com data"}</Text>
            </View>
            <Pressable testID="open-share" accessibilityRole="button" style={local.bannerButton} onPress={() => router.push({ pathname: "/share/[petId]", params: { petId, petName } })}>
              <Text style={local.bannerButtonText}>Carteirinha</Text>
            </Pressable>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.tabs} accessibilityRole="tablist">
          {tabs.map((item) => {
            const selected = item.type === tab;
            return (
              <Pressable key={item.type} testID={`tab-${item.type}`} accessibilityRole="tab" accessibilityState={{ selected }} style={[local.tab, selected && { backgroundColor: colors.dark }]} onPress={() => setTab(item.type)}>
                <Text style={[local.tabText, selected && { color: colors.onDark }]}>{item.label}</Text>
                {!selected && lateTypes.has(item.type) && <View accessibilityLabel="com pendência" style={local.dot} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {error !== null && <ErrorText testID="health-error">{error}</ErrorText>}
        <View style={{ gap: 10 }} accessibilityLabel={current.label}>
          {events !== null && shown.length === 0 && (
            <Text testID="health-empty" style={local.empty}>
              Nada anotado em {current.label.toLowerCase()}.
            </Text>
          )}
          {shown.map((event) => {
            const status = itemStatus(event, care);
            const lateItem = status.tone === "late";
            return (
              <Pressable key={event.id} testID={`event-${event.id}`} accessibilityRole="button" style={[local.item, lateItem && { borderColor: colors.danger }]} onPress={() => open(event.type, { eventId: event.id })}>
                <View style={[local.itemIcon, lateItem && { backgroundColor: colors.danger }]}>
                  <Icon name={typeIcons[event.type]} size={20} color={lateItem ? colors.onPrimary : colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={local.itemTitle}>{eventTitle(event)}</Text>
                  <Text style={local.itemLine} numberOfLines={1}>
                    {itemLine(event)}
                  </Text>
                </View>
                <View style={[local.status, { backgroundColor: tones[status.tone].background }]}>
                  <Text style={[local.statusText, { color: tones[status.tone].color }]}>{status.label}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable testID={`new-${tab}`} accessibilityRole="button" style={local.addItem} onPress={() => open(tab)}>
            <Icon name="plus" size={18} />
            <Text style={local.addItemText}>{current.add}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <TabBar />

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable testID="registrar-close-overlay" accessibilityLabel="Fechar" style={local.overlay} onPress={() => setSheet(false)} />
        <View style={[local.sheet, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={local.handle} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={local.sheetTitle}>O que você quer anotar?</Text>
              <Text style={local.itemLine}>Fica no histórico de {petName} e gera lembretes</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={local.close} onPress={() => setSheet(false)}>
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
                onPress={() => {
                  setSheet(false);
                  open(option.preset ? presetTypes[option.preset] : option.type, option.preset ? { preset: option.preset } : {});
                }}
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

      <PetSwitcher
        visible={switcher}
        pets={pets}
        noseprints={noseprints}
        selectedId={petId}
        onPick={(item) => {
          setSwitcher(false);
          select({ id: item.id, name: item.name });
          router.setParams({ petId: item.id, petName: item.name });
        }}
        onAdd={() => {
          setSwitcher(false);
          router.push("/pets/new");
        }}
        onManage={() => {
          setSwitcher(false);
          router.push({ pathname: "/pets/[id]", params: { id: petId } });
        }}
        onClose={() => setSwitcher(false)}
      />
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: fonts.title, fontSize: 30, letterSpacing: -0.8, color: colors.ink },
  petChip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 140, minHeight: 44, paddingLeft: 4, paddingRight: 10, borderRadius: radius.pill, backgroundColor: colors.surface },
  petPhoto: { width: 32, height: 32, borderRadius: 16 },
  petEmpty: { backgroundColor: colors.borderDashed },
  petName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  add: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.dark },
  addText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onDark },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 24 },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPrimary },
  bannerLine: { fontFamily: fonts.body, fontSize: 14, color: colors.onPrimary },
  bannerButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.background, justifyContent: "center" },
  bannerButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  tabs: { gap: 6, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textSecondary },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, padding: 10, paddingRight: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border },
  itemIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  itemLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  status: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center" },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  addItem: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderDashed },
  addItemText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  overlay: { flex: 1, backgroundColor: "rgba(24,22,26,0.45)" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: space.xl, gap: space.lg },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderDashed },
  sheetTitle: { fontFamily: fonts.title, fontSize: 22, letterSpacing: -0.4, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: { width: "48%", flexGrow: 1, gap: 8, padding: 12, borderRadius: 20, backgroundColor: colors.surface },
  optionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  optionLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
