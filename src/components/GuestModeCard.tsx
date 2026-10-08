import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserRole } from "../context/RoleContext";
import Icon from "./Icon";

const COLORS = {
  primary: "#2E8B4F",
  text: "#16231C",
  muted: "#78877D",
  border: "#E8ECE6",
  white: "#FFFFFF",
};

export default function GuestModeCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { leaveGuest } = useUserRole();

  const openAuth = async (route: "/login" | "/register") => {
    try {
      await leaveGuest();
      router.push(route);
    } catch (error) {
      console.error("Não foi possível sair do modo visitante:", error);
      Alert.alert("Erro", "Não foi possível abrir o acesso à conta. Tente novamente.");
    }
  };

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 10) + 10 }]}>
      <View style={styles.copy}>
        <Icon name="eye" size={17} color={COLORS.primary} />
        <View style={styles.texts}>
          <Text style={styles.title}>{t("guest.title")}</Text>
          <Text style={styles.description} numberOfLines={2}>{t("guest.description")}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.createButton}
          onPress={() => void openAuth("/register")}
        >
          <Text style={styles.createText}>{t("guest.createAccount")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.loginButton}
          onPress={() => void openAuth("/login")}
        >
          <Text style={styles.loginText}>{t("guest.signIn")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 200,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    shadowColor: "#16231C",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  copy: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  texts: { flex: 1 },
  title: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  description: { marginTop: 2, color: COLORS.muted, fontSize: 10.5, lineHeight: 14 },
  actions: { flexDirection: "row", gap: 8, marginTop: 9 },
  createButton: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  createText: { color: COLORS.white, fontSize: 11, fontWeight: "800" },
  loginButton: {
    minWidth: 78,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
  },
  loginText: { color: COLORS.text, fontSize: 11, fontWeight: "800" },
});
