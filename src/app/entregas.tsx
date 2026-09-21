// app/cargas.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import RoleGuard from '../components/RoleGuard';

const T = {
  green: '#2c863b',
  greenPale: '#E8F5E9',
  ink: '#111714',
  mid: '#3F4A41',
  muted: '#6B7C6E',
  faint: '#A7B3A9',
  rule: '#E5EDE6',
  gold: '#B07D0A',
  white: '#FFFFFF',
  canvas: '#FAFAF7',
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
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Disponível',
  accepted: 'Aceite',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

const money = (v: number | null, c: string) =>
  v == null ? '—' : `${new Intl.NumberFormat('pt-AO').format(v)} ${c || 'Kz'}`;

function CargasScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
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
      setCapacity(profile?.load_capacity_kg ?? null);
    }

    await fetchLoads();
    setLoading(false);
  }, [fetchLoads]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLoads();
    setRefreshing(false);
  };

  const accept = async (load: FreightLoad) => {
    if (!requireAuth('aceitar uma carga')) return;
    if (capacity && load.weight_kg > capacity) {
      Alert.alert('Capacidade insuficiente', `Esta carga excede a sua capacidade (${capacity} kg).`);
      return;
    }

    setBusyId(load.id);
    const { error } = await supabase
      .from('freight_loads')
      .update({
        driver_id: userId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', load.id)
      .is('driver_id', null);
    setBusyId(null);

    if (error) {
      Alert.alert('Erro', 'Não foi possível aceitar esta carga.');
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

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={T.mid} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Próximas Cargas</Text>
          <Text style={styles.headerSubtitle}>
            {capacity
              ? `Capacidade: ${new Intl.NumberFormat('pt-AO').format(capacity)} kg`
              : 'Fretes disponíveis na AgriLink'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['disponiveis', 'minhas'] as const).map((k) => {
          const active = tab === k;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              style={[
                styles.tabBtn,
                { backgroundColor: active ? T.green : T.white, borderColor: active ? T.green : T.rule },
              ]}
            >
              <Text style={{ color: active ? '#fff' : T.mid, fontWeight: '800', fontSize: 13 }}>
                {k === 'disponiveis' ? 'Disponíveis' : 'As minhas cargas'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <ActivityIndicator color={T.green} />
            <Text style={{ color: T.muted, marginTop: 8, fontSize: 12 }}>A carregar cargas…</Text>
          </View>
        )}

        {!loading && visible.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={28} color={T.faint} />
            <Text style={styles.emptyText}>
              {tab === 'minhas'
                ? 'Ainda não aceitaste nenhuma carga.'
                : 'Sem cargas disponíveis de momento.'}
            </Text>
          </View>
        )}

        {!loading &&
          visible.map((load) => {
            const tooHeavy = !!capacity && load.weight_kg > capacity;
            return (
              <View key={load.id} style={styles.loadCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={styles.loadIcon}>
                    <Ionicons name="cube-outline" size={19} color={T.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loadTitle}>{load.product_name}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {STATUS_LABEL[load.status] || load.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.loadPrice}>{money(load.offered_price, load.currency)}</Text>
                </View>

                <View style={{ marginTop: 14, gap: 8 }}>
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={15} color={T.faint} />
                    <Text style={styles.infoText}>
                      {load.origin_label} → {load.destination_label}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="barbell-outline" size={15} color={T.faint} />
                    <Text style={[styles.infoText, tooHeavy && { color: T.gold }]}>
                      {new Intl.NumberFormat('pt-AO').format(load.weight_kg)} kg
                      {tooHeavy ? ' · acima da sua capacidade' : ''}
                    </Text>
                  </View>
                  {load.pickup_date && (
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={15} color={T.faint} />
                      <Text style={styles.infoText}>
                        Recolha: {new Date(load.pickup_date).toLocaleDateString('pt-AO')}
                      </Text>
                    </View>
                  )}
                </View>

                {!!load.notes && <Text style={styles.notes}>{load.notes}</Text>}

                {tab === 'disponiveis' ? (
                  <TouchableOpacity
                    disabled={busyId === load.id || tooHeavy}
                    onPress={() => accept(load)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: tooHeavy ? T.rule : T.green },
                    ]}
                  >
                    {busyId === load.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: tooHeavy ? T.muted : '#fff', fontWeight: '800', fontSize: 14 }}>
                        {tooHeavy ? 'Capacidade insuficiente' : 'Aceitar carga'}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : load.status === 'accepted' || load.status === 'in_transit' ? (
                  <TouchableOpacity
                    disabled={busyId === load.id}
                    onPress={() => advance(load)}
                    style={[styles.actionBtn, styles.actionBtnOutline]}
                  >
                    {busyId === load.id ? (
                      <ActivityIndicator color={T.green} />
                    ) : (
                      <Text style={{ color: T.green, fontWeight: '800', fontSize: 14 }}>
                        {load.status === 'accepted' ? 'Iniciar transporte' : 'Marcar como entregue'}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: T.white,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  backBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: T.ink },
  headerSubtitle: { fontSize: 11, fontWeight: '600', color: T.muted, marginTop: 1 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  tabBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  emptyCard: {
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: T.mid, textAlign: 'center' },
  loadCard: {
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 18,
    padding: 16,
  },
  loadIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: T.greenPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadTitle: { fontSize: 15.5, fontWeight: '800', color: T.ink },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: T.greenPale,
  },
  statusPillText: { fontSize: 11, fontWeight: '800', color: T.green },
  loadPrice: { fontSize: 15, fontWeight: '800', color: T.green },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, fontWeight: '600', color: T.mid },
  notes: { marginTop: 10, fontSize: 12.5, color: T.muted, lineHeight: 18 },
  actionBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutline: { borderWidth: 1.5, borderColor: T.green, backgroundColor: T.white },
});

export default function CargasRoute() {
  return (
    <RoleGuard allow={['motorista']}>
      <CargasScreen />
    </RoleGuard>
  );
}