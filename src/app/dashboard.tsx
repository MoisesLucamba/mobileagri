import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminOnly from '../components/AdminOnly';
import Icon, { IconName } from '../components/Icon';
import ProcessingScreen from '../components/ProcessingScreen';
import { AgrilinkAd, loadAgrilinkAds } from '../lib/agrilinkAds';
import { supabase } from '../lib/supabase';

const COLORS = {
  primary: '#1F6B3A',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#E8ECE6',
  canvas: '#F6F8F5',
  surface: '#FFFFFF',
  gold: '#D79427',
  blue: '#4776A8',
  orange: '#C56B2D',
  danger: '#B54747',
};

type DashboardTab = 'overview' | 'users' | 'products' | 'orders' | 'notifications' | 'logistics' | 'payments' | 'greenPoints' | 'ads';
type MetricKey = 'users' | 'products' | 'orders' | 'notifications' | 'loads' | 'payments' | 'providers' | 'greenPoints' | 'greenOrders';
type RecentRecord = {
  id: string;
  title: string;
  detail: string;
  created_at: string;
};
type DashboardData = {
  metrics: Record<MetricKey, number | null>;
  roles: { label: 'farmers' | 'agents' | 'buyers' | 'drivers'; count: number | null }[];
  recentUsers: RecentRecord[];
  recentProducts: RecentRecord[];
  recentOrders: RecentRecord[];
  recentNotifications: RecentRecord[];
  recentLoads: RecentRecord[];
  recentPayments: RecentRecord[];
  recentGreenOrders: RecentRecord[];
  ads: AgrilinkAd[];
};

const EMPTY_DATA: DashboardData = {
  metrics: {
    users: null,
    products: null,
    orders: null,
    notifications: null,
    loads: null,
    payments: null,
    providers: null,
    greenPoints: null,
    greenOrders: null,
  },
  roles: [],
  recentUsers: [],
  recentProducts: [],
  recentOrders: [],
  recentNotifications: [],
  recentLoads: [],
  recentPayments: [],
  recentGreenOrders: [],
  ads: [],
};

const METRIC_INFO: {
  key: MetricKey;
  title: string;
  icon: IconName;
  color: string;
  subtitle: string;
}[] = [
  { key: 'users', title: 'users', icon: 'users', color: COLORS.primary, subtitle: 'registeredAccounts' },
  { key: 'products', title: 'activeProducts', icon: 'package', color: COLORS.blue, subtitle: 'availableListings' },
  { key: 'orders', title: 'orders', icon: 'cart', color: COLORS.orange, subtitle: 'orderForms' },
  { key: 'notifications', title: 'notifications', icon: 'bell', color: COLORS.gold, subtitle: 'platformNotifications' },
  { key: 'loads', title: 'loads', icon: 'truck', color: COLORS.gold, subtitle: 'registeredDeliveries' },
  { key: 'payments', title: 'pendingPayments', icon: 'card', color: COLORS.danger, subtitle: 'awaitingConfirmation' },
  { key: 'providers', title: 'paymentMethods', icon: 'check-circle', color: COLORS.primary, subtitle: 'enabledMethods' },
  { key: 'greenPoints', title: 'greenPoints', icon: 'pin', color: COLORS.primary, subtitle: 'activeGreenPoints' },
  { key: 'greenOrders', title: 'greenOrders', icon: 'cart', color: COLORS.orange, subtitle: 'greenPointOrders' },
];

const DASHBOARD_TABS: { key: DashboardTab; icon: IconName }[] = [
  { key: 'overview', icon: 'grid' },
  { key: 'users', icon: 'users' },
  { key: 'products', icon: 'package' },
  { key: 'orders', icon: 'cart' },
  { key: 'notifications', icon: 'bell' },
  { key: 'logistics', icon: 'truck' },
  { key: 'payments', icon: 'card' },
  { key: 'greenPoints', icon: 'sprout' },
  { key: 'ads', icon: 'image' },
];

function formatCount(value: number | null | undefined, locale: string) {
  return value == null ? '—' : value.toLocaleString(locale);
}

function formatDate(value: string, locale: string, unavailable: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? unavailable
    : date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function DashboardContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const refresh = useCallback(async () => {
    const nextErrors: string[] = [];
    const count = async (
      label: string,
      request: PromiseLike<{ count: number | null; error: { message: string } | null }>,
    ) => {
      try {
        const result = await request;
        if (result.error) throw result.error;
        return result.count ?? 0;
      } catch (loadError) {
        console.error(`[Dashboard] Falha ao carregar ${label}:`, loadError);
        nextErrors.push(label);
        return null;
      }
    };

    const records = async (
      label: string,
      request: PromiseLike<{ data: any[] | null; error: { message: string } | null }>,
      titleOf: (item: any) => string,
      detailOf: (item: any) => string,
    ): Promise<RecentRecord[]> => {
      try {
        const result = await request;
        if (result.error) throw result.error;
        return (result.data ?? []).map((item) => ({
          id: String(item.id),
          title: titleOf(item) || t('dashboard.noName'),
          detail: detailOf(item) || '—',
          created_at: String(item.created_at ?? item.pickup_date ?? ''),
        }));
      } catch (loadError) {
        console.error(`[Dashboard] Falha ao carregar ${label}:`, loadError);
        nextErrors.push(label);
        return [];
      }
    };

    try {
      const [
        users,
        products,
        orders,
        notifications,
        loads,
        payments,
        providers,
        greenPoints,
        greenOrders,
        farmers,
        agents,
        buyers,
        drivers,
        recentUsers,
        recentProducts,
        recentOrders,
        recentNotifications,
        recentLoads,
        recentPayments,
        recentGreenOrders,
        ads,
      ] = await Promise.all([
        count('utilizadores', supabase.from('users').select('id', { count: 'exact', head: true })),
        count('produtos', supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active')),
        count('encomendas', supabase.from('pre_orders').select('id', { count: 'exact', head: true })),
        count('notificações', supabase.from('notifications').select('id', { count: 'exact', head: true })),
        count('cargas', supabase.from('freight_loads').select('id', { count: 'exact', head: true })),
        count(
          'pagamentos pendentes',
          supabase.from('payment_intents').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing', 'created']),
        ),
        count('métodos de pagamento ativos', supabase.from('payment_providers').select('id', { count: 'exact', head: true }).eq('enabled', true)),
        count('Pontos Verdes ativos', supabase.from('green_points').select('id', { count: 'exact', head: true }).eq('is_active', true)),
        count('pedidos nos Pontos Verdes', supabase.from('green_point_orders').select('id', { count: 'exact', head: true })),
        count('agricultores', supabase.from('users').select('id', { count: 'exact', head: true }).eq('user_type', 'agricultor')),
        count('agentes', supabase.from('users').select('id', { count: 'exact', head: true }).eq('user_type', 'agente')),
        count('compradores', supabase.from('users').select('id', { count: 'exact', head: true }).eq('user_type', 'comprador')),
        count('motoristas', supabase.from('users').select('id', { count: 'exact', head: true }).eq('user_type', 'motorista')),
        records(
          'utilizadores recentes',
          supabase.from('users').select('id, full_name, user_type, created_at').order('created_at', { ascending: false }).limit(5),
          (item) => item.full_name,
          (item) => item.user_type,
        ),
        records(
          'produtos recentes',
          supabase.from('products').select('id, product_type, farmer_name, created_at').order('created_at', { ascending: false }).limit(5),
          (item) => item.product_type,
          (item) => item.farmer_name,
        ),
        records(
          'encomendas recentes',
          supabase.from('pre_orders').select('id, product_id, quantity, status, created_at').order('created_at', { ascending: false }).limit(5),
          (item) => `Encomenda ${String(item.id).slice(0, 8)}`,
          (item) => `${item.status} · ${item.quantity} unidades · produto ${String(item.product_id).slice(0, 8)}`,
        ),
        records(
          'notificações recentes',
          supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10),
          (item) => item.title || item.subject || item.type || `Notificação ${String(item.id).slice(0, 8)}`,
          (item) => item.message || item.body || item.content || item.status || '',
        ),
        records(
          'cargas recentes',
          supabase.from('freight_loads').select('id, product_name, origin_label, destination_label, status, pickup_date').order('pickup_date', { ascending: false, nullsFirst: false }).limit(5),
          (item) => item.product_name,
          (item) => `${item.origin_label} → ${item.destination_label} · ${item.status}`,
        ),
        records(
          'pagamentos recentes',
          supabase.from('payment_intents').select('id, status, amount, provider_id, created_at').order('created_at', { ascending: false }).limit(10),
          (item) => `Pagamento ${String(item.id).slice(0, 8)}`,
          (item) => `${item.status} · ${item.amount ?? '—'} · ${item.provider_id ?? ''}`,
        ),
        records(
          'pedidos dos Pontos Verdes',
          supabase.from('green_point_orders').select('id, point_id, buyer_id, pickup_date, status, total_amount, created_at, green_points(name)').order('created_at', { ascending: false }).limit(10),
          (item) => `Pedido ${String(item.id).slice(0, 8)}`,
          (item) => `${item.status} · ${item.pickup_date} · ${item.total_amount} Kz · ${item.green_points?.name ?? String(item.point_id).slice(0, 8)}`,
        ),
        (async () => {
          try {
            return await loadAgrilinkAds();
          } catch (loadError) {
            console.error('[Dashboard] Falha ao carregar anúncios:', loadError);
            nextErrors.push('anúncios');
            return [] as AgrilinkAd[];
          }
        })(),
      ]);

      setData({
        metrics: { users, products, orders, notifications, loads, payments, providers, greenPoints, greenOrders },
        roles: [
          { label: 'farmers', count: farmers },
          { label: 'agents', count: agents },
          { label: 'buyers', count: buyers },
          { label: 'drivers', count: drivers },
        ],
        recentUsers,
        recentProducts,
        recentOrders,
        recentNotifications,
        recentLoads,
        recentPayments,
        recentGreenOrders,
        ads,
      });
      setErrors(nextErrors);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <ProcessingScreen />;

  const activeAds = data.ads.filter((ad) => ad.status === 'active').length;
  const totalRatings = data.ads.reduce((total, ad) => total + Number(ad.rating_count || 0), 0);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void refresh();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('dashboard.eyebrow')}</Text>
            <Text style={styles.title}>{t('dashboard.title')}</Text>
            <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.replace('/home')}
            accessibilityLabel={t('dashboard.backToFeed')}
          >
            <Icon name="home" size={19} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {errors.length > 0 ? (
          <View style={styles.warningBox}>
            <Icon name="alert-circle" size={17} color={COLORS.danger} />
            <Text style={styles.warningText}>
              {t('dashboard.partialFailure', { tables: errors.join(', ') })}
            </Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {DASHBOARD_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Icon
                name={tab.icon}
                size={15}
                color={activeTab === tab.key ? '#FFFFFF' : COLORS.muted}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {t(`dashboard.tabs.${tab.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.metricsGrid}>
          {METRIC_INFO.filter((metric) => activeTab === 'overview' || (
            activeTab === 'users' && metric.key === 'users' ||
            activeTab === 'products' && metric.key === 'products' ||
            activeTab === 'orders' && metric.key === 'orders' ||
            activeTab === 'notifications' && metric.key === 'notifications' ||
            activeTab === 'logistics' && metric.key === 'loads' ||
            activeTab === 'payments' && ['payments', 'providers'].includes(metric.key)
            || activeTab === 'greenPoints' && ['greenPoints', 'greenOrders'].includes(metric.key)
          )).map((metric) => (
            <View key={metric.key} style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: `${metric.color}14` }]}>
                <Icon name={metric.icon} size={18} color={metric.color} />
              </View>
              <Text style={styles.metricValue}>{formatCount(data.metrics[metric.key], i18n.language)}</Text>
              <Text style={styles.metricTitle}>{t(`dashboard.${metric.title}`)}</Text>
              <Text style={styles.metricSubtitle}>{t(`dashboard.${metric.subtitle}`)}</Text>
            </View>
          ))}
        </View>

        {activeTab === 'overview' || activeTab === 'users' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.usersByProfile')}</Text>
              <View style={styles.rolesCard}>
                {data.roles.map((role) => (
                  <View key={role.label} style={styles.roleRow}>
                    <Text style={styles.roleName}>{t(`dashboard.${role.label}`)}</Text>
                    <Text style={styles.roleCount}>{formatCount(role.count, i18n.language)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.recentUsers')}</Text>
              {data.recentUsers.length === 0 ? (
                <EmptyState text={t('dashboard.emptyUsers')} />
              ) : data.recentUsers.map((user) => (
                <RecentRow
                  key={user.id}
                  icon="user"
                  title={user.title}
                  detail={`${user.detail} · ${formatDate(user.created_at, i18n.language, t('dashboard.unavailable'))}`}
                />
              ))}
            </View>
          </>
        ) : null}

        {activeTab === 'overview' || activeTab === 'ads' ? <TouchableOpacity
          style={styles.adsSummary}
          activeOpacity={0.8}
          onPress={() => router.push('/agrilink-ads' as any)}
        >
          <View style={styles.adsHeader}>
            <View style={styles.adsIcon}>
              <Icon name="image" size={19} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adsTitle}>{t('dashboard.feedAdvertising')}</Text>
              <Text style={styles.adsCaption}>{t('dashboard.campaignRatings')}</Text>
            </View>
            <Icon name="arrow-right" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.adsStats}>
            <Text style={styles.adsStat}>{activeAds} {t('dashboard.active')}</Text>
            <Text style={styles.adsStatDivider}>·</Text>
            <Text style={styles.adsStat}>{data.ads.length} {t('dashboard.ads')}</Text>
            <Text style={styles.adsStatDivider}>·</Text>
            <Text style={styles.adsStat}>{totalRatings} {t('dashboard.ratings')}</Text>
          </View>
        </TouchableOpacity> : null}

        {activeTab === 'overview' || activeTab === 'products' ? (
          <RecordSection title={t('dashboard.recentProducts')} empty={t('dashboard.emptyProducts')} records={data.recentProducts} icon="package" locale={i18n.language} unavailable={t('dashboard.unavailable')} />
        ) : null}
        {activeTab === 'overview' || activeTab === 'orders' ? (
          <RecordSection title={t('dashboard.recentOrders')} empty={t('dashboard.emptyOrders')} records={data.recentOrders} icon="cart" locale={i18n.language} unavailable={t('dashboard.unavailable')} />
        ) : null}
        {activeTab === 'overview' || activeTab === 'notifications' ? (
          <RecordSection title={t('dashboard.recentNotifications')} empty={t('dashboard.emptyNotifications')} records={data.recentNotifications} icon="bell" locale={i18n.language} unavailable={t('dashboard.unavailable')} />
        ) : null}
        {activeTab === 'overview' || activeTab === 'logistics' ? (
          <RecordSection title={t('dashboard.recentLoads')} empty={t('dashboard.emptyLoads')} records={data.recentLoads} icon="truck" locale={i18n.language} unavailable={t('dashboard.unavailable')} />
        ) : null}
        {activeTab === 'payments' ? (
          <RecordSection title={t('dashboard.recentPayments')} empty={t('dashboard.emptyPayments')} records={data.recentPayments} icon="card" locale={i18n.language} unavailable={t('dashboard.unavailable')} />
        ) : null}
        {activeTab === 'overview' || activeTab === 'greenPoints' ? (
          <>
            <TouchableOpacity style={styles.greenPointSummary} onPress={() => router.push('/green-points' as any)} activeOpacity={0.85}>
              <View style={styles.adsHeader}>
                <View style={styles.adsIcon}><Icon name="sprout" size={19} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adsTitle}>{t('dashboard.greenPointManagement')}</Text>
                  <Text style={styles.adsCaption}>{t('dashboard.greenPointDescription')}</Text>
                </View>
                <Icon name="arrow-right" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <RecordSection title={t('dashboard.recentGreenOrders')} empty={t('dashboard.emptyGreenOrders')} records={data.recentGreenOrders} icon="sprout" locale={i18n.language} unavailable={t('dashboard.unavailable')} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function RecentRow({
  icon,
  title,
  detail,
}: {
  icon: IconName;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.recentRow}>
      <View style={styles.recentIcon}>
        <Icon name={icon} size={17} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recentTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.recentDetail} numberOfLines={1}>{detail}</Text>
      </View>
    </View>
  );
}

function RecordSection({
  title,
  empty,
  records,
  icon,
  locale,
  unavailable,
}: {
  title: string;
  empty: string;
  records: RecentRecord[];
  icon: IconName;
  locale: string;
  unavailable: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {records.length === 0 ? (
        <EmptyState text={empty} />
      ) : records.map((record) => (
        <RecentRow
          key={record.id}
          icon={icon}
          title={record.title}
          detail={`${record.detail} · ${formatDate(record.created_at, locale, unavailable)}`}
        />
      ))}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  return (
    <AdminOnly>
      <DashboardContent />
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { marginTop: 4, color: COLORS.text, fontSize: 27, fontWeight: '800' },
  subtitle: { marginTop: 3, color: COLORS.muted, fontSize: 12 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13, padding: 11, borderRadius: 12, backgroundColor: '#FCECEC' },
  warningText: { flex: 1, color: COLORS.danger, fontSize: 11.5, lineHeight: 16 },
  tabs: { gap: 8, paddingVertical: 4, paddingBottom: 15 },
  tab: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  activeTab: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  activeTabText: { color: '#FFFFFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 132, flexGrow: 1, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  metricIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  metricValue: { marginTop: 9, color: COLORS.text, fontSize: 23, fontWeight: '800' },
  metricTitle: { marginTop: 2, color: COLORS.text, fontSize: 12, fontWeight: '800' },
  metricSubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 10.5 },
  section: { marginTop: 23 },
  sectionTitle: { marginBottom: 9, color: COLORS.text, fontSize: 15, fontWeight: '800' },
  rolesCard: { paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  roleRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  roleName: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  roleCount: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  adsSummary: { marginTop: 16, padding: 15, borderRadius: 16, backgroundColor: COLORS.primary },
  greenPointSummary: { marginTop: 15, padding: 15, borderRadius: 16, backgroundColor: '#4776A8' },
  adsHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  adsIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.17)' },
  adsTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  adsCaption: { marginTop: 3, color: 'rgba(255,255,255,0.76)', fontSize: 10.5 },
  adsStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  adsStat: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  adsStatDivider: { color: 'rgba(255,255,255,0.65)' },
  recentRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recentIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#E9F5EC' },
  recentTitle: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  recentDetail: { marginTop: 3, color: COLORS.muted, fontSize: 10.5 },
  emptyState: { minHeight: 64, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: COLORS.surface },
  emptyText: { color: COLORS.muted, fontSize: 11.5, textAlign: 'center' },
});
