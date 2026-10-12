import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomToolbar from '../components/BottomToolbar';
import FreightAccessGuard from '../components/FreightAccessGuard';
import Icon from '../components/Icon';
import ProcessingScreen from '../components/ProcessingScreen';
import { isAgrilinkAdmin } from '../lib/agrilinkAds';
import { supabase } from '../lib/supabase';

type FreightLoad = {
  id: string;
  product_name: string;
  status: string;
  origin_label: string;
  destination_label: string;
  pickup_date: string | null;
  supplier_handover_confirmed_at: string | null;
  buyer_receipt_confirmed_at: string | null;
};

const COLORS = {
  primary: '#218B4A',
  tint: '#E9F5EC',
  text: '#16231C',
  muted: '#78877D',
  line: '#E8ECE6',
  background: '#F3F6F2',
  white: '#FFFEFC',
};

const loadStatus = (status: string) => ({
  open: 'Disponível',
  accepted: 'Motorista atribuído',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
}[status] ?? status);

function FreightLoadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLoads = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      setLoads([]);
      return;
    }

    const select = 'id, product_name, status, origin_label, destination_label, pickup_date, supplier_handover_confirmed_at, buyer_receipt_confirmed_at';
    const admin = await isAgrilinkAdmin();
    const { data, error } = admin
      ? await supabase.from('freight_loads').select(select).order('pickup_date', { ascending: false, nullsFirst: false }).limit(100)
      : await supabase.from('freight_loads').select(select).or(`supplier_id.eq.${user.id},buyer_id.eq.${user.id},driver_id.eq.${user.id}`).order('pickup_date', { ascending: false, nullsFirst: false }).limit(100);
    if (error) throw error;
    setLoads((data ?? []) as FreightLoad[]);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(fetchLoads)
      .catch((error) => {
        console.error('[FreightLoads] Não foi possível carregar as entregas:', error);
        if (active) Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível carregar as entregas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel('participant-freight-loads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_loads' }, () => { void fetchLoads(); })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [fetchLoads]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetchLoads();
    } catch (error) {
      console.error('[FreightLoads] Erro ao atualizar as entregas:', error);
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível atualizar as entregas.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <ProcessingScreen />;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 92 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Voltar">
            <Icon name="arrow-left" size={19} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Entregas e rastreio</Text>
            <Text style={styles.subtitle}>Acompanha as cargas em que participas</Text>
          </View>
        </View>

        <View style={styles.content}>
          {loads.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="truck" size={25} color={COLORS.primary} /></View>
              <Text style={styles.emptyTitle}>Ainda não há entregas associadas</Text>
              <Text style={styles.emptyText}>As cargas ligadas ao teu perfil aparecerão aqui para acompanhamento e confirmação.</Text>
            </View>
          ) : loads.map((load) => (
            <TouchableOpacity
              key={load.id}
              style={styles.loadCard}
              activeOpacity={0.82}
              onPress={() => router.push({ pathname: '/rastreamento/[id]', params: { id: load.id } })}
            >
              <View style={styles.cardTop}>
                <View style={styles.truckIcon}><Icon name="truck" size={18} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>{load.product_name}</Text>
                  <Text style={styles.status}>{loadStatus(load.status)}</Text>
                </View>
                <Icon name="arrow-right" size={17} color={COLORS.primary} />
              </View>
              <Text style={styles.route} numberOfLines={2}>{load.origin_label} → {load.destination_label}</Text>
              <View style={styles.footer}>
                <Text style={styles.date}>{load.pickup_date ? `Recolha ${new Date(load.pickup_date).toLocaleDateString('pt-AO')}` : 'Data de recolha não definida'}</Text>
                <Text style={styles.confirmed}>
                  {load.buyer_receipt_confirmed_at ? 'Receção confirmada' : load.supplier_handover_confirmed_at ? 'Acompanhamento ativo' : 'Confirmações pendentes'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <BottomToolbar />
    </View>
  );
}

export default function FreightLoadsRoute() {
  return (
    <FreightAccessGuard>
      <FreightLoadsScreen />
    </FreightAccessGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 11.5, marginTop: 2 },
  content: { paddingHorizontal: 16, gap: 10 },
  loadCard: { padding: 13, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  truckIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: COLORS.tint, alignItems: 'center', justifyContent: 'center' },
  productName: { color: COLORS.text, fontSize: 13.5, fontWeight: '900' },
  status: { color: COLORS.primary, fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  route: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginTop: 11 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 8 },
  date: { color: COLORS.muted, fontSize: 9.5, flex: 1 },
  confirmed: { color: COLORS.primary, fontSize: 9.5, fontWeight: '800' },
  empty: { backgroundColor: COLORS.white, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, padding: 24, alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.tint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  emptyText: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17, marginTop: 5, textAlign: 'center' },
});
