// app/cargas.tsx
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import MapViewer, { MapViewerCoords } from '../components/MapViewer';
import RoleGuard from '../components/RoleGuard';
import { supabase } from '../lib/supabase';

// Mesma palette da página de Segurança
const COLORS = {
  primary: '#1F6B3A',
  secondary: '#79C267',
  dark: '#465044',
  text: '#3D403A',
  muted: '#77796F',
  faint: '#A3A398',
  border: '#E8E5DC',
  field: '#F5F3EC',
  background: '#FBFAF6',
  soft: '#EEF0E9',
  gold: '#B7833D',
  goldSoft: '#F5EEDF',
  blue: '#2F6DB5',
  blueSoft: '#EDF1F5',
  danger: '#B95E54',
  dangerSoft: '#F6ECE9',
};

const SHADOW_SOFT = {
  shadowColor: COLORS.dark,
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 6,
};

interface FreightLoad {
  id: string;
  product_name: string;
  weight_kg: number;
  origin_label: string;
  destination_label: string;
  pickup_date: string | null;
  offered_price: number | null;
  currency: string;
  status: string;
  driver_id: string | null;
  notes: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Disponível',
  accepted: 'Aceite',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  open: { bg: COLORS.soft, fg: COLORS.primary },
  accepted: { bg: COLORS.blueSoft, fg: COLORS.blue },
  in_transit: { bg: COLORS.goldSoft, fg: COLORS.gold },
  delivered: { bg: COLORS.soft, fg: COLORS.primary },
  cancelled: { bg: COLORS.dangerSoft, fg: COLORS.danger },
};

const money = (v: number | null, c: string) =>
  v == null ? '—' : `${new Intl.NumberFormat('pt-AO').format(v)} ${c || 'Kz'}`;

const toCoords = (lat?: number | null, lng?: number | null): MapViewerCoords | null => {
  if (lat == null || lng == null) return null;
  const coords = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(coords.lat) && Number.isFinite(coords.lng) &&
    coords.lat >= -90 && coords.lat <= 90 && coords.lng >= -180 && coords.lng <= 180
    ? coords
    : null;
};

const distanceKm = (a: MapViewerCoords, b: MapViewerCoords) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latDelta = radians(b.lat - a.lat);
  const lngDelta = radians(b.lng - a.lng);
  const arc =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
};

function CargasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [driverLocation, setDriverLocation] = useState<MapViewerCoords | null>(null);
  const [routeLoad, setRouteLoad] = useState<FreightLoad | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'denied' | 'disabled' | 'unavailable'>('loading');
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'disponiveis' | 'minhas'>('disponiveis');

  const requireAuth = (action: string): boolean => {
    if (userId) return true;
    Alert.alert(
      'Sessão necessária',
      `Precisas de iniciar sessão para ${action}.`,
      [{ text: 'Iniciar sessão', onPress: () => router.push('/login') }]
    );
    return false;
  };

  const fetchLoads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('freight_loads')
        .select('*')
        .order('pickup_date', { ascending: true, nullsFirst: false })
        .limit(80);
      if (error) throw error;
      setLoads((data || []) as FreightLoad[]);
    } catch (e) {
      console.warn(e);
      Alert.alert('Erro', 'Não foi possível carregar as cargas.');
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('load_capacity_kg')
        .eq('id', user.id)
        .maybeSingle();
      const rawCapacity = profile?.load_capacity_kg ?? user.user_metadata?.load_capacity_kg;
      const parsedCapacity = Number(rawCapacity);
      setCapacity(Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : null);
    }

    await fetchLoads();
    setLoading(false);
  }, [fetchLoads]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    const applyLocation = (position: Location.LocationObject) => {
      if (!active) return;
      setDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationStatus('ready');
    };

    const trackLocation = async () => {
      setLocationStatus('loading');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (!permission.granted) {
        setLocationCanAskAgain(permission.canAskAgain);
        setLocationStatus('denied');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocationStatus('disabled');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) applyLocation(lastKnown);

      try {
        applyLocation(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      } catch {
        // Keep the last known location when a fresh fix is unavailable.
      }

      if (!active) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 30000 },
        applyLocation,
      );
    };

    trackLocation().catch((error) => {
      console.warn('Não foi possível obter a localização do motorista:', error);
      if (active) setLocationStatus('unavailable');
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [locationAttempt]);

  useEffect(() => {
    const channel = supabase
      .channel('driver-freight-loads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_loads' }, () => {
        fetchLoads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLoads]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLoads();
    setRefreshing(false);
  };

  const handleLocationNotice = () => {
    if (locationStatus === 'denied' && !locationCanAskAgain) {
      Linking.openSettings().catch(() => {});
      return;
    }
    setLocationAttempt((attempt) => attempt + 1);
  };

  const accept = async (load: FreightLoad) => {
    if (!requireAuth('aceitar uma carga')) return;
    if (capacity == null) {
      Alert.alert('Capacidade em falta', 'O perfil não tem uma capacidade de carga válida. Atualiza os dados do motorista antes de aceitar fretes.');
      return;
    }
    if (load.weight_kg > capacity) {
      Alert.alert('Capacidade insuficiente', `Esta carga excede a sua capacidade (${capacity} kg).`);
      return;
    }

    setBusyId(load.id);
    const { data, error } = await supabase
      .from('freight_loads')
      .update({
        driver_id: userId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', load.id)
      .eq('status', 'open')
      .is('driver_id', null)
      .lte('weight_kg', capacity)
      .select('id')
      .maybeSingle();
    setBusyId(null);

    if (error || !data) {
      Alert.alert('Carga indisponível', 'Esta carga já foi aceite ou não corresponde à capacidade do seu veículo. Atualize a lista e tente outra.');
      return;
    }
    Alert.alert('Carga aceite', 'Boa viagem!');
    fetchLoads();
  };

  const advance = async (load: FreightLoad) => {
    if (!requireAuth('actualizar a carga')) return;

    const next =
      load.status === 'accepted'
        ? { status: 'in_transit', in_transit_at: new Date().toISOString() }
        : { status: 'delivered', delivered_at: new Date().toISOString() };

    setBusyId(load.id);
    const { error } = await supabase.from('freight_loads').update(next).eq('id', load.id);
    setBusyId(null);

    if (error) {
      Alert.alert('Erro', 'Não foi possível actualizar.');
      return;
    }
    fetchLoads();
  };

  const visible = loads.filter((l) =>
    tab === 'minhas' ? l.driver_id === userId : l.status === 'open' && !l.driver_id
  );
  const visibleLoads = driverLocation
    ? [...visible].sort((a, b) => {
        const aOrigin = toCoords(a.origin_lat, a.origin_lng);
        const bOrigin = toCoords(b.origin_lat, b.origin_lng);
        const aDistance = aOrigin ? distanceKm(driverLocation, aOrigin) : Number.POSITIVE_INFINITY;
        const bDistance = bOrigin ? distanceKm(driverLocation, bOrigin) : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      })
    : visible;

  const openCount = loads.filter(
    (l) => l.status === 'open' && !l.driver_id && capacity != null && l.weight_kg <= capacity,
  ).length;
  const mineCount = loads.filter((l) => l.driver_id && l.driver_id === userId).length;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Próximas cargas
          </Text>
        </View>

        <View style={styles.body}>
          {/* Cartão de resumo */}
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Icon name="truck" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>
                {capacity
                  ? `${new Intl.NumberFormat('pt-AO').format(capacity)} kg de capacidade`
                  : 'Fretes disponíveis'}
              </Text>
              <Text style={styles.heroSub}>
                {openCount} {openCount === 1 ? 'carga disponível' : 'cargas disponíveis'} agora
              </Text>
            </View>
          </View>

          {locationStatus !== 'ready' && locationStatus !== 'loading' && (
            <View style={styles.locationNotice}>
              <Icon name="pin" size={17} color={COLORS.gold} />
              <Text style={styles.locationNoticeText}>
                {locationStatus === 'denied'
                  ? 'Ative a localização para ordenar as cargas mais próximas.'
                  : locationStatus === 'disabled'
                    ? 'A localização do dispositivo está desligada.'
                    : 'Não foi possível obter a localização para ordenar as cargas.'}
              </Text>
              <TouchableOpacity onPress={handleLocationNotice} hitSlop={8}>
                <Text style={styles.locationNoticeAction}>
                  {locationStatus === 'denied' && !locationCanAskAgain ? 'Definições' : 'Tentar novamente'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Separadores */}
          <View style={styles.segment}>
            {(['disponiveis', 'minhas'] as const).map((k) => {
              const active = tab === k;
              const count = k === 'disponiveis' ? openCount : mineCount;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setTab(k)}
                  activeOpacity={0.85}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, active && { color: '#FFFFFF' }]}>
                    {k === 'disponiveis' ? 'Disponíveis' : 'As minhas cargas'}
                  </Text>
                  <View style={[styles.segmentCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Text style={[styles.segmentCountText, active && { color: '#FFFFFF' }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && (
            <View style={{ alignItems: 'center', padding: 48 }}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={{ color: COLORS.muted, marginTop: 8, fontSize: 12 }}>A carregar cargas…</Text>
            </View>
          )}

          {!loading && visible.length === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon name="package" size={26} color={COLORS.faint} />
              </View>
              <Text style={styles.emptyText}>
                {tab === 'minhas'
                  ? 'Ainda não aceitaste nenhuma carga.'
                  : 'Sem cargas disponíveis de momento.'}
              </Text>
              <Text style={styles.emptySub}>Puxa para baixo para atualizar.</Text>
            </View>
          )}

          {!loading &&
            visibleLoads.map((load) => {
              const capacityMissing = capacity == null;
              const tooHeavy = capacity != null && load.weight_kg > capacity;
              const origin = toCoords(load.origin_lat, load.origin_lng);
              const destination = toCoords(load.destination_lat, load.destination_lng);
              const route = origin && destination ? { origin, destination } : null;
              const distanceToOrigin = driverLocation && origin ? distanceKm(driverLocation, origin) : null;
              const st = STATUS_STYLE[load.status] || STATUS_STYLE.open;
              return (
                <View key={load.id} style={styles.loadCard}>
                  <View style={styles.loadTop}>
                    <View style={styles.loadIcon}>
                      <Icon name="package" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loadTitle} numberOfLines={1}>
                        {load.product_name}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusPillText, { color: st.fg }]}>
                          {STATUS_LABEL[load.status] || load.status}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.priceLabel}>Oferta</Text>
                      <Text style={styles.loadPrice}>{money(load.offered_price, load.currency)}</Text>
                    </View>
                  </View>

                  {/* Rota origem → destino */}
                  <View style={styles.route}>
                    <View style={styles.routeRail}>
                      <View style={styles.dotOrigin} />
                      <View style={styles.routeLine} />
                      <View style={styles.dotDest} />
                    </View>
                    <View style={{ flex: 1, gap: 14 }}>
                      <View>
                        <Text style={styles.routeLabel}>Origem</Text>
                        <Text style={styles.routeText} numberOfLines={2}>
                          {load.origin_label}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.routeLabel}>Destino</Text>
                        <Text style={styles.routeText} numberOfLines={2}>
                          {load.destination_label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {route && (
                    <TouchableOpacity
                      style={styles.mapRouteButton}
                      activeOpacity={0.8}
                      onPress={() => setRouteLoad(load)}
                    >
                      <Icon name="map" size={16} color={COLORS.primary} />
                      <Text style={styles.mapRouteText}>Ver rota no mapa</Text>
                    </TouchableOpacity>
                  )}

                  {/* Detalhes */}
                  <View style={styles.chipsRow}>
                    {distanceToOrigin != null && (
                      <View style={styles.chip}>
                        <Icon name="navigation" size={14} color={COLORS.primary} />
                        <Text style={styles.chipText}>≈ {distanceToOrigin.toFixed(1)} km da origem</Text>
                      </View>
                    )}
                    <View style={[styles.chip, tooHeavy && { backgroundColor: COLORS.goldSoft }]}>
                      <Icon name="layers" size={14} color={tooHeavy ? COLORS.gold : COLORS.muted} />
                      <Text style={[styles.chipText, tooHeavy && { color: COLORS.gold }]}>
                        {new Intl.NumberFormat('pt-AO').format(load.weight_kg)} kg
                      </Text>
                    </View>
                    {load.pickup_date && (
                      <View style={styles.chip}>
                        <Icon name="clock" size={14} color={COLORS.muted} />
                        <Text style={styles.chipText}>
                          Recolha {new Date(load.pickup_date).toLocaleDateString('pt-AO')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {(capacityMissing || tooHeavy) && (
                    <View style={styles.warnBox}>
                      <Icon name="alert-circle" size={15} color={COLORS.gold} />
                      <Text style={styles.warnText}>
                        {capacityMissing ? 'Defina a capacidade do veículo para aceitar esta carga.' : 'Acima da sua capacidade de carga.'}
                      </Text>
                    </View>
                  )}

                  {!!load.notes && <Text style={styles.notes}>{load.notes}</Text>}

                  {tab === 'disponiveis' ? (
                    <TouchableOpacity
                      disabled={busyId === load.id || tooHeavy || capacityMissing}
                      onPress={() => accept(load)}
                      activeOpacity={0.85}
                      style={[styles.actionBtn, (tooHeavy || capacityMissing) && styles.actionBtnDisabled]}
                    >
                      {busyId === load.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={[styles.actionText, tooHeavy && { color: COLORS.muted }]}>
                            {capacityMissing ? 'Capacidade em falta' : tooHeavy ? 'Capacidade insuficiente' : 'Aceitar carga'}
                          </Text>
                          {!tooHeavy && !capacityMissing && <Icon name="arrow-right" size={18} color="#FFFFFF" />}
                        </>
                      )}
                    </TouchableOpacity>
                  ) : load.status === 'accepted' || load.status === 'in_transit' ? (
                    <TouchableOpacity
                      disabled={busyId === load.id}
                      onPress={() => advance(load)}
                      activeOpacity={0.85}
                      style={[styles.actionBtn, styles.actionBtnOutline]}
                    >
                      {busyId === load.id ? (
                        <ActivityIndicator color={COLORS.primary} />
                      ) : (
                        <>
                          <Icon
                            name={load.status === 'accepted' ? 'navigation' : 'check-circle'}
                            size={17}
                            color={COLORS.primary}
                          />
                          <Text style={[styles.actionText, { color: COLORS.primary }]}>
                            {load.status === 'accepted' ? 'Iniciar transporte' : 'Marcar como entregue'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
        </View>
      </ScrollView>
      <MapViewer
        visible={routeLoad != null}
        coords={null}
        route={routeLoad ? {
          origin: toCoords(routeLoad.origin_lat, routeLoad.origin_lng)!,
          destination: toCoords(routeLoad.destination_lat, routeLoad.destination_lng)!,
        } : undefined}
        title={routeLoad?.product_name}
        subtitle={routeLoad ? `${routeLoad.origin_label} → ${routeLoad.destination_label}` : undefined}
        onClose={() => setRouteLoad(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: { flex: 1, fontSize: 21, fontWeight: '800', color: COLORS.text },

  body: { paddingHorizontal: 22, gap: 14 },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    ...SHADOW_SOFT,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  heroSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 3 },

  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: COLORS.goldSoft,
  },
  locationNoticeText: { flex: 1, color: COLORS.text, fontSize: 12, lineHeight: 17 },
  locationNoticeAction: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },

  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.field,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentBtnActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  segmentCount: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountText: { fontSize: 11, fontWeight: '800', color: COLORS.muted },

  emptyCard: {
    backgroundColor: COLORS.field,
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { marginTop: 14, fontSize: 14.5, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  emptySub: { marginTop: 4, fontSize: 12.5, color: COLORS.muted, textAlign: 'center' },

  loadCard: {
    backgroundColor: COLORS.field,
    borderRadius: 22,
    padding: 16,
  },
  loadTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  loadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadTitle: { fontSize: 15.5, fontWeight: '800', color: COLORS.text },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  priceLabel: { fontSize: 10.5, fontWeight: '700', color: COLORS.muted },
  loadPrice: { fontSize: 15.5, fontWeight: '800', color: COLORS.primary, marginTop: 1 },

  route: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  routeRail: { alignItems: 'center', paddingTop: 4 },
  dotOrigin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  routeLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 3 },
  dotDest: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  routeLabel: { fontSize: 11, fontWeight: '700', color: COLORS.faint },
  routeText: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 1 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  mapRouteButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  mapRouteText: { color: COLORS.primary, fontSize: 12.5, fontWeight: '800' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  chipText: { fontSize: 12.5, fontWeight: '700', color: COLORS.text },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: COLORS.goldSoft,
  },
  warnText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.text },

  notes: { marginTop: 12, fontSize: 12.5, color: COLORS.muted, lineHeight: 18 },

  actionBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOW_SOFT,
  },
  actionBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0, elevation: 0 },
  actionBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});

export default function CargasRoute() {
  return (
    <RoleGuard allow={['motorista']}>
      <CargasScreen />
    </RoleGuard>
  );
}