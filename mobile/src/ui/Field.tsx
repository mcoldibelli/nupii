import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Icon, type IconName } from "./Icon";
import { Label } from "./Text";
import { colors, fonts, radius } from "./theme";

/** A filled text field of the canvas, with the label above it. */
export function Field({ label, icon, invalid = false, style, ...input }: TextInputProps & { label: string; icon?: IconName; invalid?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <View
        style={{
          minHeight: 52,
          borderRadius: radius.field,
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: invalid ? colors.danger : focused ? colors.ink : "transparent",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
        }}
      >
        {icon && <Icon name={icon} size={20} color={colors.textMuted} />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{ flex: 1, minHeight: 48, fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.ink }, style]}
          {...input}
        />
      </View>
    </View>
  );
}
