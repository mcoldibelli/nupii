import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors, fonts, radius } from "./theme";

type Variant = "primary" | "dark" | "soft" | "outline" | "danger";

const looks: Record<Variant, { background: string; color: string; border?: string }> = {
  primary: { background: colors.primary, color: colors.onPrimary },
  dark: { background: colors.dark, color: colors.onDark },
  soft: { background: colors.surface, color: colors.ink },
  outline: { background: colors.background, color: colors.ink, border: colors.borderStrong },
  danger: { background: colors.danger, color: colors.onPrimary },
};

const heights = { lg: 56, md: 48, sm: 38 } as const;

/** A pill button of the canvas. */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  trailingIcon,
  disabled = false,
  busy = false,
  testID,
  stretch = true,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: keyof typeof heights;
  icon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  stretch?: boolean;
}) {
  const look = looks[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: heights[size],
        paddingHorizontal: size === "sm" ? 14 : 18,
        borderRadius: radius.pill,
        backgroundColor: look.background,
        borderWidth: look.border ? 1.5 : 0,
        borderColor: look.border,
        alignSelf: stretch ? "stretch" : "flex-start",
        justifyContent: "center",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {busy ? <ActivityIndicator color={look.color} /> : icon && <Icon name={icon} size={18} color={look.color} />}
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: size === "sm" ? 14 : size === "md" ? 15 : 17, color: look.color }}>{label}</Text>
        {trailingIcon && <Icon name={trailingIcon} size={18} color={look.color} />}
      </View>
    </Pressable>
  );
}
