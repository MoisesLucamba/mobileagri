import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserRole } from "../context/RoleContext";
import { FALLBACK_ACTION, ROLE_ACTIONS } from "../constants/roleActions";
import Icon, { IconName } from "./Icon";

const COLORS = {
  muted: "#A3ADA5",
  primary: "#1F6B3A",
  white: "#FFFFFF",
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
        className={`h-[38px] w-[38px] items-center justify-center rounded-full ${active ? "bg-primary-soft" : ""}`}
      >
        <Icon
          name={icon}
          size={19}
          color={active ? COLORS.primary : COLORS.muted}
          strokeWidth={active ? 2.4 : 2}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function BottomToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { role, loading } = useUserRole();

  const action = role ? ROLE_ACTIONS[role] : FALLBACK_ACTION;
  const bottom = Math.max(insets.bottom, 8) + 12;
  const isActive = (path: string) => pathname === path;

  return (
    <View
      className="absolute left-5 right-5 z-[100] h-[58px] flex-row items-center justify-around rounded-[29px] border border-[#ECE9E0] bg-white"
      style={[s.shadow, { bottom }]}
    >
      <TabIcon active={isActive("/home")} icon="home" onPress={() => router.push("/home")} />

      <TabIcon active={isActive("/messages")} icon="message" onPress={() => router.push("/messages")} />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={loading}
        onPress={() => router.push(action.route as any)}
        className="flex-1 items-center justify-center"
      >
        <View
          className="h-[38px] w-[38px] items-center justify-center rounded-full"
          style={{ backgroundColor: loading ? COLORS.muted : action.color }}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Icon name={action.icon} size={19} color={COLORS.white} />
          )}
        </View>
      </TouchableOpacity>

      <TabIcon active={isActive("/mapa")} icon="map" onPress={() => router.push("/mapa")} />

      <TabIcon active={isActive("/profile")} icon="user" onPress={() => router.push("/profile")} />
    </View>
  );
}

const s = StyleSheet.create({
  shadow: {
    shadowColor: "#16231C",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});