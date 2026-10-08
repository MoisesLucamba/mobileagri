import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ProcessingScreen from "../../components/ProcessingScreen";

// Este ficheiro vive em src/app/profile/[id].tsx — um nível mais fundo
// do que src/app/profile.tsx — por isso o caminho para lib tem mais "..".
import { supabase } from "../../lib/supabase";

/* ------------------------------------------------------------------ */
/* Tokens — mesma linguagem visual do "meu perfil"                     */
/* ------------------------------------------------------------------ */

const COLORS = {
  primary: "#1F6B3A",
  primaryDark: "#123C22",
  primarySoft: "#EAF3EA",
  primaryLight: "#D9EEDD",

  accent: "#E2932F",
  accentSoft: "#FBEBD3",

  text: "#16231C",
  muted: "#80897F",
  faint: "#B7BEB3",

  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EFEBE0",

  blue: "#4C7EDB",
  blueSoft: "#E8EFFB",

  violet: "#7C3AED",
  violetSoft: "#F0EAFE",

  danger: "#DD5138",
  dangerSoft: "#FCE9E5",

};

const RADIUS = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type UserType = "agricultor" | "comprador" | "agente" | "motorista" | null;

type PublicUser = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  user_type?: string | null;
  role?: string | null;
  province_id?: string | null;
  municipality_id?: string | null;
  province?: string | null;
  municipality?: string | null;
  created_at?: string | null;
  phone?: string | null;
  agent_code?: string | null;
  verified?: boolean | null;
  [key: string]: any;
};

type Product = {
  id: string;
  product_type?: string;
  name?: string;
  image_url?: string | null;
  quantity?: number;
  unit?: string;
  price?: number;
  status?: string;
  is_active?: boolean;
};

type Stats = {
  totalProducts: number;
  totalSales: number;
  totalReferrals: number;
};

const TYPE_INFO: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }
> = {
  agricultor: { label: "Agricultor", icon: "leaf-outline", color: COLORS.primary, soft: COLORS.primarySoft },
  comprador: { label: "Comprador", icon: "cart-outline", color: COLORS.blue, soft: COLORS.blueSoft },
  agente: { label: "Agente de campo", icon: "people-outline", color: COLORS.accent, soft: COLORS.accentSoft },
  motorista: { label: "Motorista", icon: "car-outline", color: COLORS.violet, soft: COLORS.violetSoft },
};

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function formatNumber(value: number = 0) {
  try {
    return Number(value || 0).toLocaleString("pt-AO");
  } catch {
    return String(value ?? 0);
  }
}

function getInitials(name = "?") {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
  return initials.toUpperCase() || "?";
}

function formatMemberSince(value?: string | null) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return date.toLocaleDateString("pt-AO", { month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

function getLocation(user: PublicUser | null) {
  if (!user) return "Angola";
  const parts = [user.municipality, user.province].filter(Boolean) as string[];
  if (parts.length) return parts.join(", ");
  const fallback = [user.municipality_id, user.province_id].filter(Boolean) as string[];
  return fallback.length ? fallback.join(", ") : "Angola";
}

function isMissingColumn(error: any) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

function isMissingTable(error: any) {
  return error?.code === "42P01" || /relation .* does not exist/i.test(error?.message || "");
}

/* ------------------------------------------------------------------ */
/* Componentes auxiliares                                              */
/* ------------------------------------------------------------------ */

function StatBlock({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statBlock}>
      <View style={[styles.statIcon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  accent = COLORS.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${accent}14` }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

function RoleBadge({ type }: { type: string | null }) {
  const info = type ? TYPE_INFO[type] : null;

  if (!info) {
    return (
      <View style={[styles.roleBadge, { backgroundColor: "#F1F2EF" }]}>
        <Ionicons name="person-outline" size={11} color={COLORS.muted} />
        <Text style={[styles.roleBadgeText, { color: COLORS.muted }]}>Utilizador</Text>
      </View>
    );
  }

  return (
    <View style={[styles.roleBadge, { backgroundColor: info.soft }]}>
      <Ionicons name={info.icon} size={11} color={info.color} />
      <Text style={[styles.roleBadgeText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const name = product.product_type || product.name || "Produto agrícola";
  const isActive =
    product.is_active === true || (product.status || "").toLowerCase() === "active";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.productRow, pressed && styles.pressedSoft]}
    >
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.productImage} />
      ) : (
        <View style={styles.productPlaceholder}>
          <MaterialCommunityIcons name="sprout" size={22} color={COLORS.primary} />
        </View>
      )}

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.productMeta}>
          {formatNumber(product.quantity || 0)} {product.unit || "kg"} · {formatNumber(product.price || 0)} Kz
        </Text>
        <View style={styles.productStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? COLORS.primary : COLORS.faint }]} />
          <Text style={[styles.productStatusText, !isActive && { color: COLORS.muted }]}>
            {isActive ? "Disponível" : "Indisponível"}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={COLORS.faint} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Ecrã                                                                */
/* ------------------------------------------------------------------ */

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalSales: 0, totalReferrals: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startingChat, setStartingChat] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  /* --- carregar sessão actual --------------------------------------- */

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUser(data?.user ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /* --- carregar o perfil visitado ------------------------------------ */

  const loadProfile = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoadError(null);
    setNotFound(false);

    try {
      // Tenta localizar o registo em users/profiles, por id ou por user_id —
      // igual à lógica usada no "meu perfil", para cobrir qualquer esquema.
      const attempts: Array<{ table: "users" | "profiles"; key: "id" | "user_id" }> = [
        { table: "users", key: "id" },
        { table: "users", key: "user_id" },
        { table: "profiles", key: "id" },
        { table: "profiles", key: "user_id" },
      ];

      let found: PublicUser | null = null;

      for (const attempt of attempts) {
        const { data, error } = await supabase
          .from(attempt.table)
          .select("*")
          .eq(attempt.key, id)
          .maybeSingle();

        if (error && !isMissingTable(error) && !isMissingColumn(error)) {
          console.warn(`[PublicProfile] ${attempt.table}.${attempt.key}:`, error.message);
        }

        if (data) {
          found = data as PublicUser;
          break;
        }
      }

      if (!found) {
        setNotFound(true);
        return;
      }

      setProfile(found);

      const userType = (found.user_type || found.role || "").toLowerCase();

      // Produtos, apenas se o utilizador não for exclusivamente comprador.
      if (userType !== "comprador") {
        const runProducts = async (filter: "is_active" | "status" | "none") => {
          let query = supabase.from("products").select("*").eq("user_id", id);
          if (filter === "is_active") query = query.eq("is_active", true);
          if (filter === "status") query = query.eq("status", "active");
          return query.order("created_at", { ascending: false }).limit(30);
        };

        let productList: Product[] = [];
        for (const filter of ["is_active", "status", "none"] as const) {
          const { data, error } = await runProducts(filter);
          if (!error) {
            productList = (data || []) as Product[];
            break;
          }
          if (!isMissingColumn(error)) {
            console.warn("[PublicProfile] produtos:", error.message);
            break;
          }
        }

        setProducts(productList);
        setStats((prev) => ({ ...prev, totalProducts: productList.length }));

        // Vendas: encomendas aceites para produtos deste utilizador.
        if (productList.length > 0) {
          const productIds = productList.map((product) => product.id);
          const { count, error } = await supabase
            .from("pre_orders")
            .select("*", { count: "exact", head: true })
            .eq("status", "accepted")
            .in("product_id", productIds);

          if (!error) setStats((prev) => ({ ...prev, totalSales: count || 0 }));
        }
      } else {
        setProducts([]);
      }

      // Indicações, apenas para agentes — função pode não existir em todos os projectos.
      if (userType === "agente") {
        try {
          const { data: referralData, error } = await supabase.rpc("get_agent_referral_stats", {
            agent_user_id: id,
          });
          if (!error && referralData && referralData.length > 0) {
            setStats((prev) => ({
              ...prev,
              totalReferrals: Number(referralData[0].total_referrals) || 0,
            }));
          }
        } catch (referralError) {
          console.warn("[PublicProfile] indicações:", referralError);
        }
      }
    } catch (error: any) {
      console.error("[PublicProfile] erro:", error?.message || error);
      setLoadError(error?.message || "Não foi possível carregar este perfil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Se o perfil visitado for o próprio utilizador, manda para "O meu perfil".
  useEffect(() => {
    if (currentUser && id && currentUser.id === id) {
      router.replace("/profile");
      return;
    }
    loadProfile();
  }, [currentUser, id, loadProfile, router]);

  useEffect(() => {
    if (!loading) animateIn();
  }, [loading, animateIn]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
  }, [loadProfile]);

  /* --- acções --------------------------------------------------------- */

  const startConversation = useCallback(async () => {
    if (!currentUser) {
      Alert.alert("Entrar na conta", "É preciso entrar para enviar uma mensagem.", [
        { text: "Agora não", style: "cancel" },
        { text: "Entrar", onPress: () => router.push("/login") },
      ]);
      return;
    }

    if (!profile || startingChat) return;

    try {
      setStartingChat(true);

      const { data: existing, error: existingError } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(user_id.eq.${currentUser.id},peer_user_id.eq.${profile.id}),and(user_id.eq.${profile.id},peer_user_id.eq.${currentUser.id})`
        )
        .limit(1);

      if (existingError) throw existingError;

      if (existing && existing.length > 0) {
        router.push(`/messages/${existing[0].id}` as any);
        return;
      }

      const { data: created, error: createError } = await supabase
        .from("conversations")
        .insert({
          user_id: currentUser.id,
          peer_user_id: profile.id,
          title: profile.full_name || profile.name || "Utilizador",
          avatar: profile.avatar_url,
          last_timestamp: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createError) throw createError;

      router.push(`/messages/${created.id}` as any);
    } catch (error: any) {
      console.error("[PublicProfile] conversa:", error?.message || error);
      Alert.alert("Mensagem", "Não foi possível abrir a conversa. Tente novamente.");
    } finally {
      setStartingChat(false);
    }
  }, [currentUser, profile, router, startingChat]);

  const callUser = useCallback(() => {
    if (!profile?.phone) return;
    Linking.openURL(`tel:${profile.phone}`).catch(() => {
      Alert.alert("Chamada", "Não foi possível iniciar a chamada.");
    });
  }, [profile?.phone]);

  /* --- dados derivados -------------------------------------------------- */

  const fullName = profile?.full_name || profile?.name || "Utilizador AgriLink";
  const userType = (profile?.user_type || profile?.role || "").toLowerCase() || null;
  const location = getLocation(profile);
  const memberSince = formatMemberSince(profile?.created_at);

  /* --- estados de ecrã ------------------------------------------------- */

  if (loading) {
    return <ProcessingScreen />;
  }

  if (notFound || (loadError && !profile)) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.centeredIcon}>
          <Ionicons name="person-remove-outline" size={30} color={notFound ? COLORS.muted : COLORS.danger} />
        </View>
        <Text style={styles.centeredTitle}>
          {notFound ? "Utilizador não encontrado" : "Os dados não chegaram"}
        </Text>
        <Text style={styles.centeredText}>
          {notFound
            ? "Esta conta pode ter sido removida ou o link está incorrecto."
            : loadError}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedSoft]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />

      <View style={styles.headerBar}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerBarTitle} numberOfLines={1}>
          {fullName}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Cartão de identidade */}
        <View style={styles.heroCard}>
          <View style={styles.heroBanner} />

          <View style={styles.heroBody}>
            <View style={styles.avatarWrapper}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
                </View>
              )}
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={2}>
                {fullName}
              </Text>
              {profile?.verified ? (
                <Ionicons name="checkmark-circle" size={17} color={COLORS.primary} />
              ) : null}
            </View>

            <RoleBadge type={userType} />

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.muted} />
              <Text style={styles.locationText}>{location}</Text>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                onPress={startConversation}
                disabled={startingChat}
                style={({ pressed }) => [
                  styles.messageButton,
                  (pressed || startingChat) && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
                <Text style={styles.messageButtonText}>
                  {startingChat ? "A abrir…" : "Enviar mensagem"}
                </Text>
              </Pressable>

              {profile?.phone ? (
                <Pressable
                  onPress={callUser}
                  style={({ pressed }) => [styles.callButton, pressed && styles.pressedSoft]}
                >
                  <Ionicons name="call-outline" size={17} color={COLORS.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Estatísticas */}
        <View style={styles.statsRow}>
          <StatBlock
            icon="cube-outline"
            value={formatNumber(stats.totalProducts)}
            label="Produtos"
            color={COLORS.primary}
          />
          <StatBlock
            icon="receipt-outline"
            value={formatNumber(stats.totalSales)}
            label="Vendas"
            color={COLORS.blue}
          />
          <StatBlock
            icon="time-outline"
            value={memberSince.split(" de ")[1] || memberSince}
            label="Desde"
            color={COLORS.accent}
          />
        </View>

        {/* Informações */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Informações</Text>

          <InfoRow icon="location-outline" label="Localização" value={location} />
          <InfoRow icon="calendar-outline" label="Membro desde" value={memberSince} />

          {userType === "agente" && profile?.agent_code ? (
            <InfoRow
              icon="ribbon-outline"
              label="Código de agente"
              value={profile.agent_code}
              accent={COLORS.violet}
            />
          ) : null}

          {userType === "agente" && stats.totalReferrals > 0 ? (
            <InfoRow
              icon="people-outline"
              label="Indicações"
              value={`${formatNumber(stats.totalReferrals)} utilizadores`}
              accent={COLORS.violet}
            />
          ) : null}
        </View>

        {/* Produtos */}
        {userType !== "comprador" ? (
          <View style={styles.productsSection}>
            <View style={styles.productsHeader}>
              <Text style={styles.productsTitle}>Produtos publicados</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{products.length}</Text>
              </View>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="sprout" size={24} color={COLORS.faint} />
                </View>
                <Text style={styles.emptyText}>Ainda sem produtos publicados.</Text>
              </View>
            ) : (
              <View style={{ gap: 9 }}>
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } } as Href)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        <Text style={styles.footerText}>AgriLink · perfil público</Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Estilos                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.canvas,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBarTitle: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "800", color: COLORS.text, marginHorizontal: 8 },

  centeredScreen: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 10,
  },
  centeredIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  centeredTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  centeredText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 10,
    maxWidth: 300,
  },

  pressedSoft: { opacity: 0.75 },

  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginTop: 14,
    marginBottom: 12,
  },
  heroBanner: {
    height: 74,
    backgroundColor: COLORS.primaryDark,
  },
  heroBody: { paddingHorizontal: 20, paddingBottom: 20, alignItems: "center" },
  avatarWrapper: { marginTop: -42 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.primarySoft,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "800", color: COLORS.primary },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  profileName: { fontSize: 18, fontWeight: "800", color: COLORS.text, textAlign: "center" },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },

  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 9 },
  locationText: { fontSize: 11.5, color: COLORS.muted },

  heroActions: { flexDirection: "row", gap: 9, marginTop: 18, width: "100%" },
  messageButton: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  messageButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  statsRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  statBlock: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 9.5, fontWeight: "700", color: COLORS.muted, textTransform: "capitalize" },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    paddingVertical: 6,
    marginBottom: 20,
  },
  infoCardTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text, marginTop: 12, marginBottom: 4 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 9.5, fontWeight: "700", color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginTop: 2 },

  productsSection: { marginBottom: 20 },
  productsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  productsTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  countBadge: {
    minWidth: 26,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "800", color: COLORS.primary },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  productImage: { width: 58, height: 58, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft },
  productPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: { flex: 1, marginHorizontal: 11 },
  productName: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  productMeta: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
  productStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  productStatusText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },

  emptyCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    paddingVertical: 30,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyText: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },

  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },

  footerText: { fontSize: 10, color: COLORS.faint, textAlign: "center", marginTop: 10 },
});