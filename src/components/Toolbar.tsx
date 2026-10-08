import React from "react";

import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useRouter } from "expo-router";

import { useUserRole } from "../context/RoleContext";
import RoleActionButton from "./ui/RoleActionButton";

const Logo = require("../assets/images/logo.jpeg");

interface ToolbarProps {
  title?: string;
  showBack?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  agricultor: "Agricultor",
  agente: "Agente",
  comprador: "Comprador",
  motorista: "Motorista",
};

export default function Toolbar({
  title = "AgriLink",
  showBack = false,
}: ToolbarProps) {
  const router = useRouter();

  const { role, loading } = useUserRole();

  const roleLabel = role
    ? ROLE_LABELS[role] ?? role
    : "Utilizador";

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#1F2937"
            />
          </TouchableOpacity>
        ) : (
          <Image
            source={Logo}
            style={styles.logo}
            resizeMode="contain"
          />
        )}

        {showBack && (
          <Text style={styles.title}>
            {title}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push((role === "motorista" ? "/entregas" : "/home") as Href)}
        >
          <Ionicons
            name="home-outline"
            size={22}
            color="#1F2937"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push("/conversations")}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={22}
            color="#1F2937"
          />
        </TouchableOpacity>

        <RoleActionButton compact />

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push("/mapa")}
        >
          <Ionicons
            name="map-outline"
            size={22}
            color="#1F2937"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileWrapper}
          onPress={() => router.push("/profile")}
        >
          <Ionicons
            name="person-circle-outline"
            size={29}
            color="#2E7D32"
          />

          {!loading && role && (
            <View style={styles.roleBadge}>
              <Text
                style={styles.roleBadgeText}
                numberOfLines={1}
              >
                {roleLabel}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 18,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  logo: {
    width: 130,
    height: 50,
  },

  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1F2937",
    marginLeft: 8,
  },

  iconButton: {
    width: 40,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  profileWrapper: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  roleBadge: {
    position: "absolute",
    bottom: -4,
    left: -8,
    right: -8,

    backgroundColor: "#2E7D32",
    borderRadius: 6,

    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  roleBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
  },
});