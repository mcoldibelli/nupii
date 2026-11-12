import { useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { Icon, type IconName } from "./Icon";
import { Label } from "./Text";
import { colors, fonts, radius } from "./theme";

/** A filled text field of the canvas, with the label above it. */
export function Field({ label, icon, invalid = false, style, secureTextEntry, ...input }: TextInputProps & { label: string; icon?: IconName; invalid?: boolean }) {
  const [focused, setFocused] = useState(false);
  // A password field has a button that shows the text, as in the canvas.
  const [hidden, setHidden] = useState(true);
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
          secureTextEntry={secureTextEntry === true && hidden}
          {...input}
        />
        {secureTextEntry === true && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar senha" : "Esconder senha"}
            onPress={() => setHidden(!hidden)}
            style={{ width: 44, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="eye" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
