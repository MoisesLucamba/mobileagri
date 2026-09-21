import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { supabase } from "../lib/supabase";

// =====================================================
// DESIGN TOKENS
// =====================================================

const COLORS = {
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EFEBE0",
  text: "#16231C",
  mid: "#3E4A40",
  muted: "#80897F",
  faint: "#B7BEB3",

  g50: "rgba(45,125,58,0.06)",
  g100: "rgba(45,125,58,0.12)",
  g500: "#2D7D3A",
  g600: "#245F2E",
  gold: "#C6871E",
  goldSoft: "#FFF7ED",
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
};

const ROLE_ACCENT: Record<string, string> = {
  agricultor: "#2D7D3A",
  agente: "#C6871E",
  comprador: "#2563EB",
  motorista: "#DB6B1F",
};

const RADIUS = { sm: 9, md: 13, lg: 18, xl: 22 };

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

function StatsStrip({ items }: { items: { value: number | string; label: string; color: string }[] }) {
  return (
    <View style={styles.statsStrip}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.statsCell, i > 0 && styles.statsCellDivider]}>
          <Text style={[styles.statsValue, { color: it.color }]}>{it.value}</Text>
          <Text style={styles.statsLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color={COLORS.faint} />
      <Text style={styles.infoValue} numberOfLines={1}>{value || "—"}</Text>
    </View>
  );
}

function TabPill({ active, onPress, icon, label, badge, accent }: {
  active: boolean; onPress: () => void; icon: keyof typeof Ionicons.glyphMap;
  label: string; badge?: number; accent: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.tabPillWrap}>
      <View style={[styles.tabPill, active && { borderBottomColor: accent }]}>
        <Ionicons name={icon} size={15} color={active ? COLORS.text : COLORS.muted} />
        <Text style={[styles.tabPillText, active && { color: COLORS.text, fontWeight: "800" }]}>{label}</Text>
        {!!badge && badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: COLORS.g50, color: COLORS.g600, label: "Activo" },
    inactive: { bg: COLORS.goldSoft, color: COLORS.gold, label: "Inactivo" },
    removed: { bg: COLORS.dangerSoft, color: COLORS.danger, label: "Removido" },
    pending: { bg: COLORS.goldSoft, color: COLORS.gold, label: "Pendente" },
    accepted: { bg: COLORS.g50, color: COLORS.g600, label: "Aceite" },
    rejected: { bg: COLORS.dangerSoft, color: COLORS.danger, label: "Rejeitado" },
    completed: { bg: COLORS.g50, color: COLORS.g600, label: "Concluído" },
  };
  const s = map[status] || { bg: COLORS.canvas, color: COLORS.muted, label: status };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function IconBtn({ icon, danger, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; danger?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.iconBtn, { backgroundColor: danger ? COLORS.dangerSoft : COLORS.g50 }]}
    >
      <Ionicons name={icon} size={15} color={danger ? COLORS.danger : COLORS.muted} />
    </TouchableOpacity>
  );
}

function EmptyState({ icon, message, sub }: {
  icon: keyof typeof Ionicons.glyphMap; message: string; sub?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={COLORS.faint} />
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
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.fieldRequired}>  obrigatório</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.fieldInput}
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
  const roleAccent = ROLE_ACCENT[userProfile?.user_type] || COLORS.g500;
  const memberCode = userProfile?.agent_code || (authUser?.id ? authUser.id.slice(0, 8).toUpperCase() : "—");

  const tabs = TABS_BY_ROLE[userProfile?.user_type] || TABS_BY_ROLE.agricultor;

  // ===================================================
  // FETCHES
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
  // AÇÕES
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
        { value: agentStats.totalReferrals, label: "Indicados", color: COLORS.g600 },
        { value: agentStats.totalPoints, label: "Pontos", color: COLORS.gold },
      ];
    }
    if (isComprador) {
      return [
        { value: fichasRecebimento.length, label: "Fichas criadas", color: COLORS.g600 },
        { value: buyerStats.completedOrders, label: "Compras concluídas", color: COLORS.g600 },
        { value: buyerStats.favoriteProducts, label: "Favoritos", color: COLORS.gold },
      ];
    }
    return [
      { value: activeProducts, label: "Produtos activos", color: COLORS.g600 },
      { value: totalComments, label: "Comentários", color: COLORS.g600 },
      { value: totalLikes, label: "Gostos", color: COLORS.gold },
    ];
  }, [isAgente, isComprador, agentStats, fichasRecebimento, buyerStats, activeProducts, totalComments, totalLikes]);

  // ===================================================
  // ESTADOS DE CARREGAMENTO / SEM SESSÃO
  // ===================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.g500} />
        <Text style={styles.loadingText}>A carregar o teu perfil...</Text>
      </SafeAreaView>
    );
  }

  if (!authUser) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Ionicons name="person-circle-outline" size={64} color={COLORS.g500} />
        <Text style={styles.emptyMessage}>Sessão não encontrada</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/login")}>
          <Text style={styles.primaryButtonText}>Iniciar sessão</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const profileName = userProfile?.full_name || authUser?.user_metadata?.full_name || "Utilizador AgriLink";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>O meu perfil</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSettingsOpen(true)}>
            <Ionicons name="settings-outline" size={17} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: COLORS.dangerSoft }]}
            onPress={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
          >
            <Ionicons name="log-out-outline" size={17} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.g500} />}
      >
        {/* CARTÃO DE MEMBRO */}
        <View style={styles.memberCard}>
          <View style={[styles.memberStripe, { backgroundColor: roleAccent }]} />

          <View style={{ flex: 1 }}>
            <View style={styles.memberHead}>
              <TouchableOpacity onPress={changeAvatar} style={styles.avatarWrap}>
                <View style={[styles.avatar, { backgroundColor: roleAccent }]}>
                  {userProfile?.avatar_url ? (
                    <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{profileName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.avatarEdit}>
                  {avatarLoading ? <ActivityIndicator size="small" color={roleAccent} /> : <Ionicons name="camera" size={11} color={roleAccent} />}
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1, marginLeft: 13 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName} numberOfLines={1}>{profileName}</Text>
                  {userProfile?.verified && <Ionicons name="checkmark-circle" size={15} color={roleAccent} />}
                </View>
                <View style={styles.roleRow}>
                  <View style={[styles.roleDot, { backgroundColor: roleAccent }]} />
                  <Text style={styles.roleText}>{userProfile?.user_type || "—"}</Text>
                </View>
              </View>
            </View>

            {!editMode ? (
              <View style={{ marginTop: 14 }}>
                <InfoRow icon="mail-outline" value={profileData.email} />
                <InfoRow icon="call-outline" value={profileData.phone} />
                <InfoRow icon="location-outline" value={userProfile?.province_id || "Angola"} />

                <View style={styles.memberActions}>
                  <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
                    <Ionicons name="create-outline" size={13} color={COLORS.g600} />
                    <Text style={styles.editButtonText}>Editar perfil</Text>
                  </TouchableOpacity>
                  {isAgente && (
                    <TouchableOpacity style={styles.shareButton} onPress={shareAgentCode}>
                      <Ionicons name="share-social-outline" size={15} color={COLORS.mid} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 14, gap: 12 }}>
                <Field label="Nome completo" value={profileData.full_name} onChangeText={(v) => setProfileData((p) => ({ ...p, full_name: v }))} />
                <Field label="Telefone" value={profileData.phone} onChangeText={(v) => setProfileData((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
                <Field label="Email" value={profileData.email} onChangeText={(v) => setProfileData((p) => ({ ...p, email: v }))} keyboardType="email-address" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={updateProfile}>
                    <Text style={styles.primaryButtonText}>Guardar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.outlineButton, { flex: 1 }]} onPress={() => setEditMode(false)}>
                    <Text style={styles.outlineButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.memberFooter} onPress={copyMemberCode}>
              <Text style={styles.memberFooterLabel}>Rede AgriLink</Text>
              <Text style={styles.memberFooterCode}>#{memberCode}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <StatsStrip items={statItems} />

        {isAgente && userProfile?.agent_code && (
          <View style={[styles.agentCodeCard, { backgroundColor: `${roleAccent}14` }]}>
            <Text style={styles.agentCodeLabel}>Código de agente</Text>
            <Text style={[styles.agentCodeValue, { color: roleAccent }]}>{userProfile.agent_code}</Text>
          </View>
        )}

        {/* TABS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
          {tabs.map((tab) => (
            <TabPill
              key={tab.id}
              active={activeTab === tab.id}
              onPress={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
              accent={roleAccent}
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
              <View style={{ gap: 9 }}>
                {fichasRecebimento.map((f) => (
                  <View key={f.id} style={styles.listCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listCardTitle}>{f.nomeFicha}</Text>
                      <Text style={styles.listCardSub}>{f.produto} · {f.qualidade}</Text>
                      <Text style={styles.listCardMeta}>{f.locaisEntrega?.length || 0} locais · {formatDate(f.created_at)}</Text>
                    </View>
                    <IconBtn icon="create-outline" />
                  </View>
                ))}
              </View>
            )
          ) : (
            userProducts.length === 0 ? (
              <EmptyState icon="cube-outline" message="Ainda não publicaste produtos" />
            ) : (
              <View style={{ gap: 9 }}>
                {userProducts.map((p) => (
                  <View key={p.id} style={styles.listCard}>
                    <View style={[styles.listCardStripe, { backgroundColor: p.status === "active" ? COLORS.g500 : p.status === "inactive" ? COLORS.gold : COLORS.danger }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.listCardTitle}>{p.product_type}</Text>
                        <StatusPill status={p.status} />
                      </View>
                      <Text style={styles.listCardSub}>{p.quantity.toLocaleString()} kg · {formatDate(p.harvest_date)}</Text>
                      <View style={styles.rowBetween}>
                        <Text style={styles.listCardPrice}>{p.price.toLocaleString()} Kz/kg</Text>
                        <View style={styles.interactionsRow}>
                          <Ionicons name="chatbubble-outline" size={11} color={COLORS.faint} />
                          <Text style={styles.interactionsText}>{productStats[p.id]?.comments || 0}</Text>
                          <Ionicons name="heart-outline" size={11} color={COLORS.faint} />
                          <Text style={styles.interactionsText}>{productStats[p.id]?.likes || 0}</Text>
                        </View>
                      </View>
                      {p.status !== "removed" && (
                        <TouchableOpacity onPress={() => deleteProduct(p.id)} style={styles.removeLink}>
                          <Text style={styles.removeLinkText}>Remover produto</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
              <View>
                <Text style={styles.blockTitle}>Pedidos de sourcing</Text>
                <Text style={styles.blockSubtitle}>Pede-nos para encontrar um produto específico</Text>
              </View>
              <TouchableOpacity style={styles.smallPrimaryButton} onPress={() => setShowSourcingForm((v) => !v)}>
                <Text style={styles.smallPrimaryButtonText}>{showSourcingForm ? "Cancelar" : "Novo pedido"}</Text>
              </TouchableOpacity>
            </View>

            {showSourcingForm && (
              <View style={styles.formCard}>
                <Field label="Nome do produto" value={sourcingForm.product_name} onChangeText={(v) => setSourcingForm((p) => ({ ...p, product_name: v }))} required />
                <Field label="Quantidade (kg)" value={sourcingForm.quantity} onChangeText={(v) => setSourcingForm((p) => ({ ...p, quantity: v }))} keyboardType="default" required />
                <Field label="Data de entrega (AAAA-MM-DD)" value={sourcingForm.delivery_date} onChangeText={(v) => setSourcingForm((p) => ({ ...p, delivery_date: v }))} required />
                <Field label="Descrição" value={sourcingForm.description} onChangeText={(v) => setSourcingForm((p) => ({ ...p, description: v }))} />
                <TouchableOpacity
                  style={[styles.primaryButton, submittingSourcing && { opacity: 0.6 }]}
                  onPress={submitSourcingRequest}
                  disabled={submittingSourcing}
                >
                  {submittingSourcing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Enviar pedido</Text>}
                </TouchableOpacity>
              </View>
            )}

            {sourcingRequests.length === 0 ? (
              <EmptyState icon="search-outline" message="Ainda não fizeste pedidos de sourcing" />
            ) : (
              <View style={{ gap: 9 }}>
                {sourcingRequests.map((r) => (
                  <View key={r.id} style={styles.listCard}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.listCardTitle}>{r.product_name}</Text>
                        <StatusPill status={r.status} />
                      </View>
                      <Text style={styles.listCardSub}>{r.quantity} kg · entrega {new Date(r.delivery_date).toLocaleDateString("pt-AO")}</Text>
                    </View>
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
            <View style={{ gap: 9 }}>
              {receivedOrders.map((o) => (
                <View key={o.id} style={styles.listCard}>
                  <View style={[styles.listCardStripe, { backgroundColor: o.status === "pending" ? COLORS.gold : o.status === "accepted" ? COLORS.g500 : COLORS.danger }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.listCardTitle}>{o.product?.product_type || "Produto"}</Text>
                      <StatusPill status={o.status} />
                    </View>
                    <Text style={styles.listCardSub}>{o.buyer?.full_name || "Comprador"} · {o.buyer?.phone || "sem telefone"}</Text>
                    <Text style={styles.listCardMeta}>{o.location} · {formatDate(o.created_at)}</Text>
                    <View style={styles.rowBetween}>
                      <Text style={styles.listCardPrice}>{o.quantity.toLocaleString()} kg</Text>
                      <Text style={styles.listCardPrice}>{((o.product?.price || 0) * o.quantity).toLocaleString()} Kz</Text>
                    </View>

                    <View style={styles.orderActions}>
                      {o.status === "pending" && (
                        <>
                          <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.g50 }]} onPress={() => acceptOrder(o.id)}>
                            <Ionicons name="checkmark" size={14} color={COLORS.g600} />
                            <Text style={[styles.smallActionText, { color: COLORS.g600 }]}>Aceitar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.dangerSoft }]} onPress={() => rejectOrder(o.id)}>
                            <Ionicons name="close" size={14} color={COLORS.danger} />
                            <Text style={[styles.smallActionText, { color: COLORS.danger }]}>Rejeitar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: COLORS.blueSoft }]} onPress={() => contactBuyer(o)}>
                        <Ionicons name="chatbubble-outline" size={13} color={COLORS.blue} />
                        <Text style={[styles.smallActionText, { color: COLORS.blue }]}>Contactar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        )}

        {/* INDICAÇÕES */}
        {activeTab === "referrals" && isAgente && (
          <View style={{ gap: 14 }}>
            <StatsStrip items={[
              { value: agentStats.totalReferrals, label: "Indicados", color: roleAccent },
              { value: agentStats.totalPoints, label: "Pontos", color: COLORS.gold },
            ]} />

            {agentStats.recentReferrals.length === 0 ? (
              <EmptyState icon="people-outline" message="Ainda não tens indicações" sub="Partilha o teu código para começares a ganhar pontos." />
            ) : (
              <View style={{ gap: 9 }}>
                {agentStats.recentReferrals.map((r: any, i: number) => (
                  <View key={`${r.user_name}-${i}`} style={styles.listCard}>
                    <View style={styles.referralAvatar}>
                      <Ionicons name="person" size={14} color={COLORS.g600} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
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
            )}
          </View>
        )}

        {/* ESTATÍSTICAS */}
        {activeTab === "statistics" && (
          <View style={styles.statsCard}>
            <View style={styles.statsCardHeader}>
              <Ionicons name="trending-up-outline" size={16} color={roleAccent} />
              <Text style={styles.statsCardTitle}>Resumo de desempenho</Text>
            </View>

            {(isAgente
              ? [
                  { label: "Total de indicações", val: agentStats.totalReferrals, color: COLORS.g600 },
                  { label: "Pontos acumulados", val: agentStats.totalPoints, color: COLORS.gold },
                ]
              : isComprador
              ? [
                  { label: "Fichas criadas", val: fichasRecebimento.length, color: COLORS.g600 },
                  { label: "Compras concluídas", val: buyerStats.completedOrders, color: COLORS.g600 },
                  { label: "Favoritos", val: buyerStats.favoriteProducts, color: COLORS.gold },
                ]
              : [
                  { label: "Total de produtos", val: userProducts.length, color: COLORS.text },
                  { label: "Produtos activos", val: activeProducts, color: COLORS.g600 },
                  { label: "Total de comentários", val: totalComments, color: COLORS.g600 },
                  { label: "Total de gostos", val: totalLikes, color: COLORS.gold },
                ]
            ).map((row, i, arr) => (
              <View key={row.label} style={[styles.statsRowItem, i < arr.length - 1 && styles.statsRowBorder]}>
                <Text style={styles.statsRowLabel}>{row.label}</Text>
                <Text style={[styles.statsRowValue, { color: row.color }]}>{row.val.toLocaleString()}</Text>
              </View>
            ))}

            {isAgente && (
              <View style={styles.statsNote}>
                <Text style={styles.statsNoteText}>Cada utilizador indicado vale pontos que podes trocar por benefícios na plataforma.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DEFINIÇÕES */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.settingsOverlay} onPress={() => setSettingsOpen(false)}>
          <Pressable style={styles.settingsCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.settingsHeader}>
              <Ionicons name="settings-outline" size={17} color={COLORS.g600} />
              <Text style={styles.settingsTitle}>Definições</Text>
            </View>

            <TouchableOpacity style={styles.settingsRow} onPress={() => { setSettingsOpen(false); router.push("/notificacoes"); }}>
              <Ionicons name="notifications-outline" size={16} color={COLORS.mid} />
              <Text style={styles.settingsRowText}>Notificações</Text>
              <Ionicons name="chevron-forward" size={15} color={COLORS.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsRow} onPress={() => { setSettingsOpen(false); router.push("/seguranca"); }}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.mid} />
              <Text style={styles.settingsRowText}>Segurança e privacidade</Text>
              <Ionicons name="chevron-forward" size={15} color={COLORS.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsCloseButton} onPress={() => setSettingsOpen(false)}>
              <Text style={styles.settingsCloseText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  loadingScreen: { flex: 1, backgroundColor: COLORS.canvas, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  loadingText: { fontSize: 13, color: COLORS.muted },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },

  memberCard: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", marginBottom: 12 },
  memberStripe: { width: 5 },

  memberHead: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 0 },
  avatarWrap: { position: "relative" },
  avatar: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  avatarEdit: { position: "absolute", bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  memberName: { fontSize: 17, fontWeight: "800", color: COLORS.text, flexShrink: 1 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 12, color: COLORS.muted, fontWeight: "600", textTransform: "capitalize" },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginHorizontal: 16 },
  infoValue: { fontSize: 12.5, color: COLORS.mid, fontWeight: "500", flex: 1 },

  memberActions: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12 },
  editButton: { flex: 1, height: 38, borderRadius: 11, backgroundColor: COLORS.g50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  editButtonText: { fontSize: 12, fontWeight: "700", color: COLORS.g600 },
  shareButton: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },

  memberFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.border, borderStyle: "dashed", marginTop: 14, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: COLORS.canvas },
  memberFooterLabel: { fontSize: 10, color: COLORS.faint, fontWeight: "600" },
  memberFooterCode: { fontSize: 11.5, color: COLORS.mid, fontWeight: "700", letterSpacing: 0.5 },

  statsStrip: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", marginBottom: 12 },
  statsCell: { flex: 1, paddingVertical: 15, alignItems: "center" },
  statsCellDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  statsValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  statsLabel: { fontSize: 10, color: COLORS.faint, fontWeight: "600", marginTop: 4, textAlign: "center" },

  agentCodeCard: { borderRadius: RADIUS.lg, padding: 13, marginBottom: 12 },
  agentCodeLabel: { fontSize: 11, color: COLORS.muted, fontWeight: "600" },
  agentCodeValue: { fontSize: 18, fontWeight: "800", letterSpacing: 1, marginTop: 2 },

  tabsRow: { marginBottom: 16 },
  tabPillWrap: { marginRight: 20 },
  tabPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabPillText: { fontSize: 12.5, fontWeight: "600", color: COLORS.muted },
  tabBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  tabBadgeText: { fontSize: 9, fontWeight: "800", color: "#FFFFFF" },

  listCard: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 13, overflow: "hidden" },
  listCardStripe: { width: 4, borderRadius: 2, marginRight: 10 },
  listCardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  listCardSub: { fontSize: 11.5, color: COLORS.muted, marginTop: 3 },
  listCardMeta: { fontSize: 10.5, color: COLORS.faint, marginTop: 3 },
  listCardPrice: { fontSize: 13, fontWeight: "800", color: COLORS.g600, marginTop: 6 },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  interactionsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  interactionsText: { fontSize: 10.5, color: COLORS.faint, marginRight: 6 },

  removeLink: { marginTop: 8 },
  removeLinkText: { fontSize: 11, color: COLORS.danger, fontWeight: "700" },

  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontWeight: "700" },

  iconBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  emptyState: { alignItems: "center", padding: 36, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed" },
  emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.g50, alignItems: "center", justifyContent: "center", marginBottom: 11 },
  emptyMessage: { fontSize: 14, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  emptySub: { fontSize: 11.5, color: COLORS.faint, marginTop: 6, textAlign: "center", lineHeight: 17 },

  blockTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  blockSubtitle: { fontSize: 11.5, color: COLORS.faint, marginTop: 2 },

  smallPrimaryButton: { height: 34, paddingHorizontal: 13, borderRadius: 10, backgroundColor: COLORS.g500, alignItems: "center", justifyContent: "center" },
  smallPrimaryButtonText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  formCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 12 },
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: COLORS.text },
  fieldRequired: { fontSize: 10, fontWeight: "500", color: COLORS.g600 },
  fieldInput: { height: 42, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, fontSize: 13, color: COLORS.text, backgroundColor: COLORS.canvas },

  primaryButton: { height: 46, borderRadius: 12, backgroundColor: COLORS.g500, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  outlineButton: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  outlineButtonText: { fontSize: 13, fontWeight: "700", color: COLORS.mid },

  orderActions: { flexDirection: "row", gap: 8, marginTop: 11 },
  smallActionBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 9 },
  smallActionText: { fontSize: 11, fontWeight: "700" },

  referralAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.g50, alignItems: "center", justifyContent: "center" },
  referralPoints: { flexDirection: "row", alignItems: "center", gap: 4 },
  referralPointsText: { fontSize: 12, fontWeight: "800", color: COLORS.gold },

  statsCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  statsCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  statsCardTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  statsRowItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  statsRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statsRowLabel: { fontSize: 12.5, color: COLORS.muted, fontWeight: "500" },
  statsRowValue: { fontSize: 18, fontWeight: "800" },
  statsNote: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: COLORS.g50 },
  statsNoteText: { fontSize: 10.5, color: COLORS.faint, lineHeight: 16 },

  settingsOverlay: { flex: 1, backgroundColor: "rgba(15,20,17,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  settingsCard: { width: "100%", maxWidth: 380, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 18 },
  settingsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  settingsTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsRowText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: "600" },
  settingsCloseButton: { marginTop: 14, height: 42, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  settingsCloseText: { fontSize: 12.5, fontWeight: "700", color: COLORS.mid },
});