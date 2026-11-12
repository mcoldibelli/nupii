import { Pressable, ScrollView, Text, View, type ScrollViewProps, type ViewProps } from "react-native";

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
