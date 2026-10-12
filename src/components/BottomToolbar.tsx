import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserRole } from "../context/RoleContext";
import { FALLBACK_ACTION, ROLE_ACTIONS } from "../constants/roleActions";
import type { Href } from "expo-router";
import Icon, { IconName } from "./Icon";
import { COLORS } from "./ui";

const TOOLBAR_COLORS = {
  primary: COLORS.primary,
  tint: COLORS.tint,
  text: COLORS.text,
  muted: COLORS.muted,
  line: COLORS.line,
  white: COLORS.white,
};

type TabIconProps = {
  active: boolean;
  icon: IconName;
  onPress: () => void;
};

function TabIcon({ active, icon, onPress }: TabIconProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} className="flex-1 items-center justify-center">
      <View
        className="h-[38px] w-[38px] items-center justify-center rounded-[10px]"
        style={{ backgroundColor: active ? TOOLBAR_COLORS.tint : "transparent" }}
      >
        <Icon
          name={icon}
          size={19}
          color={active ? TOOLBAR_COLORS.primary : TOOLBAR_COLORS.text}
          strokeWidth={2.2}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function BottomToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { role, loading, isGuest } = useUserRole();

  const action = role ? ROLE_ACTIONS[role] : FALLBACK_ACTION;
  const homeRoute = role === "motorista" ? "/notifications" : "/home";
  const homeIcon = role === "motorista" ? "bell" : "home";
  const bottom = Math.max(insets.bottom, 8) + 12;
  const isActive = (path: string) => pathname === path;

  if (isGuest) return null;

  return (
    <View
      className="absolute left-[18px] right-[18px] z-[100] h-[58px] flex-row items-center justify-around rounded-[12px] bg-white"
      style={[s.bar, { bottom }]}
    >
      <TabIcon active={isActive(homeRoute)} icon={homeIcon} onPress={() => router.navigate(homeRoute as Href)} />

      <TabIcon active={isActive("/messages")} icon="message" onPress={() => router.navigate("/messages")} />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={loading}
        onPress={() => {
          if (!loading && pathname !== action.route) router.navigate(action.route as Href);
        }}
        className="flex-1 items-center justify-center"
      >
        <View
          className="h-[38px] w-[38px] items-center justify-center rounded-[10px]"
          style={{ backgroundColor: loading ? TOOLBAR_COLORS.muted : action.color }}
        >
          <Icon name={action.icon} size={19} color={TOOLBAR_COLORS.white} />
        </View>
      </TouchableOpacity>

      <TabIcon active={isActive("/mapa")} icon="map" onPress={() => router.navigate("/mapa")} />

      <TabIcon active={isActive("/profile")} icon="user" onPress={() => router.navigate("/profile")} />
    </View>
  );
}

// Cartão plano: borda fina e sombra quase nula, igual ao ProductCard
const s = StyleSheet.create({
  bar: {
    borderWidth: 1,
    borderColor: TOOLBAR_COLORS.line,
    shadowColor: "#16231C",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});