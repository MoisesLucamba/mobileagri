import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomToolbar from '../../components/BottomToolbar';
import FreightAccessGuard from '../../components/FreightAccessGuard';
import Icon from '../../components/Icon';
import MapViewer, { MapViewerCoords, MapViewerRoute } from '../../components/MapViewer';
import ProcessingScreen from '../../components/ProcessingScreen';
import { supabase } from '../../lib/supabase';

type FreightLoad = {
  id: string;
  product_name: string;
  status: string;
  driver_id: string | null;
  supplier_id: string | null;
  buyer_id: string | null;
  origin_label: string;
  destination_label: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  offered_price: number | null;
  currency: string | null;
  supplier_handover_confirmed_at: string | null;
  driver_pickup_confirmed_at: string | null;
  driver_delivery_confirmed_at: string | null;
  buyer_receipt_confirmed_at: string | null;
};

type TrackingLocation = {
  id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
};

type FreightEvent = { id: number; event_type: string; created_at: string };
type Settlement = {
  gross_amount: number;
  agrilink_commission: number;
  driver_amount: number;
  currency: string;
  status: string;
};

const COLORS = {
  primary: '#218B4A',
  tint: '#E9F5EC',
  text: '#16231C',
  muted: '#78877D',
  line: '#E8ECE6',
  background: '#F3F6F2',
  white: '#FFFEFC',
  gold: '#B9741A',
  goldSoft: '#FBEBD3',
};

const EVENT_LABELS: Record<string, string> = {
  accepted: 'Motorista aceitou a carga',
  supplier_handover: 'Fornecedor confirmou a entrega da carga ao motorista',
  driver_pickup: 'Motorista confirmou a recolha e iniciou o transporte',
  driver_delivery: 'Motorista confirmou a entrega',
  buyer_received: 'Comprador confirmou a receção',
};

const formatMoney = (amount: number, currency: string) =>
  `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(amount)} ${currency || 'Kz'}`;

function FreightTrackingScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const loadId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [load, setLoad] = useState<FreightLoad | null>(null);
  const [locations, setLocations] = useState<TrackingLocation[]>([]);
  const [events, setEvents] = useState<FreightEvent[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  const loadTracking = useCallback(async () => {
    if (!loadId) return;
    const [authResult, loadResult, locationResult, eventsResult, settlementResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('freight_loads').select('*').eq('id', loadId).single(),
      supabase.from('freight_tracking_locations').select('id, latitude, longitude, recorded_at').eq('freight_load_id', loadId).order('recorded_at', { ascending: false }).limit(500),
      supabase.from('freight_load_events').select('id, event_type, created_at').eq('freight_load_id', loadId).order('created_at', { ascending: true }),
      supabase.from('freight_settlements').select('gross_amount, agrilink_commission, driver_amount, currency, status').eq('freight_load_id', loadId).maybeSingle(),
    ]);

    if (authResult.error) throw authResult.error;
    if (loadResult.error) throw loadResult.error;
    if (locationResult.error) throw locationResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (settlementResult.error) throw settlementResult.error;

    setUserId(authResult.data.user?.id ?? null);
    setLoad(loadResult.data as FreightLoad);
    setLocations((locationResult.data ?? []) as TrackingLocation[]);
    setEvents((eventsResult.data ?? []) as FreightEvent[]);
    setSettlement(settlementResult.data as Settlement | null);
  }, [loadId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(loadTracking)
      .catch((error) => {
        console.error('[FreightTracking] Não foi possível carregar o acompanhamento:', error);
        if (active) Alert.alert('Acompanhamento indisponível', error instanceof Error ? error.message : 'Verifique a ligação e as permissões da carga.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    if (!loadId) return () => { active = false; };
    const channel = supabase
      .channel(`freight-tracking-${loadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_loads', filter: `id=eq.${loadId}` }, () => { void loadTracking(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_tracking_locations', filter: `freight_load_id=eq.${loadId}` }, () => { void loadTracking(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_load_events', filter: `freight_load_id=eq.${loadId}` }, () => { void loadTracking(); })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadId, loadTracking]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadTracking();
    } catch (error) {
      console.error('[FreightTracking] Erro ao atualizar o acompanhamento:', error);
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível atualizar o acompanhamento.');
    } finally {
      setRefreshing(false);
    }
  };

  const confirm = async (rpc: 'confirm_freight_handover' | 'confirm_freight_receipt', success: string) => {
    if (!loadId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc(rpc, { p_freight_load_id: loadId });
      if (error) throw error;
      await loadTracking();
      Alert.alert('Confirmação registada', success);
    } catch (error) {
      console.error('[FreightTracking] Não foi possível registar a confirmação:', error);
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível registar a confirmação.');
    } finally {
      setBusy(false);
    }
  };

  const trackingPath = useMemo<MapViewerCoords[]>(
    () => locations.slice().reverse().map((point) => ({
      lat: Number(point.latitude),
      lng: Number(point.longitude),
    })),
    [locations],
  );
  const latestLocation = locations[0] ?? null;
  const coords = useMemo<MapViewerCoords | null>(() => {
    if (!latestLocation) return null;
    return { lat: Number(latestLocation.latitude), lng: Number(latestLocation.longitude) };
  }, [latestLocation]);
  const route = useMemo<MapViewerRoute | undefined>(() => {
    if (!load) return undefined;
    const origin = { lat: Number(load.origin_lat), lng: Number(load.origin_lng) };
    const destination = { lat: Number(load.destination_lat), lng: Number(load.destination_lng) };
    const valid = (point: MapViewerCoords) =>
      Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90 &&
      Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180;
    return valid(origin) && valid(destination) ? { origin, destination } : undefined;
  }, [load]);

  if (loading) return <ProcessingScreen />;

  const isSupplier = !!userId && load?.supplier_id === userId;
  const isBuyer = !!userId && load?.buyer_id === userId;
  const isDriver = !!userId && load?.driver_id === userId;
  const statusLabel = load?.status === 'in_transit' ? 'Em trânsito' : load?.status === 'delivered' ? 'Entregue pelo motorista' : load?.status === 'accepted' ? 'Motorista a caminho da recolha' : load?.status ?? '—';

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
            <Text style={styles.headerTitle}>Acompanhamento da carga</Text>
            <Text style={styles.headerSubtitle}>Estado partilhado com os participantes</Text>
          </View>
        </View>

        {load && (
          <View style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.truckIcon}><Icon name="truck" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{load.product_name}</Text>
                  <Text style={styles.status}>{statusLabel}</Text>
                </View>
              </View>
              <View style={styles.route}>
                <Text style={styles.routeLabel}>RECOLHA</Text>
                <Text style={styles.routeValue}>{load.origin_label}</Text>
                <View style={styles.routeDivider} />
                <Text style={styles.routeLabel}>DESTINO</Text>
                <Text style={styles.routeValue}>{load.destination_label}</Text>
              </View>
              {coords ? (
                <>
                  <Text style={styles.locationTime}>
                    Última posição: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    {'\n'}Atualizada {new Date(latestLocation!.recorded_at).toLocaleString('pt-AO')}
                  </Text>
                  <Text style={styles.locationHistoryTitle}>
                    Percurso registado · {locations.length} posições recentes
                  </Text>
                  {locations.slice(0, 4).map((point) => (
                    <Text key={point.id} style={styles.locationHistoryPoint}>
                      {Number(point.latitude).toFixed(5)}, {Number(point.longitude).toFixed(5)} · {new Date(point.recorded_at).toLocaleTimeString('pt-AO')}
                    </Text>
                  ))}
                  <TouchableOpacity style={styles.outlineButton} onPress={() => setMapVisible(true)} activeOpacity={0.85}>
                    <Icon name="pin" size={16} color={COLORS.primary} />
                    <Text style={styles.outlineButtonText}>Ver posição no mapa</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.waitingLocation}>
                  <Text style={styles.waitingLocationText}>
                    {load.status === 'in_transit' ? 'À espera da primeira posição GPS do motorista.' : 'O rastreio GPS começa quando o motorista iniciar o transporte.'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Confirmações da entrega</Text>
              <Confirmation label="Fornecedor entregou a carga ao motorista" confirmed={!!load.supplier_handover_confirmed_at} />
              <Confirmation label="Motorista recolheu e iniciou o transporte" confirmed={!!load.driver_pickup_confirmed_at} />
              <Confirmation label="Motorista confirmou a entrega" confirmed={!!load.driver_delivery_confirmed_at} />
              <Confirmation label="Comprador confirmou a receção" confirmed={!!load.buyer_receipt_confirmed_at} />
              {isSupplier && !load.supplier_handover_confirmed_at && ['accepted', 'in_transit', 'delivered'].includes(load.status) && (
                <TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={() => confirm('confirm_freight_handover', 'A entrega da carga ao motorista foi confirmada.')} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>{busy ? 'A registar…' : 'Confirmar entrega ao motorista'}</Text>
                </TouchableOpacity>
              )}
              {isBuyer && !load.buyer_receipt_confirmed_at && load.status === 'delivered' && (
                <TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={() => confirm('confirm_freight_receipt', 'A receção da carga foi confirmada.')} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>{busy ? 'A registar…' : 'Confirmar receção da carga'}</Text>
                </TouchableOpacity>
              )}
              {isDriver && (
                <Text style={styles.hint}>A recolha e a entrega são confirmadas nos botões da Central do motorista.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Atividade</Text>
              {events.length ? events.map((event) => (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.eventDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventLabel}>{EVENT_LABELS[event.event_type] ?? event.event_type}</Text>
                    <Text style={styles.eventTime}>{new Date(event.created_at).toLocaleString('pt-AO')}</Text>
                  </View>
                </View>
              )) : <Text style={styles.emptyText}>Ainda não há atualizações registadas.</Text>}
            </View>

            <View style={styles.paymentCard}>
              <Text style={styles.sectionTitle}>Liquidação do frete</Text>
              <Text style={styles.hint}>
                A liquidação fica pendente até às confirmações do fornecedor, motorista e comprador. A comissão AgriLink é 8% do frete; 92% destinam-se ao motorista.
              </Text>
              {settlement ? (
                <View style={styles.amounts}>
                  <Amount label="Valor do frete" amount={settlement.gross_amount} currency={settlement.currency} />
                  <Amount label="Comissão AgriLink (8%)" amount={settlement.agrilink_commission} currency={settlement.currency} />
                  <Amount label="Valor do motorista (92%)" amount={settlement.driver_amount} currency={settlement.currency} />
                  <Text style={styles.settlementPending}>
                    {settlement.status === 'paid' ? 'Pagamento registado' : 'A aguardar liquidação manual pela AgriLink'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.waitingLocationText}>
                  {load.offered_price != null
                    ? `Estimativa: ${formatMoney(load.offered_price * 0.08, load.currency ?? 'Kz')} de comissão e ${formatMoney(load.offered_price * 0.92, load.currency ?? 'Kz')} para o motorista, após todas as confirmações.`
                    : 'O valor será calculado quando o frete tiver um preço definido e todas as confirmações forem registadas.'}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      <MapViewer
        visible={mapVisible}
        coords={coords}
        route={route}
        trackingPath={trackingPath}
        title={load?.product_name}
        subtitle={latestLocation ? `Posição atualizada ${new Date(latestLocation.recorded_at).toLocaleTimeString('pt-AO')}` : undefined}
        onClose={() => setMapVisible(false)}
      />
      <BottomToolbar />
    </View>
  );
}

function Confirmation({ label, confirmed }: { label: string; confirmed: boolean }) {
  return (
    <View style={styles.confirmationRow}>
      <View style={[styles.confirmationIcon, confirmed && styles.confirmedIcon]}>
        <Icon name={confirmed ? 'check' : 'clock'} size={14} color={confirmed ? COLORS.primary : COLORS.muted} />
      </View>
      <Text style={[styles.confirmationLabel, confirmed && styles.confirmedLabel]}>{label}</Text>
      <Text style={[styles.confirmationState, confirmed && styles.confirmedLabel]}>{confirmed ? 'Confirmado' : 'Pendente'}</Text>
    </View>
  );
}

function Amount({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={styles.amountValue}>{formatMoney(amount, currency)}</Text>
    </View>
  );
}

export default function FreightTrackingRoute() {
  return (
    <FreightAccessGuard>
      <FreightTrackingScreen />
    </FreightAccessGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  headerSubtitle: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  content: { paddingHorizontal: 16, gap: 12 },
  card: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, padding: 14 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  truckIcon: { width: 40, height: 40, backgroundColor: COLORS.tint, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  productName: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  status: { color: COLORS.primary, fontSize: 11.5, fontWeight: '800', marginTop: 3 },
  route: { marginTop: 14, padding: 11, borderRadius: 9, backgroundColor: COLORS.background },
  routeLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  routeValue: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 3 },
  routeDivider: { height: 1, backgroundColor: COLORS.line, marginVertical: 9 },
  locationTime: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 11 },
  locationHistoryTitle: { color: COLORS.text, fontSize: 10.5, fontWeight: '900', marginTop: 10 },
  locationHistoryPoint: { color: COLORS.muted, fontSize: 9.5, marginTop: 4 },
  waitingLocation: { marginTop: 12, backgroundColor: COLORS.goldSoft, borderRadius: 9, padding: 10 },
  waitingLocationText: { color: COLORS.text, fontSize: 11.5, lineHeight: 17 },
  outlineButton: { marginTop: 10, height: 40, borderRadius: 9, borderWidth: 1, borderColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  outlineButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginBottom: 11 },
  confirmationRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42, borderTopWidth: 1, borderTopColor: COLORS.line, gap: 8 },
  confirmationIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  confirmedIcon: { backgroundColor: COLORS.tint },
  confirmationLabel: { flex: 1, color: COLORS.muted, fontSize: 11.5, fontWeight: '600' },
  confirmationState: { color: COLORS.muted, fontSize: 9.5, fontWeight: '800' },
  confirmedLabel: { color: COLORS.primary },
  primaryButton: { minHeight: 43, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  hint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 7 },
  eventDot: { width: 9, height: 9, borderRadius: 5, marginTop: 3, backgroundColor: COLORS.primary },
  eventLabel: { color: COLORS.text, fontSize: 11.5, fontWeight: '700' },
  eventTime: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  emptyText: { color: COLORS.muted, fontSize: 11.5 },
  paymentCard: { backgroundColor: COLORS.white, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  amounts: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 10 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  amountLabel: { color: COLORS.muted, fontSize: 11, flex: 1 },
  amountValue: { color: COLORS.text, fontSize: 11.5, fontWeight: '800' },
  settlementPending: { color: COLORS.gold, fontSize: 11, fontWeight: '800', marginTop: 8 },
});
