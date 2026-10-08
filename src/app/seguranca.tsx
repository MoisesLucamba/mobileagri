import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import Icon, { IconName } from "../components/Icon";
import ProcessingScreen from "../components/ProcessingScreen";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  primary: "#1F6B3A",
  secondary: "#79C267",
  dark: "#465044",
  text: "#3D403A",
  muted: "#77796F",
  faint: "#A3A398",
  border: "#E8E5DC",
  field: "#F5F3EC",
  background: "#FBFAF6",
  soft: "#EEF0E9",
  gold: "#B7833D",
  goldSoft: "#F5EEDF",
  danger: "#B95E54",
  dangerSoft: "#F6ECE9",
};

const SHADOW_SOFT = {
  shadowColor: COLORS.dark,
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 6,
};

const SUPPORT_URL = "mailto:suporte@agrilink.ao";

type PrivacyKey = "show_phone" | "show_email" | "show_location";

/* ------------------------------ animação de entrada ------------------------------ */

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 380,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/* ------------------------------ micro componentes ------------------------------ */

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 10, marginTop: 6 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  right,
  loading,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  loading?: boolean;
}) {
  const accent = danger ? COLORS.danger : COLORS.primary;
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress || loading}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? COLORS.dangerSoft : COLORS.soft }]}>
        <Icon name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: COLORS.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={16} color={COLORS.faint} /> : null)}
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#D9D6CB", true: COLORS.secondary }}
        thumbColor={value ? COLORS.primary : "#FFFFFF"}
        ios_backgroundColor="#D9D6CB"
      />
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, focused && styles.fieldBoxFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={COLORS.faint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.fieldInput}
        />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10}>
          <Icon name={visible ? "eye-off" : "eye"} size={18} color={COLORS.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function strength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Muito fraca", color: COLORS.danger },
    { label: "Fraca", color: COLORS.danger },
    { label: "Razoável", color: COLORS.gold },
    { label: "Boa", color: COLORS.secondary },
    { label: "Forte", color: COLORS.primary },
  ];
  return { score, ...map[score] };
}

/* ================================== PÁGINA ================================== */

export default function SegurancaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>({
    show_phone: false,
    show_email: false,
    show_location: true,
  });

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [requestingDelete, setRequestingDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);

      const { data, error } = await supabase
        .from("users")
        .select("show_phone, show_email, show_location")
        .eq("id", u.id)
        .maybeSingle();

      if (!error && data) {
        setPrivacy({
          show_phone: !!data.show_phone,
          show_email: !!data.show_email,
          show_location: data.show_location !== false,
        });
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------- privacidade ------------------------------- */

  const togglePrivacy = async (key: PrivacyKey, value: boolean) => {
    if (!user) return;
    const previous = privacy[key];
    setPrivacy((p) => ({ ...p, [key]: value }));

    const { error } = await supabase
      .from("users")
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.log(error);
      setPrivacy((p) => ({ ...p, [key]: previous }));
      Alert.alert("Não foi possível guardar", "Tenta novamente dentro de instantes.");
    }
  };

  /* ------------------------------- palavra-passe ------------------------------- */

  const togglePwForm = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPwOpen((v) => !v);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  const changePassword = async () => {
    if (!user?.email) return;

    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert("Campos em falta", "Preenche todos os campos.");
      return;
    }
    if (newPw.length < 8) {
      Alert.alert("Palavra-passe curta", "Usa pelo menos 8 caracteres.");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Não coincidem", "A confirmação é diferente da nova palavra-passe.");
      return;
    }
    if (newPw === currentPw) {
      Alert.alert("Mesma palavra-passe", "A nova palavra-passe tem de ser diferente da atual.");
      return;
    }

    setSavingPw(true);
    try {
      // confirma a palavra-passe atual
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (authError) {
        Alert.alert("Palavra-passe atual incorreta", "Verifica e tenta novamente.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      Alert.alert("Palavra-passe alterada", "A tua conta está mais segura.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível alterar a palavra-passe.");
    } finally {
      setSavingPw(false);
    }
  };

  /* ------------------------------- sessões ------------------------------- */

  const signOutEverywhere = () => {
    Alert.alert(
      "Terminar todas as sessões",
      "Vais sair da AgriLink em todos os dispositivos, incluindo este.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Terminar sessões",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            const { error } = await supabase.auth.signOut({ scope: "global" });
            setSigningOut(false);
            if (error) {
              Alert.alert("Erro", error.message);
              return;
            }
            router.replace("/login");
          },
        },
      ]
    );
  };

  /* ------------------------------- eliminar conta ------------------------------- */

  const requestAccountDeletion = () => {
    Alert.alert(
      "Eliminar conta",
      "Vamos receber o teu pedido e a equipa da AgriLink trata da eliminação dos teus dados. Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Pedir eliminação",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setRequestingDelete(true);
            try {
              const { error } = await supabase.rpc("create_admin_notifications", {
                p_type: "account_deletion",
                p_title: "Pedido de eliminação de conta",
                p_message: `O utilizador ${user.email || user.id} pediu a eliminação da conta.`,
                p_metadata: { user_id: user.id, email: user.email },
              });
              if (error) throw error;
              Alert.alert("Pedido enviado", "Vamos contactar-te por email para confirmar.");
            } catch (e: any) {
              Alert.alert("Erro", e?.message || "Não foi possível enviar o pedido.");
            } finally {
              setRequestingDelete(false);
            }
          },
        },
      ]
    );
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."));
  };

  /* ------------------------------- derivados ------------------------------- */

  const pwStrength = strength(newPw);
  const providers: string[] = user?.app_metadata?.providers || [];
  const isEmailAccount = providers.length === 0 || providers.includes("email");
  const emailConfirmed = !!user?.email_confirmed_at;
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("pt-AO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  if (loading) {
    return <ProcessingScreen />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 40 }}
        >
          {/* TOPO */}
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Segurança e privacidade
            </Text>
          </View>

          <View style={styles.body}>
            {/* CARTÃO DE ESTADO */}
            <FadeIn>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Icon name="shield" size={30} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>A tua conta está protegida</Text>
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {user?.email}
                  </Text>
                </View>
              </View>

              <View style={styles.statusGrid}>
                <View style={styles.statusTile}>
                  <Icon
                    name={emailConfirmed ? "check-circle" : "alert-circle"}
                    size={18}
                    color={emailConfirmed ? COLORS.primary : COLORS.gold}
                  />
                  <Text style={styles.statusLabel}>Email</Text>
                  <Text style={[styles.statusValue, { color: emailConfirmed ? COLORS.primary : COLORS.gold }]}>
                    {emailConfirmed ? "Confirmado" : "Por confirmar"}
                  </Text>
                </View>
                <View style={styles.statusTile}>
                  <Icon name="clock" size={18} color={COLORS.muted} />
                  <Text style={styles.statusLabel}>Último acesso</Text>
                  <Text style={styles.statusValue} numberOfLines={2}>
                    {lastSignIn}
                  </Text>
                </View>
              </View>
            </FadeIn>

            {/* ACESSO */}
            <FadeIn delay={80}>
              <SectionTitle title="Acesso à conta" sub="Mantém a tua conta longe de estranhos" />

              <View style={styles.card}>
                {isEmailAccount ? (
                  <>
                    <ActionRow
                      icon="key"
                      title="Alterar palavra-passe"
                      subtitle="Recomendamos mudar de tempos a tempos"
                      onPress={togglePwForm}
                      right={<Icon name={pwOpen ? "minus" : "plus"} size={16} color={COLORS.faint} />}
                    />

                    {pwOpen && (
                      <View style={styles.pwForm}>
                        <PasswordField
                          label="Palavra-passe atual"
                          value={currentPw}
                          onChangeText={setCurrentPw}
                        />
                        <PasswordField
                          label="Nova palavra-passe"
                          value={newPw}
                          onChangeText={setNewPw}
                          placeholder="Mínimo 8 caracteres"
                        />

                        {newPw.length > 0 && (
                          <View>
                            <View style={styles.meter}>
                              {[0, 1, 2, 3].map((i) => (
                                <View
                                  key={i}
                                  style={[
                                    styles.meterBar,
                                    { backgroundColor: i < pwStrength.score ? pwStrength.color : COLORS.border },
                                  ]}
                                />
                              ))}
                            </View>
                            <Text style={[styles.meterLabel, { color: pwStrength.color }]}>
                              {pwStrength.label}
                            </Text>
                          </View>
                        )}

                        <PasswordField
                          label="Confirmar nova palavra-passe"
                          value={confirmPw}
                          onChangeText={setConfirmPw}
                        />

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                          <TouchableOpacity
                            style={[styles.pillButton, { flex: 1 }, savingPw && { opacity: 0.65 }]}
                            onPress={changePassword}
                            disabled={savingPw}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.pillButtonText}>{savingPw ? "A guardar…" : "Guardar"}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.pillOutline, { flex: 1 }]}
                            onPress={togglePwForm}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.pillOutlineText}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View style={styles.divider} />
                  </>
                ) : (
                  <>
                    <ActionRow
                      icon="info"
                      title="Conta ligada a um serviço externo"
                      subtitle="A palavra-passe é gerida pelo teu fornecedor de login."
                    />
                    <View style={styles.divider} />
                  </>
                )}

                <ActionRow
                  icon="smartphone"
                  title="Terminar sessão em todos os dispositivos"
                  subtitle="Útil se perdeste o telemóvel ou usaste um aparelho alheio"
                  onPress={signOutEverywhere}
                  loading={signingOut}
                />
              </View>
            </FadeIn>

            {/* PRIVACIDADE */}
            <FadeIn delay={160}>
              <SectionTitle title="Privacidade" sub="Escolhe o que os outros utilizadores podem ver" />

              <View style={styles.card}>
                <ToggleRow
                  icon="phone"
                  title="Mostrar telefone"
                  subtitle="Compradores podem ver o teu número no perfil"
                  value={privacy.show_phone}
                  onChange={(v) => togglePrivacy("show_phone", v)}
                />
                <View style={styles.divider} />
                <ToggleRow
                  icon="mail"
                  title="Mostrar email"
                  subtitle="O teu email fica visível no perfil público"
                  value={privacy.show_email}
                  onChange={(v) => togglePrivacy("show_email", v)}
                />
                <View style={styles.divider} />
                <ToggleRow
                  icon="pin"
                  title="Mostrar localização nos produtos"
                  subtitle="Ativa o mapa nas tuas publicações"
                  value={privacy.show_location}
                  onChange={(v) => togglePrivacy("show_location", v)}
                />
              </View>
            </FadeIn>

            {/* OS TEUS DADOS */}
            <FadeIn delay={240}>
              <SectionTitle title="Os teus dados" sub="Como tratamos e protegemos a tua informação" />

              <View style={styles.card}>
                <ActionRow
                  icon="file"
                  title="Política de privacidade"
                  subtitle="Que dados recolhemos e porquê"
                  onPress={() => router.push("/privacidade")}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon="file"
                  title="Termos de utilização"
                  subtitle="Regras de uso da plataforma"
                  onPress={() => router.push("/termos")}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon="file"
                  title="Política de cookies"
                  subtitle="Como usamos cookies e tecnologias semelhantes"
                  onPress={() => router.push("/cookies")}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon="mail"
                  title="Falar com o suporte"
                  subtitle="Dúvidas sobre segurança ou dados pessoais"
                  onPress={() => openLink(SUPPORT_URL)}
                />
              </View>
            </FadeIn>

            {/* POLÍTICAS DA PLATAFORMA */}
            <FadeIn delay={300}>
              <SectionTitle title="Políticas da plataforma" sub="Regras para comprar, vender e entregar" />

              <View style={styles.card}>
                <ActionRow
                  icon="receipt"
                  title="Pedidos e cancelamentos"
                  subtitle="Como funcionam pedidos, cancelamentos e reembolsos"
                  onPress={() => router.push("/politica-pedidos")}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon="check-circle"
                  title="Qualidade e conformidade"
                  subtitle="O que esperamos dos produtos publicados"
                  onPress={() => router.push("/politica-qualidade")}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon="shield"
                  title="Utilização aceitável"
                  subtitle="Regras de conduta na plataforma"
                  onPress={() => router.push("/uso-aceitavel")}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon="truck"
                  title="Logística e entregas"
                  subtitle="Transporte, prazos e riscos de entrega"
                  onPress={() => router.push("/politica-logistica")}
                />
              </View>
            </FadeIn>

            {/* DICAS */}
            <FadeIn delay={380}>
              <View style={styles.tipsCard}>
                <View style={styles.tipsHeader}>
                  <Icon name="lock" size={16} color={COLORS.gold} />
                  <Text style={styles.tipsTitle}>Boas práticas</Text>
                </View>
                <Text style={styles.tipsText}>
                  • Nunca partilhes a tua palavra-passe, nem com a equipa da AgriLink.{"\n"}
                  • Usa uma palavra-passe única, com letras, números e símbolos.{"\n"}
                  • Combina pagamentos e entregas dentro da aplicação.{"\n"}
                  • Desconfia de pedidos urgentes de dinheiro fora da plataforma.
                </Text>
              </View>
            </FadeIn>

            {/* ZONA DE PERIGO */}
            <FadeIn delay={460}>
              <SectionTitle title="Zona de perigo" />
              <View style={[styles.card, styles.dangerCard]}>
                <ActionRow
                  icon="trash"
                  title="Eliminar a minha conta"
                  subtitle="Remove os teus dados da AgriLink de forma permanente"
                  onPress={requestAccountDeletion}
                  loading={requestingDelete}
                  danger
                />
              </View>
            </FadeIn>

            <View style={styles.footer}>
              <Text style={styles.footerText}>© {new Date().getFullYear()} AgriLink</Text>
              <Text style={styles.footerText}>
                Desenvolvida pela <Text style={styles.footerBrand}>THE TEAM</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ================================== STYLES ================================== */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { fontSize: 14, color: COLORS.muted },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  headerTitle: { flex: 1, fontSize: 21, fontWeight: "800", color: COLORS.text },

  body: { paddingHorizontal: 22, gap: 14 },

  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    ...SHADOW_SOFT,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  heroSub: { fontSize: 12.5, color: "rgba(255,255,255,0.8)", marginTop: 3 },

  statusGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  statusTile: {
    flex: 1,
    backgroundColor: COLORS.field,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  statusLabel: { fontSize: 11.5, color: COLORS.muted, fontWeight: "600", marginTop: 4 },
  statusValue: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },

  sectionTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  sectionSub: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },

  card: {
    backgroundColor: COLORS.field,
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  dangerCard: { backgroundColor: COLORS.dangerSoft },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 52 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14.5, fontWeight: "700", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2, lineHeight: 16 },

  pwForm: { gap: 14, paddingBottom: 16, paddingTop: 4 },
  fieldLabel: { fontSize: 13.5, fontWeight: "700", color: COLORS.text, marginBottom: 7 },
  fieldBox: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
  },
  fieldBoxFocused: { borderColor: COLORS.primary },
  fieldInput: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 0 },

  meter: { flexDirection: "row", gap: 6 },
  meterBar: { flex: 1, height: 5, borderRadius: 3 },
  meterLabel: { fontSize: 11.5, fontWeight: "700", marginTop: 6 },

  pillButton: {
    height: 52,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW_SOFT,
  },
  pillButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  pillOutline: {
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  pillOutlineText: { fontSize: 15, fontWeight: "700", color: COLORS.text },

  tipsCard: {
    backgroundColor: COLORS.goldSoft,
    borderRadius: 22,
    padding: 16,
    marginTop: 6,
  },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  tipsTitle: { fontSize: 14, fontWeight: "800", color: COLORS.gold },
  tipsText: { fontSize: 12.5, color: COLORS.text, lineHeight: 20 },

  footer: { alignItems: "center", marginTop: 26, gap: 3 },
  footerText: { fontSize: 11.5, color: "#8A968C" },
  footerBrand: { fontWeight: "800", color: COLORS.dark, letterSpacing: 0.5 },
});