import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { type Href, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Icon, { IconName } from "../components/Icon";
import { normalizeRole } from "../constants/roleActions";
import { useUserRole } from "../context/RoleContext";
import i18n, { AppLanguage, changeAppLanguage, LANGUAGE_STORAGE_KEY } from "../constants/i18n";
import ProcessingScreen from "../components/ProcessingScreen";
import { supabase } from "../lib/supabase";
import { isAgrilinkAdmin } from "../lib/agrilinkAds";

const AVATAR = 88;
const COVER_HEIGHT = 112;

// =====================================================
// BRANDING — cores inalteradas
// =====================================================

const COLORS = {
  primary: "#2E8B4F",
  white: "#FFFFFF",
  secondary: "#25703F",
  dark: "#16231C",
  deep: "#16231C",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  border: "#E8ECE6",
  field: "#F9FAF8",
  background: "#F4F6F2",
  soft: "#E9F5EC",
  gold: "#B7833D",
  goldSoft: "#F5EEDF",
  blue: "#637F9C",
  blueSoft: "#EDF1F5",
  danger: "#DD5138",
  dangerSoft: "#FBEDE9",
};

const ROLE_ACCENT: Record<string, string> = {
  agricultor: COLORS.primary,
  agente: "#E2932F",
  comprador: COLORS.blue,
  motorista: "#DB6B1F",
};

// =====================================================
// TIPOS
// =====================================================

type UserProduct = {
  id: string;
  product_type: string;
  quantity: number;
  harvest_date: string;
  price: number;
  status: "active" | "inactive" | "removed";
  created_at: string;
};

type FichaRecebimento = {
  id: string;
  nomeFicha: string;
  produto: string;
  qualidade: string;
  locaisEntrega?: string[];
  created_at: string;
};

type ReceivedOrder = {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  location: string;
  status: string;
  created_at: string;
  product?: { product_type: string; price: number };
  buyer?: { full_name: string; phone: string };
};

type SourcingRequest = {
  id: string;
  product_name: string;
  quantity: number;
  delivery_date: string;
  description: string | null;
  status: string;
  created_at: string;
};

type DriverLoad = {
  id: string;
  product_name: string;
  weight_kg: number;
  origin_label: string;
  destination_label: string;
  pickup_date: string | null;
  status: string;
};

// =====================================================
// MICRO COMPONENTES
// =====================================================

function Avatar({ uri, name, size, accent }: { uri?: string; name: string; size: number; accent?: string }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, overflow: "hidden",
        backgroundColor: accent || COLORS.primary, alignItems: "center", justifyContent: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: size * 0.4 }}>
          {(name || "?").charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function StatsRow({ items }: { items: { value: number | string; label: string; color: string }[] }) {
  return (
    <View style={styles.statsRow}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.statItem, i > 0 && styles.statDivider]}>
          <Text style={[styles.statValue, { color: it.color }]}>{it.value}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function MetaItem({ icon, value }: { icon: IconName; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={14} color={COLORS.muted} />
      <Text style={styles.metaText} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Highlight({ icon, label, onPress, bg, color }: {
  icon: IconName; label: string; onPress: () => void; bg: string; color: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.highlight} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.highlightCircle, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <Text style={styles.highlightLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabItem({ active, onPress, icon, label, badge }: {
  active: boolean; onPress: () => void; icon: IconName; label: string; badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.tabItem, active && styles.tabItemActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.tabIconBubble, active && styles.tabIconBubbleActive]}>
        <Icon name={icon} size={18} color={active ? "#FFFFFF" : COLORS.primary} />
        {!!badge && badge > 0 && (
          <View style={[styles.tabBadge, active && { borderColor: COLORS.primary }]}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: COLORS.soft, color: COLORS.primary, label: "Activo" },
    inactive: { bg: COLORS.goldSoft, color: COLORS.gold, label: "Inactivo" },
    removed: { bg: COLORS.dangerSoft, color: COLORS.danger, label: "Removido" },
    open: { bg: COLORS.soft, color: COLORS.primary, label: "Disponível" },
    pending: { bg: COLORS.goldSoft, color: COLORS.gold, label: "Pendente" },
    accepted: { bg: COLORS.soft, color: COLORS.primary, label: "Aceite" },
    in_transit: { bg: COLORS.blueSoft, color: COLORS.blue, label: "Em trânsito" },
    delivered: { bg: COLORS.soft, color: COLORS.primary, label: "Entregue" },
    rejected: { bg: COLORS.dangerSoft, color: COLORS.danger, label: "Rejeitado" },
    completed: { bg: COLORS.soft, color: COLORS.primary, label: "Concluído" },
  };
  const s = map[status] || { bg: COLORS.field, color: COLORS.muted, label: status };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function EmptyState({ icon, message, sub }: { icon: IconName; message: string; sub?: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyMessage}>{message}</Text>
      {sub && <Text style={styles.emptySub}>{sub}</Text>}
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType, required }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad"; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.fieldRequired}>  obrigatório</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.fieldInput, focused && styles.fieldInputFocused]}
        placeholderTextColor={COLORS.faint}
      />
    </View>
  );
}

// Cabeçalho de cada "publicação" no feed
function PostHeader({ uri, name, accent, subtitle, status }: {
  uri?: string; name: string; accent: string; subtitle: string; status?: string;
}) {
  return (
    <View style={styles.postHeader}>
      <Avatar uri={uri} name={name} size={36} accent={accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.postAuthor} numberOfLines={1}>{name}</Text>
        <Text style={styles.postTime}>{subtitle}</Text>
      </View>
      {status ? <StatusPill status={status} /> : null}
    </View>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

const TABS_BY_ROLE: Record<string, { id: string; label: string; icon: IconName }[]> = {
  comprador: [
    { id: "products", label: "Fichas", icon: "clipboard" },
    { id: "sourcing", label: "Sourcing", icon: "search" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart" },
  ],
  agricultor: [
    { id: "products", label: "Produtos", icon: "package" },
    { id: "orders", label: "Encomendas", icon: "cart" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart" },
  ],
  agente: [
    { id: "products", label: "Produtos", icon: "package" },
    { id: "orders", label: "Encomendas", icon: "cart" },
    { id: "referrals", label: "Indicações", icon: "users" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart" },
  ],
  motorista: [
    { id: "deliveries", label: "Entregas", icon: "truck" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart" },
  ],
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role: contextRole } = useUserRole();

  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState("products");

  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [fichasRecebimento, setFichasRecebimento] = useState<FichaRecebimento[]>([]);
  const [receivedOrders, setReceivedOrders] = useState<ReceivedOrder[]>([]);
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([]);
  const [productStats, setProductStats] = useState<Record<string, { likes: number; comments: number }>>({});
  const [agentStats, setAgentStats] = useState({ totalReferrals: 0, totalPoints: 0, recentReferrals: [] as any[] });
  const [buyerStats, setBuyerStats] = useState({ completedOrders: 0, favoriteProducts: 0 });
  const [driverLoads, setDriverLoads] = useState<DriverLoad[]>([]);
  const [driverCapacity, setDriverCapacity] = useState<number | null>(null);

  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [sourcingForm, setSourcingForm] = useState({ product_name: "", quantity: "", delivery_date: "", description: "" });
  const [submittingSourcing, setSubmittingSourcing] = useState(false);

  const [profileData, setProfileData] = useState({ full_name: "", phone: "", email: "" });

  const userRole = normalizeRole(userProfile?.user_type) ?? contextRole;
  const isComprador = userRole === "comprador";
  const isAgente = userRole === "agente";
  const isAgricultor = userRole === "agricultor";
  const isMotorista = userRole === "motorista";
  const roleAccent = ROLE_ACCENT[userRole ?? ""] || COLORS.primary;
  const memberCode = userProfile?.agent_code || (authUser?.id ? authUser.id.slice(0, 8).toUpperCase() : "—");

  useEffect(() => {
    let mounted = true;
    isAgrilinkAdmin()
      .then((allowed) => {
        if (mounted) setIsAdmin(allowed);
      })
      .catch((error) => {
        console.error("Não foi possível verificar o acesso administrativo:", error);
        if (mounted) setIsAdmin(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const tabs = TABS_BY_ROLE[userRole ?? ""] || TABS_BY_ROLE.agricultor;
  const visibleTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;

  // ===================================================
  // FETCHES (lógica inalterada)
  // ===================================================

  const fetchUserProducts = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) { console.log(error); return; }

    const list = (data || []) as UserProduct[];
    setUserProducts(list);

    if (list.length > 0) {
      const ids = list.map((p) => p.id);
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("product_likes").select("product_id").in("product_id", ids),
        supabase.from("product_comments").select("product_id").in("product_id", ids),
      ]);

      const statsMap: Record<string, { likes: number; comments: number }> = {};
      ids.forEach((id) => { statsMap[id] = { likes: 0, comments: 0 }; });
      (likes || []).forEach((l: any) => { statsMap[l.product_id].likes += 1; });
      (comments || []).forEach((c: any) => { statsMap[c.product_id].comments += 1; });
      setProductStats(statsMap);
    }
  }, []);

  const fetchFichasRecebimento = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("fichas_recebimento" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) { console.log(error); return; }
    setFichasRecebimento((data || []) as any);
  }, []);

  const fetchAgentStats = useCallback(async (userId: string) => {
    const { data, error } = await supabase.rpc("get_agent_referral_stats", { agent_user_id: userId });
    if (error) { console.log(error); return; }
    if (data && data.length > 0) {
      const s = data[0];
      setAgentStats({
        totalReferrals: Number(s.total_referrals) || 0,
        totalPoints: Number(s.total_points) || 0,
        recentReferrals: Array.isArray(s.recent_referrals) ? s.recent_referrals : [],
      });
    }
  }, []);

  const fetchReceivedOrders = useCallback(async (userId: string) => {
    const { data: ownProducts, error: prodError } = await supabase.from("products").select("id").eq("user_id", userId);
    if (prodError) { console.log(prodError); return; }
    if (!ownProducts || ownProducts.length === 0) { setReceivedOrders([]); return; }

    const productIds = ownProducts.map((p) => p.id);
    const { data: orders, error: ordersError } = await supabase
      .from("pre_orders")
      .select("id, product_id, buyer_id, quantity, delivery_location, status, created_at")
      .in("product_id", productIds)
      .order("created_at", { ascending: false });

    if (ordersError) { console.log(ordersError); return; }
    if (!orders || orders.length === 0) { setReceivedOrders([]); return; }

    const uniqueProductIds = [...new Set(orders.map((o) => o.product_id))];
    const buyerIds = [...new Set(orders.map((o) => o.buyer_id))];

    const [{ data: productsData }, { data: buyersData }] = await Promise.all([
      supabase.from("products").select("id, product_type, price").in("id", uniqueProductIds),
      supabase.from("users").select("id, full_name, phone").in("id", buyerIds),
    ]);

    const productMap = new Map((productsData || []).map((p: any) => [p.id, p]));
    const buyerMap = new Map((buyersData || []).map((b: any) => [b.id, b]));

    setReceivedOrders(
      orders.map((o: any) => ({
        ...o,
        location: o.delivery_location,
        product: productMap.get(o.product_id),
        buyer: buyerMap.get(o.buyer_id),
      }))
    );
  }, []);

  const fetchSourcingRequests = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("sourcing_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) { console.log(error); return; }
    setSourcingRequests(data || []);
  }, []);

  const fetchBuyerStats = useCallback(async (userId: string) => {
    const [{ count: completedCount }, { count: likesCount }] = await Promise.all([
      supabase.from("pre_orders").select("*", { count: "exact", head: true }).eq("buyer_id", userId).in("status", ["completed", "accepted"]),
      supabase.from("product_likes").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    setBuyerStats({ completedOrders: completedCount || 0, favoriteProducts: likesCount || 0 });
  }, []);

  const fetchDriverLoads = useCallback(async (userId: string, metadataCapacity?: unknown) => {
    const [{ data, error }, { data: driverProfile, error: profileError }] = await Promise.all([
      supabase
        .from("freight_loads")
        .select("id, product_name, weight_kg, origin_label, destination_label, pickup_date, status")
        .eq("driver_id", userId)
        .order("pickup_date", { ascending: false, nullsFirst: false }),
      supabase.from("profiles").select("load_capacity_kg").eq("id", userId).maybeSingle(),
    ]);

    if (error) {
      console.error("Não foi possível carregar as entregas do motorista:", error);
      return;
    }
    if (profileError) console.warn("Não foi possível carregar a capacidade do motorista:", profileError);
    setDriverLoads((data || []) as DriverLoad[]);
    const capacity = Number(driverProfile?.load_capacity_kg ?? metadataCapacity);
    setDriverCapacity(Number.isFinite(capacity) && capacity > 0 ? capacity : null);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthUser(null);
        setLoading(false);
        return;
      }
      setAuthUser(user);

      const { data: profileRow, error: profileError } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
      if (profileError) console.warn("Não foi possível carregar os dados do perfil:", profileError);
      const metadata = user.user_metadata ?? {};
      const resolvedRole = normalizeRole(profileRow?.user_type ?? metadata.user_type) ?? contextRole;
      setUserProfile({
        ...metadata,
        ...profileRow,
        user_type: resolvedRole ?? profileRow?.user_type ?? metadata.user_type,
        full_name: profileRow?.full_name || metadata.full_name || "",
        phone: profileRow?.phone || metadata.phone || user.phone || "",
        email: profileRow?.email || user.email || metadata.contact_email || "",
        province_id: profileRow?.province_id || metadata.province_id || "",
        load_capacity_kg: profileRow?.load_capacity_kg ?? metadata.load_capacity_kg,
      });
      setProfileData({
        full_name: profileRow?.full_name || metadata.full_name || "",
        phone: profileRow?.phone || metadata.phone || user.phone || "",
        email: profileRow?.email || user.email || metadata.contact_email || "",
      });

      if (resolvedRole === "comprador") {
        await Promise.all([fetchFichasRecebimento(user.id), fetchSourcingRequests(user.id), fetchBuyerStats(user.id)]);
      } else if (resolvedRole === "motorista") {
        await fetchDriverLoads(user.id, user.user_metadata?.load_capacity_kg);
      } else {
        await Promise.all([fetchUserProducts(user.id), fetchReceivedOrders(user.id)]);
      }
      if (resolvedRole === "agente") await fetchAgentStats(user.id);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contextRole, fetchUserProducts, fetchFichasRecebimento, fetchReceivedOrders, fetchSourcingRequests, fetchBuyerStats, fetchAgentStats, fetchDriverLoads]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const changeLanguage = async (language: AppLanguage) => {
    try {
      await changeAppLanguage(language);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.warn("[i18n] Não foi possível guardar o idioma:", error);
      Alert.alert(t("settings.languageSaveError"));
    }
  };

  // ===================================================
  // AÇÕES (lógica inalterada)
  // ===================================================

  const updateProfile = async () => {
    if (!authUser) return;
    const { error } = await supabase
      .from("users")
      .update({ ...profileData, updated_at: new Date().toISOString() })
      .eq("id", authUser.id);

    if (error) {
      Alert.alert("Erro", error.message);
      return;
    }
    setUserProfile((c: any) => ({ ...c, ...profileData }));
    setEditMode(false);
  };

  const changeAvatar = async () => {
    if (!authUser) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Permite o acesso às fotografias.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;

    try {
      setAvatarLoading(true);
      const asset = result.assets[0];
      const extension = asset.uri.split(".").pop() || "jpg";
      const filePath = `${authUser.id}/avatar.${extension}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, { contentType: asset.mimeType || "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase.from("users").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", authUser.id);
      setUserProfile((c: any) => ({ ...c, avatar_url: avatarUrl }));
    } catch (e: any) {
      Alert.alert("Erro no upload", e?.message || "Tenta novamente.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const deleteProduct = (productId: string) => {
    Alert.alert("Remover produto", "Deseja remover este produto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("products").update({ status: "removed" }).eq("id", productId);
          if (error) { console.log(error); return; }
          setUserProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, status: "removed" } : p)));
        },
      },
    ]);
  };

  const acceptOrder = async (orderId: string) => {
    const { error } = await supabase.from("pre_orders").update({ status: "accepted" }).eq("id", orderId);
    if (error) { Alert.alert("Erro", "Não foi possível aceitar o pedido."); return; }
    setReceivedOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "accepted" } : o)));
  };

  const rejectOrder = (orderId: string) => {
    Alert.alert("Rejeitar pedido", "Deseja rejeitar este pedido?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rejeitar", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("pre_orders").update({ status: "rejected" }).eq("id", orderId);
          if (error) { console.log(error); return; }
          setReceivedOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "rejected" } : o)));
        },
      },
    ]);
  };

  const contactBuyer = async (order: ReceivedOrder) => {
    if (!authUser || !order.buyer_id) return;
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(user_id.eq.${authUser.id},peer_user_id.eq.${order.buyer_id}),and(user_id.eq.${order.buyer_id},peer_user_id.eq.${authUser.id})`)
        .limit(1);

      if (existing && existing.length > 0) {
        router.push({ pathname: "/messages", params: { id: existing[0].id } });
        return;
      }

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ user_id: authUser.id, peer_user_id: order.buyer_id, title: order.buyer?.full_name || "Comprador", last_timestamp: new Date().toISOString() })
        .select("id")
        .single();

      if (error) throw error;
      router.push({ pathname: "/messages", params: { id: newConv.id } });
    } catch (e) {
      console.log(e);
    }
  };

  const submitSourcingRequest = async () => {
    if (!authUser || !sourcingForm.product_name || !sourcingForm.quantity || !sourcingForm.delivery_date) {
      Alert.alert("Erro", "Preencha todos os campos obrigatórios.");
      return;
    }
    setSubmittingSourcing(true);
    try {
      const { error } = await supabase.from("sourcing_requests").insert({
        user_id: authUser.id,
        product_name: sourcingForm.product_name,
        quantity: parseFloat(sourcingForm.quantity),
        delivery_date: sourcingForm.delivery_date,
        description: sourcingForm.description || null,
      });
      if (error) throw error;

      await supabase.rpc("create_admin_notifications", {
        p_type: "sourcing",
        p_title: "Novo Pedido de Sourcing",
        p_message: `Comprador solicitou: ${sourcingForm.quantity}kg de ${sourcingForm.product_name}`,
        p_metadata: { user_id: authUser.id, product_name: sourcingForm.product_name },
      });

      setSourcingForm({ product_name: "", quantity: "", delivery_date: "", description: "" });
      setShowSourcingForm(false);
      fetchSourcingRequests(authUser.id);
      Alert.alert("Pedido enviado", "O teu pedido de sourcing foi enviado.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Erro ao enviar pedido.");
    } finally {
      setSubmittingSourcing(false);
    }
  };

  const shareAgentCode = async () => {
    const code = userProfile?.agent_code;
    if (!code) return;
    try {
      await Share.share({ message: `Código de Agente AgriLink: ${code}\n\nCadastra-te em agrilink.ao/cadastro` });
    } catch (e) {
      console.log(e);
    }
  };

  const copyMemberCode = async () => {
    await Clipboard.setStringAsync(memberCode);
    Alert.alert("Copiado", "Código copiado para a área de transferência.");
  };

  const signOut = async () => {
    setSettingsOpen(false);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-AO");

  const activeProducts = userProducts.filter((p) => p.status === "active").length;
  const totalComments = userProducts.reduce((s, p) => s + (productStats[p.id]?.comments || 0), 0);
  const totalLikes = userProducts.reduce((s, p) => s + (productStats[p.id]?.likes || 0), 0);

  const statItems = useMemo(() => {
    if (isAgente) {
      return [
        { value: agentStats.totalReferrals, label: "Indicados", color: COLORS.primary },
        { value: agentStats.totalPoints, label: "Pontos", color: COLORS.gold },
      ];
    }
    if (isComprador) {
      return [
        { value: fichasRecebimento.length, label: "Fichas", color: COLORS.primary },
        { value: buyerStats.completedOrders, label: "Compras", color: COLORS.primary },
        { value: buyerStats.favoriteProducts, label: "Favoritos", color: COLORS.gold },
      ];
    }
    if (isMotorista) {
      return [
        { value: driverLoads.filter((load) => load.status === "in_transit").length, label: "Em trânsito", color: COLORS.blue },
        { value: driverLoads.filter((load) => load.status === "delivered").length, label: "Entregues", color: COLORS.primary },
        { value: driverCapacity ? `${driverCapacity.toLocaleString("pt-AO")} kg` : "—", label: "Capacidade", color: COLORS.gold },
      ];
    }
    return [
      { value: activeProducts, label: "Produtos", color: COLORS.primary },
      { value: totalComments, label: "Comentários", color: COLORS.primary },
      { value: totalLikes, label: "Gostos", color: COLORS.gold },
    ];
  }, [isAgente, isComprador, isMotorista, agentStats, fichasRecebimento, buyerStats, activeProducts, totalComments, totalLikes, driverLoads, driverCapacity]);

  // ===================================================
  // ESTADOS DE CARREGAMENTO / SEM SESSÃO
  // ===================================================

  if (loading) {
    return <ProcessingScreen />;
  }

  if (!authUser) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Icon name="user" size={68} color={COLORS.primary} />
        <Text style={styles.emptyMessage}>Sessão não encontrada</Text>
        <TouchableOpacity style={[styles.primaryBtn, { paddingHorizontal: 32 }]} onPress={() => router.replace("/login")}>
          <Text style={styles.primaryBtnText}>Iniciar sessão</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const profileName = userProfile?.full_name || authUser?.user_metadata?.full_name || "Utilizador AgriLink";
  const avatarUri: string | undefined = userProfile?.avatar_url || undefined;
  const pendingOrders = receivedOrders.filter((o) => o.status === "pending").length;
  const hasHighlights = !isMotorista || isAdmin;

  const statisticsRows = isAgente
    ? [
        { label: "Total de indicações", val: agentStats.totalReferrals, color: COLORS.primary },
        { label: "Pontos acumulados", val: agentStats.totalPoints, color: COLORS.gold },
      ]
    : isComprador
    ? [
        { label: "Fichas criadas", val: fichasRecebimento.length, color: COLORS.primary },
        { label: "Compras concluídas", val: buyerStats.completedOrders, color: COLORS.primary },
        { label: "Favoritos", val: buyerStats.favoriteProducts, color: COLORS.gold },
      ]
    : [
        { label: "Total de produtos", val: userProducts.length, color: COLORS.text },
        { label: "Produtos activos", val: activeProducts, color: COLORS.primary },
        { label: "Total de comentários", val: totalComments, color: COLORS.primary },
        { label: "Total de gostos", val: totalLikes, color: COLORS.gold },
      ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* BARRA SUPERIOR */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t("login.back")}
        >
          <Icon name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{t("profile.title")}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setSettingsOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t("settings.title")}
        >
          <Icon name="settings" size={21} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* [0] CAPA + PERFIL */}
        <View>
          <View style={styles.cover}>
            <View style={[styles.coverBlob, styles.coverBlobA]} />
            <View style={[styles.coverBlob, styles.coverBlobB]} />
          </View>

          <View style={styles.profileBody}>
            <View style={styles.avatarRow}>
              <TouchableOpacity
                onPress={changeAvatar}
                disabled={avatarLoading}
                activeOpacity={0.9}
                style={styles.avatarWrap}
                accessibilityRole="button"
                accessibilityLabel="Alterar fotografia"
              >
                <Avatar uri={avatarUri} name={profileName} size={AVATAR} accent={COLORS.soft} />
                <View style={styles.avatarEdit}>
                  <Icon name="camera" size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditMode(true)} activeOpacity={0.85}>
                  <Icon name="edit" size={15} color={COLORS.text} />
                  <Text style={styles.outlineBtnText}>Editar perfil</Text>
                </TouchableOpacity>
                {isAgente && !!userProfile?.agent_code && (
                  <TouchableOpacity
                    style={styles.squareBtn}
                    onPress={shareAgentCode}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Partilhar código de agente"
                  >
                    <Icon name="share" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.memberName} numberOfLines={1}>{profileName}</Text>
              {userProfile?.verified && <Icon name="check-circle" size={18} color={COLORS.primary} />}
            </View>

            <View style={styles.handleRow}>
              <TouchableOpacity onPress={copyMemberCode} activeOpacity={0.7} style={styles.handleBtn}>
                <Text style={styles.handleText}>#{memberCode}</Text>
                <Icon name="copy" size={12} color={COLORS.faint} />
              </TouchableOpacity>
              <View style={[styles.rolePill, { backgroundColor: `${roleAccent}1A` }]}>
                <View style={[styles.roleDot, { backgroundColor: roleAccent }]} />
                <Text style={[styles.roleText, { color: roleAccent }]}>{userProfile?.user_type || "—"}</Text>
              </View>
            </View>

            <View style={styles.metaWrap}>
              <MetaItem icon="pin" value={userProfile?.province_id || "Angola"} />
              <MetaItem icon="phone" value={profileData.phone} />
              <MetaItem icon="mail" value={profileData.email} />
            </View>

            <StatsRow items={statItems} />
          </View>

          {/* ATALHOS (estilo destaques) */}
          {hasHighlights && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.highlightsContent}
              style={styles.highlightsScroll}
            >
              {!isMotorista && (
                <Highlight
                  icon="receipt"
                  label="Histórico"
                  bg={COLORS.soft}
                  color={COLORS.primary}
                  onPress={() => router.push("/historicopagamentos")}
                />
              )}
              {isAdmin && (
                <>
                  <Highlight
                    icon="bar-chart"
                    label="Dashboard"
                    bg={COLORS.blueSoft}
                    color={COLORS.blue}
                    onPress={() => router.push("/dashboard" as Href)}
                  />
                  <Highlight
                    icon="image"
                    label="Publicidade"
                    bg={COLORS.goldSoft}
                    color={COLORS.gold}
                    onPress={() => router.push("/agrilink-ads" as Href)}
                  />
                </>
              )}
            </ScrollView>
          )}
        </View>

        {/* [1] TABS FIXAS */}
        <View style={styles.tabsBar}>
          <View style={styles.tabsTrack}>
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                active={visibleTab === tab.id}
                onPress={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
                badge={tab.id === "orders" ? pendingOrders : undefined}
              />
            ))}
          </View>
        </View>

        {/* [2] FEED */}
        <View style={styles.feed}>
          {/* ENTREGAS */}
          {visibleTab === "deliveries" && isMotorista && (
            driverLoads.length === 0 ? (
              <EmptyState icon="truck" message="Ainda não tens entregas atribuídas" sub="As cargas que aceitares aparecerão aqui." />
            ) : (
              driverLoads.map((load) => (
                <View key={load.id} style={styles.post}>
                  <PostHeader
                    uri={avatarUri}
                    name={profileName}
                    accent={roleAccent}
                    subtitle={load.pickup_date ? `Recolha ${formatDate(load.pickup_date)}` : "Sem data de recolha"}
                    status={load.status}
                  />
                  <Text style={styles.postTitle}>{load.product_name}</Text>
                  <View style={styles.routeRow}>
                    <Icon name="pin" size={13} color={COLORS.muted} />
                    <Text style={styles.postSub} numberOfLines={1}>{load.origin_label} → {load.destination_label}</Text>
                  </View>
                  <Text style={styles.postPrice}>{Number(load.weight_kg || 0).toLocaleString("pt-AO")} kg</Text>
                </View>
              ))
            )
          )}

          {/* PRODUTOS / FICHAS */}
          {visibleTab === "products" && (
            isComprador ? (
              fichasRecebimento.length === 0 ? (
                <EmptyState icon="clipboard" message="Ainda não criaste fichas de recebimento" />
              ) : (
                fichasRecebimento.map((f) => (
                  <View key={f.id} style={styles.post}>
                    <PostHeader uri={avatarUri} name={profileName} accent={roleAccent} subtitle={formatDate(f.created_at)} />
                    <Text style={styles.postTitle}>{f.nomeFicha}</Text>
                    <Text style={styles.postSub}>{f.produto} · {f.qualidade}</Text>
                    <View style={styles.tagRow}>
                      <View style={styles.tag}>
                        <Icon name="pin" size={12} color={COLORS.primary} />
                        <Text style={styles.tagText}>{f.locaisEntrega?.length || 0} locais de entrega</Text>
                      </View>
                    </View>
                  </View>
                ))
              )
            ) : (
              userProducts.length === 0 ? (
                <EmptyState icon="package" message="Ainda não publicaste produtos" sub="Os teus produtos aparecem aqui como publicações." />
              ) : (
                userProducts.map((p) => (
                  <View key={p.id} style={styles.post}>
                    <PostHeader uri={avatarUri} name={profileName} accent={roleAccent} subtitle={formatDate(p.created_at)} status={p.status} />
                    <Text style={styles.postTitle}>{p.product_type}</Text>
                    <Text style={styles.postSub}>{p.quantity.toLocaleString()} kg · colheita {formatDate(p.harvest_date)}</Text>
                    <Text style={styles.postPrice}>{p.price.toLocaleString()} Kz/kg</Text>

                    <View style={styles.postFooter}>
                      <View style={styles.reaction}>
                        <Icon name="heart" size={17} color={COLORS.muted} />
                        <Text style={styles.reactionText}>{productStats[p.id]?.likes || 0}</Text>
                      </View>
                      <View style={styles.reaction}>
                        <Icon name="message" size={16} color={COLORS.muted} />
                        <Text style={styles.reactionText}>{productStats[p.id]?.comments || 0}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      {p.status !== "removed" && (
                        <TouchableOpacity onPress={() => deleteProduct(p.id)} hitSlop={8}>
                          <Text style={styles.removeLinkText}>Remover</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )
            )
          )}

          {/* SOURCING */}
          {visibleTab === "sourcing" && isComprador && (
            <View>
              <View style={styles.sectionHead}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.blockTitle}>Pedidos de sourcing</Text>
                  <Text style={styles.blockSubtitle}>Pede-nos para encontrar um produto específico</Text>
                </View>
                <TouchableOpacity style={styles.smallPill} onPress={() => setShowSourcingForm((v) => !v)} activeOpacity={0.85}>
                  <Text style={styles.smallPillText}>{showSourcingForm ? "Cancelar" : "Novo pedido"}</Text>
                </TouchableOpacity>
              </View>

              {showSourcingForm && (
                <View style={styles.formBlock}>
                  <Field label="Nome do produto" value={sourcingForm.product_name} onChangeText={(v) => setSourcingForm((p) => ({ ...p, product_name: v }))} required />
                  <Field label="Quantidade (kg)" value={sourcingForm.quantity} onChangeText={(v) => setSourcingForm((p) => ({ ...p, quantity: v }))} required />
                  <Field label="Data de entrega (AAAA-MM-DD)" value={sourcingForm.delivery_date} onChangeText={(v) => setSourcingForm((p) => ({ ...p, delivery_date: v }))} required />
                  <Field label="Descrição" value={sourcingForm.description} onChangeText={(v) => setSourcingForm((p) => ({ ...p, description: v }))} />
                  <TouchableOpacity
                    style={[styles.primaryBtn, submittingSourcing && { opacity: 0.65 }]}
                    onPress={submitSourcingRequest}
                    disabled={submittingSourcing}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>{submittingSourcing ? "A enviar…" : "Enviar pedido"}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {sourcingRequests.length === 0 ? (
                <EmptyState icon="search" message="Ainda não fizeste pedidos de sourcing" />
              ) : (
                sourcingRequests.map((r) => (
                  <View key={r.id} style={styles.post}>
                    <PostHeader uri={avatarUri} name={profileName} accent={roleAccent} subtitle={formatDate(r.created_at)} status={r.status} />
                    <Text style={styles.postTitle}>{r.product_name}</Text>
                    <Text style={styles.postSub}>{r.quantity} kg · entrega {new Date(r.delivery_date).toLocaleDateString("pt-AO")}</Text>
                    {!!r.description && <Text style={styles.postBody}>{r.description}</Text>}
                  </View>
                ))
              )}
            </View>
          )}

          {/* ENCOMENDAS RECEBIDAS */}
          {visibleTab === "orders" && (isAgricultor || isAgente) && (
            receivedOrders.length === 0 ? (
              <EmptyState icon="cart" message="Ainda não recebeste encomendas" sub="Vão aparecer aqui assim que alguém pré-encomendar um dos teus produtos." />
            ) : (
              receivedOrders.map((o) => (
                <View key={o.id} style={styles.post}>
                  <PostHeader
                    name={o.buyer?.full_name || "Comprador"}
                    accent={COLORS.blue}
                    subtitle={`${o.buyer?.phone || "sem telefone"} · ${formatDate(o.created_at)}`}
                    status={o.status}
                  />
                  <Text style={styles.postTitle}>{o.product?.product_type || "Produto"}</Text>
                  <View style={styles.routeRow}>
                    <Icon name="pin" size={13} color={COLORS.muted} />
                    <Text style={styles.postSub} numberOfLines={1}>{o.location}</Text>
                  </View>
                  <View style={styles.orderTotals}>
                    <Text style={styles.postPrice}>{o.quantity.toLocaleString()} kg</Text>
                    <Text style={styles.postPrice}>{((o.product?.price || 0) * o.quantity).toLocaleString()} Kz</Text>
                  </View>

                  <View style={styles.orderActions}>
                    {o.status === "pending" && (
                      <>
                        <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.soft }]} onPress={() => acceptOrder(o.id)}>
                          <Icon name="check" size={15} color={COLORS.primary} />
                          <Text style={[styles.smallActionText, { color: COLORS.primary }]}>Aceitar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.dangerSoft }]} onPress={() => rejectOrder(o.id)}>
                          <Icon name="close" size={15} color={COLORS.danger} />
                          <Text style={[styles.smallActionText, { color: COLORS.danger }]}>Rejeitar</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.blueSoft }]} onPress={() => contactBuyer(o)}>
                      <Icon name="message" size={14} color={COLORS.blue} />
                      <Text style={[styles.smallActionText, { color: COLORS.blue }]}>Contactar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )
          )}

          {/* INDICAÇÕES */}
          {visibleTab === "referrals" && isAgente && (
            agentStats.recentReferrals.length === 0 ? (
              <EmptyState icon="users" message="Ainda não tens indicações" sub="Partilha o teu código para começares a ganhar pontos." />
            ) : (
              agentStats.recentReferrals.map((r: any, i: number) => (
                <View key={`${r.user_name}-${i}`} style={[styles.post, styles.referralRow]}>
                  <Avatar name={r.user_name || "?"} size={42} accent={COLORS.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.postAuthor} numberOfLines={1}>{r.user_name}</Text>
                    <Text style={styles.postTime}>Entrou a {formatDate(r.created_at)}</Text>
                  </View>
                  <View style={styles.referralPoints}>
                    <Icon name="star" size={12} color={COLORS.gold} filled />
                    <Text style={styles.referralPointsText}>+{r.points}</Text>
                  </View>
                </View>
              ))
            )
          )}

          {/* ESTATÍSTICAS */}
          {visibleTab === "statistics" && (
            <View style={styles.statsGrid}>
              {statisticsRows.map((row) => (
                <View key={row.label} style={styles.statsTile}>
                  <Text style={[styles.statsTileValue, { color: row.color }]}>{row.val.toLocaleString()}</Text>
                  <Text style={styles.statsTileLabel}>{row.label}</Text>
                </View>
              ))}
              {isAgente && (
                <Text style={styles.statsNote}>
                  Cada utilizador indicado vale pontos que podes trocar por benefícios na plataforma.
                </Text>
              )}
            </View>
          )}

          {/* RODAPÉ */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} AgriLink</Text>
            <Text style={styles.footerText}>
              Desenvolvida pela <Text style={styles.footerBrand}>THE TEAM</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* EDITAR PERFIL */}
      <Modal visible={editMode} transparent animationType="slide" onRequestClose={() => setEditMode(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditMode(false)}>
            <Pressable
              style={[styles.sheetPanel, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.settingsTitle}>Editar perfil</Text>
              <View style={{ gap: 14 }}>
                <Field label="Nome completo" value={profileData.full_name} onChangeText={(v) => setProfileData((p) => ({ ...p, full_name: v }))} />
                <Field label="Telefone" value={profileData.phone} onChangeText={(v) => setProfileData((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
                <Field label="Email" value={profileData.email} onChangeText={(v) => setProfileData((p) => ({ ...p, email: v }))} keyboardType="email-address" />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={updateProfile} activeOpacity={0.85}>
                    <Text style={styles.primaryBtnText}>Guardar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pillOutline, { flex: 1 }]} onPress={() => setEditMode(false)} activeOpacity={0.85}>
                    <Text style={styles.pillOutlineText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* DEFINIÇÕES */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSettingsOpen(false)}>
          <Pressable
            style={[styles.sheetPanel, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.settingsTitle}>{t("settings.title")}</Text>

            <Text style={styles.settingsLanguageLabel}>{t("settings.language")}</Text>
            <View style={styles.languageOptions}>
              {([
                { code: "pt-AO", label: t("settings.portuguese") },
                { code: "fr-CD", label: t("settings.french") },
                { code: "en-ZA", label: t("settings.english") },
              ] as const).map((option) => {
                const selected = i18n.language === option.code || i18n.language.startsWith(`${option.code}-`);
                return (
                  <TouchableOpacity
                    key={option.code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => changeLanguage(option.code)}
                    style={[styles.languageOption, selected && styles.languageOptionSelected]}
                  >
                    <Text style={[styles.languageOptionText, selected && styles.languageOptionTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.8} onPress={() => { setSettingsOpen(false); router.push("/notifications"); }}>
              <View style={styles.settingsIcon}>
                <Icon name="bell" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.settingsRowText}>{t("settings.notifications")}</Text>
              <Icon name="chevron-right" size={16} color={COLORS.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.8} onPress={() => { setSettingsOpen(false); router.push("/seguranca"); }}>
              <View style={styles.settingsIcon}>
                <Icon name="shield" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.settingsRowText}>{t("settings.security")}</Text>
              <Icon name="chevron-right" size={16} color={COLORS.faint} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.8}
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel={t("profile.logout")}
            >
              <View style={[styles.settingsIcon, { backgroundColor: COLORS.dangerSoft }]}>
                <Icon name="log-out" size={18} color={COLORS.danger} />
              </View>
              <Text style={[styles.settingsRowText, { color: COLORS.danger }]}>{t("profile.logout")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.pillOutline, { marginTop: 8 }]} onPress={() => setSettingsOpen(false)} activeOpacity={0.85}>
              <Text style={styles.pillOutlineText}>{t("settings.close")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.white },
  centerScreen: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },

  // Barra superior
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 8, paddingBottom: 6, backgroundColor: COLORS.white,
  },
  topTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: COLORS.text },
  iconBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },

  // Capa
  cover: { height: COVER_HEIGHT, backgroundColor: COLORS.soft, overflow: "hidden" },
  coverBlob: { position: "absolute", borderRadius: 999, backgroundColor: COLORS.primary },
  coverBlobA: { width: 190, height: 190, right: -50, top: -80, opacity: 0.12 },
  coverBlobB: { width: 120, height: 120, left: -30, bottom: -60, opacity: 0.08 },

  // Perfil
  profileBody: { paddingHorizontal: 16, paddingBottom: 6 },
  avatarRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -(AVATAR / 2) },
  avatarWrap: {
    width: AVATAR + 8, height: AVATAR + 8, borderRadius: (AVATAR + 8) / 2,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
  },
  avatarEdit: {
    position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, borderWidth: 2.5, borderColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
  },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 6 },
  outlineBtn: {
    flexDirection: "row", alignItems: "center", gap: 7, height: 38, paddingHorizontal: 16,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  outlineBtnText: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  squareBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white,
  },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  memberName: { fontSize: 22, fontWeight: "800", color: COLORS.text, flexShrink: 1, letterSpacing: -0.3 },

  handleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" },
  handleBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  handleText: { fontSize: 13.5, color: COLORS.muted, fontWeight: "600" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 12, fontWeight: "800", textTransform: "capitalize" },

  metaWrap: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  metaText: { fontSize: 13, color: COLORS.muted, fontWeight: "500", flexShrink: 1 },

  // Estatísticas em linha
  statsRow: { flexDirection: "row", marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  statValue: { fontSize: 19, fontWeight: "800" },
  statLabel: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },

  // Atalhos
  highlightsScroll: { flexGrow: 0 },
  highlightsContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, gap: 18 },
  highlight: { alignItems: "center", width: 64 },
  highlightCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  highlightLabel: { fontSize: 11.5, fontWeight: "700", color: COLORS.text, marginTop: 6, textAlign: "center" },

  // Tabs
  tabsBar: {
    backgroundColor: COLORS.white, marginTop: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabsTrack: {
    flexDirection: "row", gap: 6, padding: 5, borderRadius: 22,
    backgroundColor: COLORS.field, borderWidth: 1, borderColor: COLORS.border,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 2, borderRadius: 17 },
  tabItemActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  tabIconBubble: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.soft,
  },
  tabIconBubbleActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabLabel: { fontSize: 11.5, fontWeight: "700", color: COLORS.muted },
  tabLabelActive: { color: "#FFFFFF", fontWeight: "800" },
  tabBadge: {
    position: "absolute", top: -4, right: -6, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 2, borderColor: COLORS.field,
  },
  tabBadgeText: { fontSize: 9.5, fontWeight: "800", color: "#FFFFFF" },

  // Feed
  feed: { backgroundColor: COLORS.white, minHeight: 320 },
  post: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  postAuthor: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  postTime: { fontSize: 12, color: COLORS.faint, marginTop: 1 },
  postTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text, letterSpacing: -0.2 },
  postSub: { fontSize: 13.5, color: COLORS.muted, marginTop: 3, flexShrink: 1 },
  postBody: { fontSize: 13.5, color: COLORS.text, lineHeight: 20, marginTop: 8 },
  postPrice: { fontSize: 15, fontWeight: "800", color: COLORS.primary, marginTop: 8 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  tagRow: { flexDirection: "row", marginTop: 10 },
  tag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.soft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  postFooter: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
  reaction: { flexDirection: "row", alignItems: "center", gap: 6 },
  reactionText: { fontSize: 13, color: COLORS.muted, fontWeight: "700" },
  removeLinkText: { fontSize: 12.5, color: COLORS.danger, fontWeight: "700" },

  orderTotals: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  smallActionBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999 },
  smallActionText: { fontSize: 12.5, fontWeight: "800" },

  referralRow: { flexDirection: "row", alignItems: "center" },
  referralPoints: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.goldSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  referralPointsText: { fontSize: 13, fontWeight: "800", color: COLORS.gold },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: "800" },

  // Estatísticas (grelha)
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 16 },
  statsTile: {
    width: "48%", flexGrow: 1, backgroundColor: COLORS.field, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, paddingVertical: 16, paddingHorizontal: 14,
  },
  statsTileValue: { fontSize: 26, fontWeight: "800" },
  statsTileLabel: { fontSize: 12.5, color: COLORS.muted, fontWeight: "600", marginTop: 4 },
  statsNote: { width: "100%", fontSize: 12.5, color: COLORS.muted, lineHeight: 19, textAlign: "center", marginTop: 4, paddingHorizontal: 8 },

  // Sourcing
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  formBlock: { gap: 14, padding: 16, backgroundColor: COLORS.field, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  blockTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  blockSubtitle: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },
  smallPill: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  smallPillText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },

  // Estado vazio
  emptyState: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 28 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyMessage: { fontSize: 15, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  emptySub: { fontSize: 13, color: COLORS.muted, marginTop: 6, textAlign: "center", lineHeight: 19 },

  // Formulários
  fieldLabel: { fontSize: 13.5, fontWeight: "700", color: COLORS.text, marginBottom: 7 },
  fieldRequired: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  fieldInput: {
    height: 46, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 13, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.field,
  },
  fieldInputFocused: { borderColor: COLORS.primary, backgroundColor: "#FFFFFF" },

  primaryBtn: {
    height: 44, borderRadius: 999, backgroundColor: COLORS.primary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pillOutline: {
    height: 44, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
  },
  pillOutlineText: { fontSize: 15, fontWeight: "700", color: COLORS.text },

  // Rodapé
  footer: { alignItems: "center", marginTop: 28, gap: 3 },
  footerText: { fontSize: 11.5, color: "#8A968C" },
  footerBrand: { fontWeight: "800", color: COLORS.dark, letterSpacing: 0.5 },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: "rgba(10,40,20,0.5)", justifyContent: "flex-end" },
  sheetPanel: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 12 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 18 },
  settingsTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginBottom: 14 },
  settingsLanguageLabel: { fontSize: 13, fontWeight: "700", color: COLORS.muted, marginBottom: 8 },
  languageOptions: { flexDirection: "row", gap: 8, marginBottom: 8 },
  languageOption: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  languageOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.soft },
  languageOptionText: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textAlign: "center" },
  languageOptionTextSelected: { color: COLORS.primary },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  settingsIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" },
  settingsRowText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "700" },
});