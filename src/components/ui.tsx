import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import Icon, { IconName } from "./Icon";

/* ------------------------------- tema único ------------------------------- */

export const COLORS = {
  primary: "#2E8B4F",
  primaryLight: "#3DB068",
  primaryDark: "#237040",
  tint: "#E9F5EC",
  tintSoft: "#F1F8F3",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  line: "#E8ECE6",
  bg: "#F5F8F4",
  red: "#E0523A",
  redSoft: "#FDECE8",
  white: "#FFFFFF",
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
    shadowColor: "#2E8B4F",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
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
  const sweep = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!w) return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2800),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [w, sweep]);

  const to = (v: number) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-70, w + 70] });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(1)}
      style={style}
    >
      <Animated.View style={[SHADOW.glow, { transform: [{ scale: press }], borderRadius: 10 }]}>
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={{
            height,
            paddingHorizontal: 18,
            borderRadius: 10,
            overflow: "hidden",
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

          {/* faixa de luz que atravessa o botão */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -12,
              bottom: -12,
              width: 36,
              transform: [{ translateX }, { rotate: "20deg" }],
            }}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}