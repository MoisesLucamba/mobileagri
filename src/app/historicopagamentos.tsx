import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUserRole } from "../context/RoleContext";
import { supabase } from "../lib/supabase";

type AppRole = "comprador" | "agricultor" | "agente" | "motorista";
type HistoryKind = "purchase" | "sale" | "delivery" | "payment";
type FilterKey = "all" | "activity" | "payments";
type RawRow = Record<string, any>;

type HistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  subtitle: string;
  amount?: number;
  status: string;
  createdAt?: string;
  isDemo?: boolean;
};

// Mesma paleta do ProductCard
const COLORS = {
  primary: "#2E8B4F",
  primaryDark: "#25703F",
  tint: "#E9F5EC",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  line: "#E8ECE6",
  field: "#F4F6F2",
  background: "#F9FAF8",
  white: "#FFFFFF",
  gold: "#B9741A",
  goldSoft: "#FBEBD3",
  blue: "#2F6DB5",
  blueSoft: "#E8EFF8",
  orange: "#DB6B1F",
  orangeSoft: "#F8EEE5",
  danger: "#DD5138",
  dangerSoft: "#FBEAE6",
};

const ROLE_INFO: Record<
  AppRole,
  { label: string; activity: string; icon: keyof typeof Ionicons.glyphMap; accent: string; soft: string }
> = {
  comprador: {
    label: "Comprador",
    activity: "Compras",
    icon: "cart-outline",
    accent: COLORS.blue,
    soft: COLORS.blueSoft,
  },
  agricultor: {
    label: "Agricultor",
    activity: "Vendas",
    icon: "leaf-outline",
    accent: COLORS.primary,
    soft: COLORS.tint,
  },
  agente: {
    label: "Agente",
    activity: "Vendas",
    icon: "briefcase-outline",
    accent: COLORS.gold,
    soft: COLORS.goldSoft,
  },
  motorista: {
    label: "Motorista",
    activity: "Entregas",
    icon: "car-outline",
    accent: COLORS.orange,
    soft: COLORS.orangeSoft,
  },
};

function normalizeRole(value: unknown): AppRole | null {
  const role = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, AppRole> = {
    comprador: "comprador",
    buyer: "comprador",
    agricultor: "agricultor",
    farmer: "agricultor",
    agente: "agente",
    agent: "agente",
    motorista: "motorista",
    driver: "motorista",
  };
  return aliases[role] ?? null;
}

function missingSchema(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return (
    ["42703", "42P01", "PGRST204", "PGRST205"].includes(code) ||
    /column .* does not exist|relation .* does not exist|could not find the table|schema cache/i.test(message)
  );
}

/**
 * Read the confirmed schema: orders/pre-orders, wallet ledger/payment intents,
 * commissions, freight loads, and delivery tracking. Missing optional schema
 * fields are tolerated; permission and network errors are surfaced to the loader.
 */
async function selectByOwner(table: string, column: string, userId: string, fields = "*"): Promise<RawRow[] | null> {
  let query: any = (supabase.from(table as any) as any).select(fields).eq(column, userId);
  let result = await query.order("created_at", { ascending: false });

  if (result.error && /created_at/i.test(String(result.error.message ?? ""))) {
    query = (supabase.from(table as any) as any).select(fields).eq(column, userId);
    result = await query;
  }

  if (result.error) {
    if (missingSchema(result.error)) return null;
    console.warn(`[History] ${table}.${column}:`, result.error.message);
    throw result.error;
  }
  return (result.data ?? []) as RawRow[];
}

async function selectFirstMatchingOwner(
  table: string,
  columns: string[],
  userId: string,
  fields = "*",
): Promise<RawRow[]> {
  for (const column of columns) {
    const rows = await selectByOwner(table, column, userId, fields);
    if (rows?.length) return rows;
  }
  return [];
}

async function selectProductsForOwner(userId: string): Promise<RawRow[]> {
  return (
    (await selectByOwner(
      "products",
      "user_id",
      userId,
      "id,product_type,price,farmer_name,category",
    )) ?? []
  );
}

async function selectByIds(table: string, column: string, ids: string[], fields = "*"): Promise<RawRow[]> {
  if (!ids.length) return [];
  const result = await (supabase.from(table as any) as any)
    .select(fields)
    .in(column, ids);
  if (result.error) {
    if (missingSchema(result.error)) return [];
    console.warn(`[History] ${table}.${column}:`, result.error.message);
    throw result.error;
  }
  return (result.data ?? []) as RawRow[];
}

async function loadRealRows(userId: string, role: AppRole) {
  let activityRows: RawRow[] = [];
  let ownedProducts: RawRow[] = [];
  let commissionRows: RawRow[] = [];

  if (role === "comprador") {
    const [orders, preOrders] = await Promise.all([
      selectFirstMatchingOwner("orders", ["user_id"], userId, "id,pre_order_id,product_id,user_id,quantity,location,total_price,transport_fee,status,created_at,updated_at"),
      selectFirstMatchingOwner("pre_orders", ["user_id"], userId, "id,product_id,user_id,quantity,location,status,created_at,updated_at"),
    ]);
    const linkedPreOrderIds = new Set(orders.map((order) => String(order.pre_order_id ?? "")).filter(Boolean));
    activityRows = [...orders, ...preOrders.filter((order) => !linkedPreOrderIds.has(String(order.id)))];
  } else if (role === "agricultor" || role === "agente") {
    ownedProducts = await selectProductsForOwner(userId);
    const productIds = ownedProducts.map((product) => String(product.id)).filter(Boolean);
    if (productIds.length) {
      const [orders, preOrders] = await Promise.all([
        selectByIds("orders", "product_id", productIds, "id,pre_order_id,product_id,user_id,quantity,location,total_price,transport_fee,status,created_at,updated_at"),
        selectByIds("pre_orders", "product_id", productIds, "id,product_id,user_id,quantity,location,status,created_at,updated_at"),
      ]);
      const linkedPreOrderIds = new Set(orders.map((order) => String(order.pre_order_id ?? "")).filter(Boolean));
      activityRows = [...orders, ...preOrders.filter((order) => !linkedPreOrderIds.has(String(order.id)))];
    }
    if (role === "agente") {
      commissionRows = await selectFirstMatchingOwner("commissions", ["user_id"], userId, "id,transaction_id,user_id,amount,percentage,type,created_at");
    }
  } else {
    const [freightLoads, trackingRows] = await Promise.all([
      selectFirstMatchingOwner("freight_loads", ["driver_id"], userId, "id,driver_id,order_id,product_id,product_name,weight_kg,origin_label,destination_label,offered_price,currency,status,created_at,updated_at,delivered_at"),
      selectFirstMatchingOwner("delivery_tracking", ["assistant_id"], userId, "id,order_id,assistant_id,status,pickup_at,in_transit_at,delivered_at,created_at,updated_at"),
    ]);
    const orderIds = Array.from(new Set(trackingRows.map((row) => String(row.order_id ?? "")).filter(Boolean)));
    const trackedOrders = await selectByIds("orders", "id", orderIds, "id,product_id,quantity,location");
    const trackedOrderMap = new Map(trackedOrders.map((order) => [String(order.id), order]));
    const freightOrderIds = new Set(freightLoads.map((row) => String(row.order_id ?? "")).filter(Boolean));
    const trackingActivities = trackingRows
      .filter((row) => !freightOrderIds.has(String(row.order_id ?? "")))
      .map((row) => {
        const order = trackedOrderMap.get(String(row.order_id ?? ""));
        return {
          ...row,
          id: `tracking-${row.id}`,
          product_id: order?.product_id,
          quantity: order?.quantity,
          location: order?.location,
          title: "Entrega de encomenda",
          route: order?.location ? `Entrega · ${order.location}` : "Entrega de encomenda",
          created_at: row.delivered_at ?? row.in_transit_at ?? row.pickup_at ?? row.created_at,
        };
      });
    activityRows = [...freightLoads, ...trackingActivities];
  }

  const walletRows = await selectFirstMatchingOwner("wallets", ["user_id"], userId, "id");
  const walletIds = walletRows.map((wallet) => String(wallet.id)).filter(Boolean);
  const [transactionRows, paymentIntents] = await Promise.all([
    selectByIds("transactions", "wallet_id", walletIds, "id,wallet_id,type,status,amount,description,created_at,completed_at,payment_intent_id"),
    selectFirstMatchingOwner("payment_intents", ["user_id"], userId, "id,user_id,wallet_id,provider_id,provider_reference,amount,currency,status,created_at,completed_at,expires_at"),
  ]);
  const linkedIntentIds = new Set(
    transactionRows.map((row) => String(row.payment_intent_id ?? "")).filter(Boolean),
  );
  const paymentRows = [
    ...transactionRows,
    ...paymentIntents.filter((intent) => !linkedIntentIds.has(String(intent.id))),
    ...commissionRows
      .filter((commission) => !transactionRows.some((transaction) => String(transaction.id) === String(commission.transaction_id)))
      .map((commission) => ({ ...commission, description: "Comissão recebida", status: "completed", type: commission.type ?? "commission" })),
  ];

  const productIds = Array.from(
    new Set(activityRows.map((row) => String(row.product_id ?? "")).filter(Boolean)),
  );
  const productsForItems = productIds.length
    ? await selectByIds("products", "id", productIds, "id,product_type,price,farmer_name,category")
    : [];
  const productMap = new Map(
    [...ownedProducts, ...productsForItems].map((product) => [String(product.id), product]),
  );

  return { activityRows, paymentRows, productMap };
}

function amountFrom(row: RawRow, product?: RawRow): number | undefined {
  const direct = row.total_amount ?? row.total_price ?? row.offered_price ?? row.total ?? row.amount ?? row.value;
  if (direct !== undefined && direct !== null && direct !== "") {
    const value = Number(direct);
    if (Number.isFinite(value)) return value;
  }
  const quantity = Number(row.quantity ?? row.qty ?? 0);
  const price = Number(row.unit_price ?? row.price ?? product?.price ?? 0);
  const calculated = quantity * price;
  return Number.isFinite(calculated) && calculated > 0 ? calculated : undefined;
}

function roleActivityKind(role: AppRole): HistoryKind {
  if (role === "comprador") return "purchase";
  if (role === "motorista") return "delivery";
  return "sale";
}

function mapActivityRows(rows: RawRow[], role: AppRole, productMap: Map<string, RawRow>): HistoryItem[] {
  return rows.map((row, index) => {
    const product = productMap.get(String(row.product_id ?? ""));
    const quantity = Number(row.quantity ?? row.qty ?? row.weight_kg ?? 0);
    const location = row.location ?? row.delivery_location ?? row.destination_label ?? row.destination ?? row.origin_label ?? "";
    const routeStart = row.origin_label ?? row.origin ?? row.pickup_location ?? "";
    const routeEnd = row.destination_label ?? row.destination ?? row.delivery_location ?? "";
    const route = routeStart && routeEnd ? `${routeStart} → ${routeEnd}` : "";
    const productTitle =
      row.product_name ?? row.title ?? product?.product_type ?? product?.name ?? product?.title;
    const title = role === "motorista"
      ? (row.title ?? (row.product_name ? `Transporte de ${row.product_name}` : row.route ?? route ?? "Entrega"))
      : (productTitle ?? (role === "comprador" ? "Compra de produto" : "Venda de produto"));
    const details = [
      quantity > 0 ? `${quantity.toLocaleString("pt-AO")} ${row.unit ?? product?.unit ?? "kg"}` : "",
      role === "motorista" ? (route || location) : (row.farmer_name ?? row.seller_name ?? location),
    ].filter(Boolean);

    return {
      id: String(row.id ?? `${role}-activity-${index}`),
      kind: roleActivityKind(role),
      title: String(title),
      subtitle: details.join(" · ") || (role === "motorista" ? "Serviço de entrega" : "Registo de encomenda"),
      amount: amountFrom(row, product),
      status: String(row.payment_status ?? row.status ?? "Pendente"),
      createdAt: row.delivered_at ?? row.completed_at ?? row.created_at ?? row.updated_at,
    };
  });
}

function providerName(value?: string) {
  if (!value) return "";
  const provider = value.trim().toLowerCase();
  if (provider.includes("multicaixa")) return "Multicaixa Express";
  if (provider.includes("unitel")) return "Unitel Money";
  return value.replace(/[_-]+/g, " ");
}

function transactionName(value?: string) {
  if (!value) return "Movimento da carteira";
  const type = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    purchase: "Compra",
    sale: "Venda",
    deposit: "Depósito",
    withdrawal: "Levantamento",
    commission: "Comissão",
    refund: "Reembolso",
    payment: "Pagamento",
    transfer: "Transferência",
  };
  return labels[type] ?? value.replace(/[_-]+/g, " ");
}

function mapPaymentRows(rows: RawRow[]): HistoryItem[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `payment-${index}`),
    kind: "payment",
    title: String(row.description ?? row.title ?? (row.provider_id ? `Pagamento via ${providerName(row.provider_id)}` : transactionName(row.type))),
    subtitle: String(row.provider_id ? providerName(row.provider_id) : transactionName(row.type)),
    amount: amountFrom(row),
    status: String(row.status ?? row.payment_status ?? "Pendente"),
    createdAt: row.completed_at ?? row.created_at ?? row.updated_at,
  }));
}

function makeDemoHistory(role: AppRole): HistoryItem[] {
  const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const demos: Record<AppRole, HistoryItem[]> = {
    comprador: [
      { id: "demo-buyer-1", kind: "purchase", title: "Tomate fresco", subtitle: "12 kg · Luanda", amount: 18000, status: "Concluído", createdAt: ago(2), isDemo: true },
      { id: "demo-buyer-2", kind: "payment", title: "Pagamento da compra", subtitle: "Multicaixa Express", amount: 18000, status: "Pago", createdAt: ago(2), isDemo: true },
      { id: "demo-buyer-3", kind: "purchase", title: "Milho amarelo", subtitle: "25 kg · Huambo", amount: 27500, status: "Pendente", createdAt: ago(7), isDemo: true },
    ],
    agricultor: [
      { id: "demo-farmer-1", kind: "sale", title: "Venda de milho", subtitle: "80 kg · Comprador local", amount: 96000, status: "Concluído", createdAt: ago(1), isDemo: true },
      { id: "demo-farmer-2", kind: "payment", title: "Pagamento recebido", subtitle: "Venda de milho", amount: 96000, status: "Pago", createdAt: ago(1), isDemo: true },
      { id: "demo-farmer-3", kind: "sale", title: "Venda de feijão", subtitle: "35 kg · Malanje", amount: 52500, status: "Pendente", createdAt: ago(5), isDemo: true },
    ],
    agente: [
      { id: "demo-agent-1", kind: "sale", title: "Encomenda coordenada", subtitle: "Cesta de produtos · Bengo", amount: 74000, status: "Concluído", createdAt: ago(2), isDemo: true },
      { id: "demo-agent-2", kind: "payment", title: "Comissão recebida", subtitle: "Serviço de intermediação", amount: 7400, status: "Pago", createdAt: ago(2), isDemo: true },
      { id: "demo-agent-3", kind: "sale", title: "Encomenda em preparação", subtitle: "Produtos frescos · Luanda", amount: 42000, status: "Pendente", createdAt: ago(6), isDemo: true },
    ],
    motorista: [
      { id: "demo-driver-1", kind: "delivery", title: "Entrega concluída", subtitle: "Luanda · 18 km", amount: 8500, status: "Concluído", createdAt: ago(1), isDemo: true },
      { id: "demo-driver-2", kind: "payment", title: "Pagamento de entrega", subtitle: "Carteira Codego", amount: 8500, status: "Pago", createdAt: ago(1), isDemo: true },
      { id: "demo-driver-3", kind: "delivery", title: "Entrega agendada", subtitle: "Viana · 12 km", amount: 6000, status: "Pendente", createdAt: ago(4), isDemo: true },
    ],
  };
  return demos[role];
}

function formatMoney(amount?: number) {
  if (amount === undefined || !Number.isFinite(amount)) return "—";
  return `${Math.round(amount).toLocaleString("pt-AO")} Kz`;
}

function formatDate(value?: string) {
  if (!value) return "Data não indicada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não indicada";
  return date.toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
}

function readableStatus(value: string) {
  const status = value.trim().toLowerCase();
  if (["paid", "completed", "complete", "delivered", "success", "succeeded", "concluido", "concluído", "pago"].includes(status)) return "Concluído";
  if (["cancelled", "canceled", "cancelado", "failed", "falhou"].includes(status)) return "Cancelado";
  if (["refunded", "reembolsado"].includes(status)) return "Reembolsado";
  if (["expired", "expirado"].includes(status)) return "Expirado";
  if (["processing", "in_progress", "in_transit", "pickup", "em andamento"].includes(status)) return "Em curso";
  if (["pending", "created", "assigned", "agendado", "pendente", "awaiting_payment"].includes(status)) return "Pendente";
  return value || "Pendente";
}

function itemIcon(kind: HistoryKind): keyof typeof Ionicons.glyphMap {
  if (kind === "purchase") return "cart-outline";
  if (kind === "sale") return "leaf-outline";
  if (kind === "delivery") return "car-outline";
  return "card-outline";
}

export default function HistoryPurchasesPaymentsScreen() {
  const router = useRouter();
  const { role: contextRole, loading: roleLoading } = useUserRole();
  const role = normalizeRole(contextRole);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [notice, setNotice] = useState("");

  const loadHistory = useCallback(async (refresh = false) => {
    if (!role) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const userId = data.user?.id;

      if (!userId) {
        setItems(makeDemoHistory(role));
        setIsDemo(true);
        setNotice("Exemplos de demonstração. Entra na conta para consultar o teu histórico.");
        return;
      }

      const { activityRows, paymentRows, productMap } = await loadRealRows(userId, role);
      const realItems = [
        ...mapActivityRows(activityRows, role, productMap),
        ...mapPaymentRows(paymentRows),
      ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

      if (realItems.length > 0) {
        setItems(realItems);
        setIsDemo(false);
        setNotice("");
      } else {
        setItems(makeDemoHistory(role));
        setIsDemo(true);
        setNotice("Ainda não há registos reais. Estes exemplos serão substituídos assim que surgir o primeiro movimento.");
      }
    } catch (error: any) {
      console.warn("[History] Não foi possível carregar o histórico:", error?.message ?? error);
      setItems(makeDemoHistory(role));
      setIsDemo(true);
      setNotice("Não foi possível consultar os dados agora. Os exemplos estão identificados como demonstração.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    if (!roleLoading && role) void loadHistory();
  }, [role, roleLoading, loadHistory]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  };

  const visibleItems = useMemo(() => {
    if (filter === "payments") return items.filter((item) => item.kind === "payment");
    if (filter === "activity") return items.filter((item) => item.kind !== "payment");
    return items;
  }, [filter, items]);

  const summaryAmount = useMemo(() => {
    const activity = items.filter((item) => item.kind !== "payment" && item.amount !== undefined);
    const source = activity.length ? activity : items.filter((item) => item.kind === "payment");
    return source.reduce((total, item) => total + (item.amount ?? 0), 0);
  }, [items]);

  const roleInfo = role ? ROLE_INFO[role] : null;
  const activityLabel = roleInfo?.activity ?? "Movimentos";
  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Tudo" },
    { key: "activity", label: activityLabel },
    { key: "payments", label: "Pagamentos" },
  ];

  if (roleLoading || (role !== null && loading)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.mutedText}>A preparar o teu histórico...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!role || !roleInfo) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={19} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Histórico</Text>
        </View>
        <View style={styles.loadingState}>
          <View style={styles.emptyIcon}><Ionicons name="person-circle-outline" size={28} color={COLORS.primary} /></View>
          <Text style={styles.emptyTitle}>Perfil sem função</Text>
          <Text style={styles.mutedText}>O histórico está disponível para comprador, agricultor, agente e motorista.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={19} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Histórico</Text>
          <Text style={styles.headerSubtitle}>Compras, vendas e pagamentos</Text>
        </View>
        <Pressable
          onPress={() => void loadHistory(true)}
          style={styles.refreshButton}
          accessibilityRole="button"
          accessibilityLabel="Atualizar histórico"
        >
          {refreshing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh-outline" size={19} color={COLORS.primary} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadHistory(true)} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        <View style={styles.roleRow}>
          <View style={[styles.roleIcon, { backgroundColor: roleInfo.soft }]}>
            <Ionicons name={roleInfo.icon} size={18} color={roleInfo.accent} />
          </View>
          <View style={styles.roleTextBlock}>
            <Text style={styles.roleCaption}>A ver como</Text>
            <Text style={styles.roleName}>{roleInfo.label}</Text>
          </View>
          {isDemo ? (
            <View style={styles.demoBadge}>
              <Ionicons name="flask-outline" size={13} color={COLORS.gold} />
              <Text style={styles.demoBadgeText}>DEMONSTRAÇÃO</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>DADOS REAIS</Text>
            </View>
          )}
        </View>

        {notice ? (
          <View style={[styles.notice, isDemo ? styles.noticeDemo : styles.noticeInfo]}>
            <Ionicons name={isDemo ? "information-circle-outline" : "checkmark-circle-outline"} size={18} color={isDemo ? COLORS.gold : COLORS.primary} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.summaryLabel}>{isDemo ? "Movimento de exemplo" : "Movimento registado"}</Text>
          </View>
          <Text style={styles.summaryAmount}>{formatMoney(summaryAmount)}</Text>
          <Text style={styles.summaryFoot}>{items.length} {items.length === 1 ? "registo" : "registos"} no histórico</Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Os teus movimentos</Text>
            <Text style={styles.sectionSubtitle}>Consulta estados e valores num só lugar.</Text>
          </View>
          <View style={styles.countBadge}><Text style={styles.countText}>{visibleItems.length}</Text></View>
        </View>

        <View style={styles.filterRow}>
          {filters.map((option) => {
            const active = filter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {visibleItems.length ? (
          <View style={styles.list}>
            {visibleItems.map((item) => {
              const isComplete = readableStatus(item.status) === "Concluído";
              const isCancelled = readableStatus(item.status) === "Cancelado";
              return (
                <View key={`${item.kind}-${item.id}`} style={styles.historyCard}>
                  <View style={[styles.itemIcon, item.kind === "payment" ? styles.paymentIcon : styles.activityIcon]}>
                    <Ionicons name={itemIcon(item.kind)} size={19} color={item.kind === "payment" ? COLORS.gold : COLORS.primary} />
                  </View>
                  <View style={styles.itemMain}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                      {item.isDemo ? <Text style={styles.miniDemo}>EXEMPLO</Text> : null}
                    </View>
                    <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
                      <View style={[styles.statusPill, isComplete ? styles.statusComplete : isCancelled ? styles.statusCancelled : styles.statusPending]}>
                        <Text style={[styles.statusText, isComplete ? styles.statusCompleteText : isCancelled ? styles.statusCancelledText : styles.statusPendingText]}>{readableStatus(item.status)}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.itemAmount}>{formatMoney(item.amount)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name={filter === "payments" ? "card-outline" : "receipt-outline"} size={26} color={COLORS.primary} /></View>
            <Text style={styles.emptyTitle}>Ainda sem registos</Text>
            <Text style={styles.emptyBody}>Quando houver um movimento real nesta categoria, ele aparecerá aqui.</Text>
          </View>
        )}

        <Text style={styles.footerNote}>Os dados reais são carregados da tua conta. Os exemplos são apenas demonstrativos.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Cartão plano: borda fina e sombra quase nula, igual ao ProductCard
const FLAT = {
  shadowColor: "#16231C",
  shadowOpacity: 0.04,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: COLORS.background,
  },
  // Mesmo botão do ícone de mapa do ProductCard
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.tint,
    marginRight: 12,
  },
  headerTextBlock: { flex: 1 },
  headerTitle: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  headerSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.tint,
    marginLeft: 10,
  },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 32 },
  roleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  roleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  roleTextBlock: { flex: 1, marginLeft: 10 },
  roleCaption: { color: COLORS.muted, fontSize: 11 },
  roleName: { color: COLORS.text, fontSize: 14, fontWeight: "900", marginTop: 1 },
  demoBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: COLORS.goldSoft },
  demoBadgeText: { color: COLORS.gold, fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: COLORS.tint },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  liveBadgeText: { color: COLORS.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  noticeDemo: { backgroundColor: COLORS.goldSoft },
  noticeInfo: { backgroundColor: COLORS.tint },
  noticeText: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 20,
    ...FLAT,
  },
  summaryTopRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  summaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.tint },
  summaryLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  summaryAmount: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 10 },
  summaryFoot: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  countBadge: { minWidth: 28, height: 24, paddingHorizontal: 7, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.tint },
  countText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: "900" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  filterChipTextActive: { color: COLORS.white },
  list: { gap: 10 },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...FLAT,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  activityIcon: { backgroundColor: COLORS.tint },
  paymentIcon: { backgroundColor: COLORS.goldSoft },
  itemMain: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  itemTitle: { flexShrink: 1, color: COLORS.text, fontSize: 13.5, fontWeight: "900" },
  miniDemo: { color: COLORS.gold, fontSize: 8, fontWeight: "900" },
  itemSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  itemDate: { color: COLORS.faint, fontSize: 10 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusComplete: { backgroundColor: COLORS.tint },
  statusPending: { backgroundColor: COLORS.goldSoft },
  statusCancelled: { backgroundColor: COLORS.dangerSoft },
  statusText: { fontSize: 10, fontWeight: "800" },
  statusCompleteText: { color: COLORS.primaryDark },
  statusPendingText: { color: COLORS.gold },
  statusCancelledText: { color: COLORS.danger },
  itemAmount: { color: COLORS.text, fontSize: 12, fontWeight: "900", textAlign: "right" },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    ...FLAT,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.tint, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900", textAlign: "center" },
  emptyBody: { color: COLORS.muted, fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 6 },
  footerNote: { color: COLORS.faint, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 16 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  mutedText: { color: COLORS.muted, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 8 },
});