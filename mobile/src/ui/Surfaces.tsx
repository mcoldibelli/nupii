import { Pressable, ScrollView, Text, View, type ScrollViewProps, type ViewProps } from "react-native";

import { Icon } from "./Icon";
import { colors, fonts, radius, space } from "./theme";

/** The page of a screen: white, with the side spaces of the canvas. */
export function Screen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.lg }, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/** A grey card with rounded corners and no shadow. */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.sm }, style]} {...props} />;
}

type Tone = "neutral" | "success" | "brand" | "danger";

const tones: Record<Tone, { background: string; color: string }> = {
  neutral: { background: colors.surface, color: colors.textSecondary },
  success: { background: colors.surface, color: colors.success },
  brand: { background: colors.primary, color: colors.onPrimary },
  danger: { background: colors.danger, color: colors.onPrimary },
};

/** A small status pill, as the dates and states of the health list. */
export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const look = tones[tone];
  return (
    <View style={{ minHeight: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: look.background, justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: look.color }}>{label}</Text>
    </View>
  );
}

/** The segmented tabs of the canvas: one pill per option, the chosen one dark. */
export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; testID?: string }) {
  return (
    <View testID={testID} accessibilityRole="tablist" style={{ flexDirection: "row", minHeight: 46, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{ flex: 1, minHeight: 38, borderRadius: radius.pill, backgroundColor: selected ? colors.dark : "transparent", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: selected ? colors.onDark : colors.textSecondary }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The square check box of the canvas, with its text beside it. */
export function Checkbox({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (checked: boolean) => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: checked ? colors.dark : colors.textDisabled,
          backgroundColor: checked ? colors.dark : colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Icon name="check" size={14} color={colors.onDark} strokeWidth={3.2} />}
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** The round back button of the canvas, for a screen with no header. */
export function BackButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="back" size={18} strokeWidth={2.4} />
    </Pressable>
  );
}

/** The top of a step of a flow (AddPet-Novo artboard): a round button, the progress bars and "N de M". The first access has no button (AddPet-Primeiro). */
export function StepHeader({ step, steps, onClose, icon = "back" }: { step: number; steps: number; onClose?: () => void; icon?: "back" | "close" }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
      {onClose && (
      <Pressable
        testID="step-close"
        accessibilityRole="button"
        accessibilityLabel={icon === "close" ? "Fechar" : "Voltar"}
        onPress={onClose}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name={icon} size={18} strokeWidth={2.4} color={colors.ink} />
      </Pressable>
      )}
      {steps > 1 && (
        <>
          <View style={{ flex: 1, flexDirection: "row", gap: 8 }} accessibilityLabel={`Passo ${step} de ${steps}`}>
            {Array.from({ length: steps }, (_, index) => (
              <View key={index} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: index < step ? colors.brand : colors.border }} />
            ))}
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textMuted }}>
            {step} de {steps}
          </Text>
        </>
      )}
    </View>
  );
}
