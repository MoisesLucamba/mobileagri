import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserRole } from "../context/RoleContext";
import { FALLBACK_ACTION, ROLE_ACTIONS } from "../constants/roleActions";

const COLORS = {
  surface: "#FFFFFF",
  border: "#ECE9E0",
  muted: "#A3ADA5",
  primary: "#1F6B3A",
  primarySoft: "#EAF3EA",
};

type TabIconProps = {
  active: boolean;
  activeIcon: keyof typeof Ionicons.glyphMap;
  outlineIcon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function TabIcon({ active, activeIcon, outlineIcon, onPress }: TabIconProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.item}>
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <Ionicons
          name={active ? activeIcon : outlineIcon}
          size={19}
          color={active ? COLORS.primary : COLORS.muted}
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
    <View style={[styles.bar, { bottom }]}>
      <TabIcon
        active={isActive("/home")}
        activeIcon="home"
        outlineIcon="home-outline"
        onPress={() => router.push("/home")}
      />

      <TabIcon
        active={isActive("/messages")}
        activeIcon="chatbubble-ellipses"
        outlineIcon="chatbubble-ellipses-outline"
        onPress={() => router.push("/messages")}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={loading}
        onPress={() => router.push(action.route as any)}
        style={styles.item}
      >
        <View
          style={[
            styles.centerCircle,
            { backgroundColor: loading ? COLORS.muted : action.color },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name={action.icon} size={19} color="#FFFFFF" />
          )}
        </View>
      </TouchableOpacity>

      <TabIcon
        active={isActive("/mapa")}
        activeIcon="map"
        outlineIcon="map-outline"
        onPress={() => router.push("/mapa")}
      />

      <TabIcon
        active={isActive("/profile")}
        activeIcon="person"
        outlineIcon="person-outline"
        onPress={() => router.push("/profile")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    zIndex: 100,
    shadowColor: "#16231C",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: COLORS.primarySoft },
  centerCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});