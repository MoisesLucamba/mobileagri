import React, { useRef } from "react";
import { Animated, Pressable, Text, View, ViewStyle, StyleProp } from "react-native";

import Icon, { IconName } from "./Icon";

/* ------------------------------- tema único ------------------------------- */

export const COLORS = {
  primary: "#218B4A",
  primaryLight: "#218B4A",
  primaryDark: "#218B4A",
  tint: "#EAF5ED",
  tintSoft: "#F4F9F5",
  text: "#16231C",
  muted: "#6D7B71",
  faint: "#A5B0A7",
  line: "#E6EBE6",
  bg: "#F3F6F2",
  red: "#E0523A",
  redSoft: "#FDECE8",
  white: "#FFFEFC",
};

// Sombras largas e suaves em vez de bordas: dão a sensação de "flutuar"
export const SHADOW = {
  soft: {
    shadowColor: "#16231C",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  } as ViewStyle,
  tiny: {
    shadowColor: "#16231C",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } as ViewStyle,
  glow: {
    shadowColor: "#218B4A",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  } as ViewStyle,
};

/* --------------------------- toque com mola suave --------------------------- */

export function PressableScale({
  children,
  onPress,
  className,
  style,
  scale = 0.96,
  disabled,
  fill,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  scale?: number;
  disabled?: boolean;
  fill?: boolean;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      style={fill ? { flex: 1 } : undefined}
    >
      <Animated.View style={[{ transform: [{ scale: sc }] }, fill ? { flex: 1 } : null]}>
        <View className={className} style={[fill ? { flex: 1 } : null, style]}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------ botão verde com brilho que passa ------------------------ */

export function ShineButton({
  onPress,
  label,
  icon,
  height = 40,
  disabled,
  style,
}: {
  onPress?: () => void;
  label: string;
  icon?: IconName;
  height?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const press = useRef(new Animated.Value(1)).current;

  const to = (v: number) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 8 }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(1)}
      style={style}
    >
      <Animated.View style={[SHADOW.glow, { transform: [{ scale: press }], borderRadius: 10 }]}>
        <View
          style={{
            height,
            paddingHorizontal: 18,
            borderRadius: 10,
            backgroundColor: COLORS.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          {icon ? <Icon name={icon} size={16} color={COLORS.white} /> : null}
          <Text style={{ color: COLORS.white, fontSize: 13.5, fontWeight: "800", letterSpacing: 0.2 }}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}