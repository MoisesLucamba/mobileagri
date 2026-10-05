import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import Icon from '../components/Icon';
import { AgrilinkAd, loadAgrilinkAds } from '../lib/agrilinkAds';

const COLORS = {
  primary: '#1F6B3A',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#EAE4D6',
  canvas: '#FAF8F3',
  surface: '#FFFFFF',
  gold: '#D79427',
};

function DashboardContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ads, setAds] = useState<AgrilinkAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError('');
      setAds(await loadAgrilinkAds());
    } catch (loadError: any) {
      setError(loadError?.message || 'Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCount = ads.filter((ad) => ad.status === 'active').length;
  const totalRatings = ads.reduce((total, ad) => total + Number(ad.rating_count || 0), 0);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>AGRILINK · ADMINISTRAÇÃO</Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/home')} accessibilityLabel="Voltar ao feed">
            <Icon name="home" size={19} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <View style={styles.summaryIcon}>
              <Icon name="bar-chart" size={19} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Publicidade no feed</Text>
              <Text style={styles.summaryCaption}>Campanhas e avaliações dos utilizadores</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{loading ? '—' : activeCount}</Text>
              <Text style={styles.statLabel}>Ativos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{loading ? '—' : ads.length}</Text>
              <Text style={styles.statLabel}>Anúncios</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{loading ? '—' : totalRatings}</Text>
              <Text style={styles.statLabel}>Avaliações</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.featureRow} activeOpacity={0.8} onPress={() => router.push('/agrilink-ads' as any)}>
          <View style={styles.featureIcon}>
            <Icon name="image" size={19} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Agrilink Ads</Text>
            <Text style={styles.featureDescription}>Criar anúncios, gerir campanhas e ver avaliações</Text>
          </View>
          <Icon name="arrow-right" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Anúncios recentes</Text>
          <TouchableOpacity onPress={() => router.push('/agrilink-ads' as any)}>
            <Text style={styles.sectionLink}>Gerir</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={COLORS.primary} />
        ) : error ? (
          <Text style={styles.emptyText}>{error}</Text>
        ) : ads.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="image" size={23} color={COLORS.faint} />
            <Text style={styles.emptyText}>Ainda não há anúncios.</Text>
          </View>
        ) : (
          ads.slice(0, 5).map((ad) => (
            <View key={ad.id} style={styles.adRow}>
              <View style={[styles.statusDot, ad.status === 'active' && styles.statusDotActive]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
                <Text style={styles.adMeta}>{ad.status === 'active' ? 'Ativo' : ad.status === 'paused' ? 'Pausado' : 'Rascunho'} · {ad.rating_count} avaliações</Text>
              </View>
              <View style={styles.rating}>
                <Icon name="star" size={13} color={COLORS.gold} filled />
                <Text style={styles.ratingText}>{Number(ad.rating_average || 0).toFixed(1)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  title: { marginTop: 5, color: COLORS.text, fontSize: 27, fontWeight: '800' },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  summary: { padding: 18, borderRadius: 18, backgroundColor: COLORS.primary },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)' },
  summaryTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  summaryCaption: { marginTop: 3, color: 'rgba(255,255,255,0.75)', fontSize: 11.5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  stat: { flex: 1 },
  statValue: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  statLabel: { marginTop: 2, color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  statDivider: { width: 1, height: 34, marginHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.2)' },
  featureRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  featureIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EAF3EA' },
  featureTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  featureDescription: { marginTop: 3, color: COLORS.muted, fontSize: 11.5, lineHeight: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  sectionLink: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  emptyState: { minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: COLORS.surface },
  emptyText: { padding: 14, color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  adRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.faint },
  statusDotActive: { backgroundColor: COLORS.primary },
  adTitle: { color: COLORS.text, fontSize: 12.5, fontWeight: '700' },
  adMeta: { marginTop: 3, color: COLORS.muted, fontSize: 10.5 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
});