import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "../components/Icon";
import { supabase } from "../lib/supabase";

const COLORS = {
  primary: "#2E8B4F",
  dark: "#16231C",
  muted: "#78877D",
  border: "#E8ECE6",
  background: "#F6F8F5",
  white: "#FFFFFF",
  danger: "#B54747",
  dangerSoft: "#FCECEC",
  soft: "#E9F5EC",
};

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const sendRecoveryEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(t("login.invalidRecoveryEmail"));
      return;
    }

    setSending(true);
    setError("");
    try {
      const redirectTo = Linking.createURL("reset-password");
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      );
      if (requestError) throw requestError;
      setSent(true);
    } catch (requestError) {
      console.error("Não foi possível enviar o link de recuperação:", requestError);
      setError(t("login.recoveryError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/login")}
          accessibilityRole="button"
        >
          <Icon name="chevron-left" size={20} color={COLORS.dark} />
          <Text style={styles.backText}>{t("login.backToLogin")}</Text>
        </TouchableOpacity>

        <View style={styles.iconBadge}>
          <Icon name="lock" size={25} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>{t("login.forgotTitle")}</Text>
        <Text style={styles.subtitle}>{t("login.forgotDescription")}</Text>

        {sent ? (
          <View style={styles.successBox}>
            <Icon name="mail" size={20} color={COLORS.primary} />
            <View style={styles.messageCopy}>
              <Text style={styles.successTitle}>{t("login.recoverySentTitle")}</Text>
              <Text style={styles.message}>{t("login.recoverySent")}</Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputRow}>
              <Icon name="mail" size={18} color={COLORS.muted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="nome@exemplo.com"
                placeholderTextColor="#AEB8AC"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!sending}
                returnKeyType="send"
                onSubmitEditing={() => void sendRecoveryEmail()}
                style={styles.input}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={17} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitButton, sending && styles.disabled]}
              onPress={() => void sendRecoveryEmail()}
              disabled={sending}
              accessibilityRole="button"
            >
              <Text style={styles.submitText}>
                {sending ? "A enviar…" : t("login.sendRecovery")}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  backButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10 },
  backText: { color: COLORS.dark, fontSize: 14, fontWeight: "700" },
  iconBadge: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 70,
    borderRadius: 20,
    backgroundColor: COLORS.soft,
  },
  title: { marginTop: 24, color: COLORS.dark, fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 9, color: COLORS.muted, fontSize: 13.5, lineHeight: 20, textAlign: "center" },
  label: { marginTop: 30, marginBottom: 7, color: COLORS.dark, fontSize: 12.5, fontWeight: "700" },
  inputRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.white,
  },
  input: { flex: 1, minHeight: 48, color: COLORS.dark, fontSize: 14 },
  submitButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
  },
  submitText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: COLORS.dangerSoft },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 12.5, lineHeight: 18 },
  successBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 30, padding: 14, borderRadius: 12, backgroundColor: COLORS.soft },
  messageCopy: { flex: 1 },
  successTitle: { color: COLORS.dark, fontSize: 13, fontWeight: "800" },
  message: { marginTop: 4, color: COLORS.muted, fontSize: 12.5, lineHeight: 18 },
});
