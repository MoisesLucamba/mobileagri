import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
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
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { supabase } from "../lib/supabase";

const { height: SCREEN_H } = Dimensions.get("window");
const AVATAR = 92;

// =====================================================
// BRANDING — mesmos tokens do ecrã de login
// =====================================================

const COLORS = {
  // Fundo marfim/leite; os botões mantêm o verde original da marca.
  primary: "#1F6B3A",
  secondary: "#79C267",
  dark: "#465044",
  deep: "#343B32",
  text: "#3D403A",
  muted: "#77796F",
  faint: "#A3A398",
  border: "#E8E5DC",
  field: "#F5F3EC",
  background: "#FBFAF6",
  soft: "#EEF0E9",
  gold: "#B7833D",
  goldSoft: "#F5EEDF",
  blue: "#637F9C",
  blueSoft: "#EDF1F5",
  danger: "#B95E54",
  dangerSoft: "#F6ECE9",
};

const ROLE_ACCENT: Record<string, string> = {
  agricultor: COLORS.primary,
  agente: "#E2932F",
  comprador: COLORS.blue,
  motorista: "#DB6B1F",
};

const SHADOW_SOFT = {
  shadowColor: COLORS.dark,
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 6,
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

// =====================================================
// MICRO COMPONENTES
// =====================================================

function StatsRow({ items }: { items: { value: number | string; label: string; color: string }[] }) {
  return (
    <View style={styles.statsRow}>
      {items.map((it) => (
        <View key={it.label} style={styles.statTile}>
          <Text style={[styles.statValue, { color: it.color }]}>{it.value}</Text>
          <Text style={styles.statLabel} numberOfLines={2}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={15} color={COLORS.primary} />
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value || "—"}</Text>
    </View>
  );
}

function TabChip({ active, onPress, icon, label, badge }: {
  active: boolean; onPress: () => void; icon: keyof typeof Ionicons.glyphMap;
  label: string; badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.tabChip, active && styles.tabChipActive]}
    >
      <Ionicons name={icon} size={15} color={active ? "#FFFFFF" : COLORS.muted} />
      <Text style={[styles.tabChipText, active && { color: "#FFFFFF" }]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: COLORS.soft, color: COLORS.primary, label: "Activo" },
    inactive: { bg: COLORS.goldSoft, color: COLORS.gold, label: "Inactivo" },
    removed: { bg: COLORS.dangerSoft, color: COLORS.danger, label: "Removido" },
    pending: { bg: COLORS.goldSoft, color: COLORS.gold, label: "Pendente" },
    accepted: { bg: COLORS.soft, color: COLORS.primary, label: "Aceite" },
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

function EmptyState({ icon, message, sub }: {
  icon: keyof typeof Ionicons.glyphMap; message: string; sub?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={COLORS.primary} />
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

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

const TABS_BY_ROLE: Record<string, { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[]> = {
  comprador: [
    { id: "products", label: "Fichas", icon: "clipboard-outline" },
    { id: "sourcing", label: "Sourcing", icon: "search-outline" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart-outline" },
  ],
  agricultor: [
    { id: "products", label: "Produtos", icon: "cube-outline" },
    { id: "orders", label: "Encomendas", icon: "cart-outline" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart-outline" },
  ],
  agente: [
    { id: "products", label: "Produtos", icon: "cube-outline" },
    { id: "orders", label: "Encomendas", icon: "cart-outline" },
    { id: "referrals", label: "Indicações", icon: "people-outline" },
    { id: "statistics", label: "Estatísticas", icon: "bar-chart-outline" },
  ],
  motorista: [
    { id: "statistics", label: "Estatísticas", icon: "bar-chart-outline" },
  ],
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("products");

  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [fichasRecebimento, setFichasRecebimento] = useState<FichaRecebimento[]>([]);
  const [receivedOrders, setReceivedOrders] = useState<ReceivedOrder[]>([]);
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([]);
  const [productStats, setProductStats] = useState<Record<string, { likes: number; comments: number }>>({});
  const [agentStats, setAgentStats] = useState({ totalReferrals: 0, totalPoints: 0, recentReferrals: [] as any[] });
  const [buyerStats, setBuyerStats] = useState({ completedOrders: 0, favoriteProducts: 0 });

  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [sourcingForm, setSourcingForm] = useState({ product_name: "", quantity: "", delivery_date: "", description: "" });
  const [submittingSourcing, setSubmittingSourcing] = useState(false);

  const [profileData, setProfileData] = useState({ full_name: "", phone: "", email: "" });

  const isComprador = userProfile?.user_type === "comprador";
  const isAgente = userProfile?.user_type === "agente";
  const isAgricultor = userProfile?.user_type === "agricultor";
  const roleAccent = ROLE_ACCENT[userProfile?.user_type] || COLORS.primary;
  const memberCode = userProfile?.agent_code || (authUser?.id ? authUser.id.slice(0, 8).toUpperCase() : "—");

  const tabs = TABS_BY_ROLE[userProfile?.user_type] || TABS_BY_ROLE.agricultor;

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

  const loadAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthUser(null);
        setLoading(false);
        return;
      }
      setAuthUser(user);

      const { data: profileRow } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
      setUserProfile(profileRow);
      setProfileData({
        full_name: profileRow?.full_name || "",
        phone: profileRow?.phone || "",
        email: profileRow?.email || user.email || "",
      });

      const type = profileRow?.user_type;
      if (type === "comprador") {
        await Promise.all([fetchFichasRecebimento(user.id), fetchSourcingRequests(user.id), fetchBuyerStats(user.id)]);
      } else {
        await Promise.all([fetchUserProducts(user.id), fetchReceivedOrders(user.id)]);
      }
      if (type === "agente") await fetchAgentStats(user.id);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchUserProducts, fetchFichasRecebimento, fetchReceivedOrders, fetchSourcingRequests, fetchBuyerStats, fetchAgentStats]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => { setRefreshing(true); loadAll(); };

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
        router.push({ pathname: "/messages/[id]", params: { id: existing[0].id } });
        return;
      }

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ user_id: authUser.id, peer_user_id: order.buyer_id, title: order.buyer?.full_name || "Comprador", last_timestamp: new Date().toISOString() })
        .select("id")
        .single();

      if (error) throw error;
      router.push({ pathname: "/messages/[id]", params: { id: newConv.id } });
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
        { value: fichasRecebimento.length, label: "Fichas criadas", color: COLORS.primary },
        { value: buyerStats.completedOrders, label: "Compras concluídas", color: COLORS.primary },
        { value: buyerStats.favoriteProducts, label: "Favoritos", color: COLORS.gold },
      ];
    }
    return [
      { value: activeProducts, label: "Produtos activos", color: COLORS.primary },
      { value: totalComments, label: "Comentários", color: COLORS.primary },
      { value: totalLikes, label: "Gostos", color: COLORS.gold },
    ];
  }, [isAgente, isComprador, agentStats, fichasRecebimento, buyerStats, activeProducts, totalComments, totalLikes]);

  // ===================================================
  // ESTADOS DE CARREGAMENTO / SEM SESSÃO
  // ===================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>A carregar o teu perfil...</Text>
      </SafeAreaView>
    );
  }

  if (!authUser) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Ionicons name="person-circle-outline" size={68} color={COLORS.primary} />
        <Text style={styles.emptyMessage}>Sessão não encontrada</Text>
        <TouchableOpacity style={[styles.pillButton, { paddingHorizontal: 32 }]} onPress={() => router.replace("/login")}>
          <Text style={styles.pillButtonText}>Iniciar sessão</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const profileName = userProfile?.full_name || authUser?.user_metadata?.full_name || "Utilizador AgriLink";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* TOPO */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>O meu perfil</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setSettingsOpen(true)} activeOpacity={0.8}>
              <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              activeOpacity={0.8}
              onPress={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
            >
              <Ionicons name="log-out-outline" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* PAINEL BRANCO */}
        <View style={styles.sheet}>
          <TouchableOpacity onPress={changeAvatar} activeOpacity={0.9} style={styles.avatarWrap}>
            {userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{profileName.charAt(0).toUpperCase()}</Text>
            )}
            <View style={styles.avatarEdit}>
              {avatarLoading
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="camera" size={13} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.memberName} numberOfLines={1}>{profileName}</Text>
            {userProfile?.verified && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
          </View>

          <View style={[styles.rolePill, { backgroundColor: `${roleAccent}1A` }]}>
            <View style={[styles.roleDot, { backgroundColor: roleAccent }]} />
            <Text style={[styles.roleText, { color: roleAccent }]}>{userProfile?.user_type || "—"}</Text>
          </View>

          {!editMode ? (
            <>
              <View style={styles.infoBlock}>
                <InfoRow icon="mail-outline" value={profileData.email} />
                <InfoRow icon="call-outline" value={profileData.phone} />
                <InfoRow icon="location-outline" value={userProfile?.province_id || "Angola"} />
              </View>

              <View style={styles.memberActions}>
                <TouchableOpacity style={[styles.pillButton, { flex: 1 }]} onPress={() => setEditMode(true)} activeOpacity={0.85}>
                  <Ionicons name="create-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.pillButtonText}>Editar perfil</Text>
                </TouchableOpacity>
                {isAgente && (
                  <TouchableOpacity style={styles.roundOutline} onPress={shareAgentCode} activeOpacity={0.85}>
                    <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.historyLink}
                onPress={() => router.push("/historicopagamentos")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Abrir histórico de compras e pagamentos"
              >
                <View style={styles.historyLinkIcon}>
                  <Ionicons name="receipt-outline" size={19} color={COLORS.primary} />
                </View>
                <View style={styles.historyLinkTextBlock}>
                  <Text style={styles.historyLinkTitle}>Histórico de compras e pagamentos</Text>
                  <Text style={styles.historyLinkSubtitle}>Pedidos e movimentos da carteira</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.faint} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ marginTop: 20, gap: 14 }}>
              <Field label="Nome completo" value={profileData.full_name} onChangeText={(v) => setProfileData((p) => ({ ...p, full_name: v }))} />
              <Field label="Telefone" value={profileData.phone} onChangeText={(v) => setProfileData((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
              <Field label="Email" value={profileData.email} onChangeText={(v) => setProfileData((p) => ({ ...p, email: v }))} keyboardType="email-address" />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <TouchableOpacity style={[styles.pillButton, { flex: 1 }]} onPress={updateProfile} activeOpacity={0.85}>
                  <Text style={styles.pillButtonText}>Guardar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pillOutline, { flex: 1 }]} onPress={() => setEditMode(false)} activeOpacity={0.85}>
                  <Text style={styles.pillOutlineText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.codeChip} onPress={copyMemberCode} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={13} color={COLORS.muted} />
            <Text style={styles.codeChipLabel}>Rede AgriLink</Text>
            <Text style={styles.codeChipValue}>#{memberCode}</Text>
          </TouchableOpacity>

          <StatsRow items={statItems} />

          {isAgente && userProfile?.agent_code && (
            <View style={[styles.agentCodeCard, { backgroundColor: `${roleAccent}14` }]}>
              <Text style={styles.agentCodeLabel}>Código de agente</Text>
              <Text style={[styles.agentCodeValue, { color: roleAccent }]}>{userProfile.agent_code}</Text>
            </View>
          )}

          {/* TABS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          >
            {tabs.map((tab) => (
              <TabChip
                key={tab.id}
                active={activeTab === tab.id}
                onPress={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
                badge={tab.id === "orders" ? receivedOrders.filter((o) => o.status === "pending").length : undefined}
              />
            ))}
          </ScrollView>

          {/* PRODUTOS / FICHAS */}
          {activeTab === "products" && (
            isComprador ? (
              fichasRecebimento.length === 0 ? (
                <EmptyState icon="clipboard-outline" message="Ainda não criaste fichas de recebimento" />
              ) : (
                <View style={{ gap: 10 }}>
                  {fichasRecebimento.map((f) => (
                    <View key={f.id} style={styles.listCard}>
                      <Text style={styles.listCardTitle}>{f.nomeFicha}</Text>
                      <Text style={styles.listCardSub}>{f.produto} · {f.qualidade}</Text>
                      <Text style={styles.listCardMeta}>{f.locaisEntrega?.length || 0} locais · {formatDate(f.created_at)}</Text>
                    </View>
                  ))}
                </View>
              )
            ) : (
              userProducts.length === 0 ? (
                <EmptyState icon="cube-outline" message="Ainda não publicaste produtos" />
              ) : (
                <View style={{ gap: 10 }}>
                  {userProducts.map((p) => (
                    <View key={p.id} style={styles.listCard}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.listCardTitle, { flex: 1 }]} numberOfLines={1}>{p.product_type}</Text>
                        <StatusPill status={p.status} />
                      </View>
                      <Text style={styles.listCardSub}>{p.quantity.toLocaleString()} kg · colheita {formatDate(p.harvest_date)}</Text>
                      <View style={[styles.rowBetween, { marginTop: 8 }]}>
                        <Text style={styles.listCardPrice}>{p.price.toLocaleString()} Kz/kg</Text>
                        <View style={styles.interactionsRow}>
                          <Ionicons name="chatbubble-outline" size={12} color={COLORS.muted} />
                          <Text style={styles.interactionsText}>{productStats[p.id]?.comments || 0}</Text>
                          <Ionicons name="heart-outline" size={12} color={COLORS.muted} />
                          <Text style={styles.interactionsText}>{productStats[p.id]?.likes || 0}</Text>
                        </View>
                      </View>
                      {p.status !== "removed" && (
                        <TouchableOpacity onPress={() => deleteProduct(p.id)} style={styles.removeLink}>
                          <Text style={styles.removeLinkText}>Remover produto</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )
            )
          )}

          {/* SOURCING */}
          {activeTab === "sourcing" && isComprador && (
            <View style={{ gap: 14 }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.blockTitle}>Pedidos de sourcing</Text>
                  <Text style={styles.blockSubtitle}>Pede-nos para encontrar um produto específico</Text>
                </View>
                <TouchableOpacity style={styles.smallPill} onPress={() => setShowSourcingForm((v) => !v)} activeOpacity={0.85}>
                  <Text style={styles.smallPillText}>{showSourcingForm ? "Cancelar" : "Novo pedido"}</Text>
                </TouchableOpacity>
              </View>

              {showSourcingForm && (
                <View style={{ gap: 14 }}>
                  <Field label="Nome do produto" value={sourcingForm.product_name} onChangeText={(v) => setSourcingForm((p) => ({ ...p, product_name: v }))} required />
                  <Field label="Quantidade (kg)" value={sourcingForm.quantity} onChangeText={(v) => setSourcingForm((p) => ({ ...p, quantity: v }))} required />
                  <Field label="Data de entrega (AAAA-MM-DD)" value={sourcingForm.delivery_date} onChangeText={(v) => setSourcingForm((p) => ({ ...p, delivery_date: v }))} required />
                  <Field label="Descrição" value={sourcingForm.description} onChangeText={(v) => setSourcingForm((p) => ({ ...p, description: v }))} />
                  <TouchableOpacity
                    style={[styles.pillButton, submittingSourcing && { opacity: 0.65 }]}
                    onPress={submitSourcingRequest}
                    disabled={submittingSourcing}
                    activeOpacity={0.85}
                  >
                    {submittingSourcing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.pillButtonText}>Enviar pedido</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {sourcingRequests.length === 0 ? (
                <EmptyState icon="search-outline" message="Ainda não fizeste pedidos de sourcing" />
              ) : (
                <View style={{ gap: 10 }}>
                  {sourcingRequests.map((r) => (
                    <View key={r.id} style={styles.listCard}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.listCardTitle, { flex: 1 }]} numberOfLines={1}>{r.product_name}</Text>
                        <StatusPill status={r.status} />
                      </View>
                      <Text style={styles.listCardSub}>{r.quantity} kg · entrega {new Date(r.delivery_date).toLocaleDateString("pt-AO")}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ENCOMENDAS RECEBIDAS */}
          {activeTab === "orders" && (isAgricultor || isAgente) && (
            receivedOrders.length === 0 ? (
              <EmptyState icon="cart-outline" message="Ainda não recebeste encomendas" sub="Vão aparecer aqui assim que alguém pré-encomendar um dos teus produtos." />
            ) : (
              <View style={{ gap: 10 }}>
                {receivedOrders.map((o) => (
                  <View key={o.id} style={styles.listCard}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.listCardTitle, { flex: 1 }]} numberOfLines={1}>{o.product?.product_type || "Produto"}</Text>
                      <StatusPill status={o.status} />
                    </View>
                    <Text style={styles.listCardSub}>{o.buyer?.full_name || "Comprador"} · {o.buyer?.phone || "sem telefone"}</Text>
                    <Text style={styles.listCardMeta}>{o.location} · {formatDate(o.created_at)}</Text>
                    <View style={[styles.rowBetween, { marginTop: 8 }]}>
                      <Text style={styles.listCardPrice}>{o.quantity.toLocaleString()} kg</Text>
                      <Text style={styles.listCardPrice}>{((o.product?.price || 0) * o.quantity).toLocaleString()} Kz</Text>
                    </View>

                    <View style={styles.orderActions}>
                      {o.status === "pending" && (
                        <>
                          <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.soft }]} onPress={() => acceptOrder(o.id)}>
                            <Ionicons name="checkmark" size={15} color={COLORS.primary} />
                            <Text style={[styles.smallActionText, { color: COLORS.primary }]}>Aceitar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.dangerSoft }]} onPress={() => rejectOrder(o.id)}>
                            <Ionicons name="close" size={15} color={COLORS.danger} />
                            <Text style={[styles.smallActionText, { color: COLORS.danger }]}>Rejeitar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.blueSoft }]} onPress={() => contactBuyer(o)}>
                        <Ionicons name="chatbubble-outline" size={14} color={COLORS.blue} />
                        <Text style={[styles.smallActionText, { color: COLORS.blue }]}>Contactar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}

          {/* INDICAÇÕES */}
          {activeTab === "referrals" && isAgente && (
            agentStats.recentReferrals.length === 0 ? (
              <EmptyState icon="people-outline" message="Ainda não tens indicações" sub="Partilha o teu código para começares a ganhar pontos." />
            ) : (
              <View style={{ gap: 10 }}>
                {agentStats.recentReferrals.map((r: any, i: number) => (
                  <View key={`${r.user_name}-${i}`} style={[styles.listCard, styles.referralCard]}>
                    <View style={styles.referralAvatar}>
                      <Ionicons name="person" size={15} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.listCardTitle}>{r.user_name}</Text>
                      <Text style={styles.listCardSub}>{formatDate(r.created_at)}</Text>
                    </View>
                    <View style={styles.referralPoints}>
                      <Ionicons name="star" size={12} color={COLORS.gold} />
                      <Text style={styles.referralPointsText}>+{r.points}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}

          {/* ESTATÍSTICAS */}
          {activeTab === "statistics" && (
            <View style={{ gap: 10 }}>
              {(isAgente
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
                  ]
              ).map((row) => (
                <View key={row.label} style={[styles.listCard, styles.rowBetween]}>
                  <Text style={styles.statsRowLabel}>{row.label}</Text>
                  <Text style={[styles.statsRowValue, { color: row.color }]}>{row.val.toLocaleString()}</Text>
                </View>
              ))}

              {isAgente && (
                <Text style={styles.statsNote}>
                  Cada utilizador indicado vale pontos que podes trocar por benefícios na plataforma.
                </Text>
              )}
            </View>
          )}

          {/* RODAPÉ (igual ao login) */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} AgriLink</Text>
            <Text style={styles.footerText}>
              Desenvolvida pela <Text style={styles.footerBrand}>THE TEAM</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* DEFINIÇÕES */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSettingsOpen(false)}>
          <Pressable
            style={[styles.settingsSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.settingsTitle}>Definições</Text>

            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.8} onPress={() => { setSettingsOpen(false); router.push("/notificacoes"); }}>
              <View style={styles.settingsIcon}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.settingsRowText}>Notificações</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.8} onPress={() => { setSettingsOpen(false); router.push("/seguranca"); }}>
              <View style={styles.settingsIcon}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.settingsRowText}>Segurança e privacidade</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.pillOutline, { marginTop: 8 }]} onPress={() => setSettingsOpen(false)} activeOpacity={0.85}>
              <Text style={styles.pillOutlineText}>Fechar</Text>
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
  screen: { flex: 1, backgroundColor: COLORS.background },
  centerScreen: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  loadingText: { fontSize: 14, color: COLORS.muted },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingBottom: 64 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.primary, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },

  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 22,
    paddingTop: AVATAR / 2 + 14,
    minHeight: SCREEN_H * 0.8,
    shadowColor: COLORS.deep,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },

  avatarWrap: {
    position: "absolute", top: -AVATAR / 2, alignSelf: "center",
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
    borderWidth: 4, borderColor: "#FFFFFF",
    ...SHADOW_SOFT,
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: AVATAR / 2 },
  avatarInitial: { fontSize: 34, fontWeight: "800", color: "#FFFFFF" },
  avatarEdit: {
    position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.secondary, borderWidth: 2.5, borderColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },

  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  memberName: { fontSize: 24, fontWeight: "800", color: COLORS.text, flexShrink: 1, textAlign: "center" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", marginTop: 8, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999 },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  roleText: { fontSize: 12.5, fontWeight: "800", textTransform: "capitalize" },

  infoBlock: { marginTop: 22, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" },
  infoValue: { flex: 1, fontSize: 14.5, color: COLORS.text, fontWeight: "600" },

  memberActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  historyLink: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 12, padding: 11, borderRadius: 17,
    backgroundColor: COLORS.field, borderWidth: 1, borderColor: COLORS.border,
  },
  historyLinkIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" },
  historyLinkTextBlock: { flex: 1 },
  historyLinkTitle: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  historyLinkSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3 },

  pillButton: {
    height: 54, borderRadius: 999, backgroundColor: COLORS.primary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    ...SHADOW_SOFT,
  },
  pillButtonText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "800" },
  pillOutline: {
    height: 54, borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center",
  },
  pillOutlineText: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  roundOutline: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center",
  },
  smallPill: { height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  smallPillText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },

  codeChip: {
    flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 7,
    marginTop: 18, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.field,
  },
  codeChipLabel: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
  codeChipValue: { fontSize: 12.5, color: COLORS.text, fontWeight: "800", letterSpacing: 0.5 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  statTile: { flex: 1, backgroundColor: COLORS.field, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 11.5, color: COLORS.muted, fontWeight: "600", marginTop: 4, textAlign: "center" },

  agentCodeCard: { borderRadius: 18, padding: 16, marginTop: 10, alignItems: "center" },
  agentCodeLabel: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
  agentCodeValue: { fontSize: 22, fontWeight: "800", letterSpacing: 1.5, marginTop: 2 },

  tabsScroll: { marginTop: 24, marginBottom: 16, flexGrow: 0 },
  tabChip: {
    flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingHorizontal: 15,
    borderRadius: 999, backgroundColor: COLORS.field,
  },
  tabChipActive: { backgroundColor: COLORS.primary },
  tabChipText: { fontSize: 13, fontWeight: "700", color: COLORS.muted },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },

  listCard: { backgroundColor: COLORS.field, borderRadius: 18, padding: 16 },
  listCardTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  listCardSub: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  listCardMeta: { fontSize: 12, color: COLORS.faint, marginTop: 3 },
  listCardPrice: { fontSize: 14.5, fontWeight: "800", color: COLORS.primary },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  interactionsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  interactionsText: { fontSize: 12, color: COLORS.muted, marginRight: 8, fontWeight: "600" },

  removeLink: { marginTop: 10, alignSelf: "flex-start" },
  removeLinkText: { fontSize: 12.5, color: COLORS.danger, fontWeight: "700" },

  statusPill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, marginLeft: 8 },
  statusPillText: { fontSize: 11, fontWeight: "800" },

  emptyState: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24, backgroundColor: COLORS.field, borderRadius: 22 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyMessage: { fontSize: 15, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  emptySub: { fontSize: 13, color: COLORS.muted, marginTop: 6, textAlign: "center", lineHeight: 19 },

  blockTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  blockSubtitle: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },

  fieldLabel: { fontSize: 13.5, fontWeight: "700", color: COLORS.text, marginBottom: 7 },
  fieldRequired: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  fieldInput: {
    height: 54, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 15, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.field,
  },
  fieldInputFocused: { borderColor: COLORS.primary, backgroundColor: "#FFFFFF" },

  orderActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  smallActionBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999 },
  smallActionText: { fontSize: 12.5, fontWeight: "800" },

  referralCard: { flexDirection: "row", alignItems: "center" },
  referralAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" },
  referralPoints: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.goldSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  referralPointsText: { fontSize: 13, fontWeight: "800", color: COLORS.gold },

  statsRowLabel: { fontSize: 14, color: COLORS.muted, fontWeight: "600" },
  statsRowValue: { fontSize: 22, fontWeight: "800" },
  statsNote: { fontSize: 12.5, color: COLORS.muted, lineHeight: 19, textAlign: "center", marginTop: 6, paddingHorizontal: 8 },

  footer: { alignItems: "center", marginTop: 32, gap: 3 },
  footerText: { fontSize: 11.5, color: "#8A968C" },
  footerBrand: { fontWeight: "800", color: COLORS.dark, letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(10,40,20,0.5)", justifyContent: "flex-end" },
  settingsSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 22, paddingTop: 12 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 18 },
  settingsTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 12 },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  settingsIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" },
  settingsRowText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "700" },
});
