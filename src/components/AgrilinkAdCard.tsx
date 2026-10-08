import { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AgrilinkAd } from '../lib/agrilinkAds';
import Icon from './Icon';

const COLORS = {
  primary: '#1F6B3A',
  primarySoft: '#EAF3EA',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#E9E2D3',
  gold: '#D79427',
  goldSoft: '#FBF1E1',
  surface: '#FFFFFF',
  canvas: '#FFFCF6',
};

const CARD_WIDTH = Dimensions.get('window').width - 36;

type Props = {
  ad: AgrilinkAd;
  currentUserId: string | null;
  onRequireLogin: () => void;
  onRate: (adId: string, rating: number) => Promise<void>;
};

export default function AgrilinkAdCard({ ad, currentUserId, onRequireLogin, onRate }: Props) {
  const [ratingBusy, setRatingBusy] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const currentRating = Number(ad.current_rating || 0);
  const filledStars = currentRating || Math.round(Number(ad.rating_average || 0));
  const targetHost = (() => {
    try {
      return new URL(ad.target_url).hostname.replace(/^www\./, '');
    } catch {
      return ad.target_url;
    }
  })();

  const openAd = () => {
    Linking.openURL(ad.target_url).catch(() => Alert.alert('Link indisponível', 'Não foi possível abrir este anúncio.'));
  };

  const selectRating = async (rating: number) => {
    if (!currentUserId) {
      onRequireLogin();
      return;
    }
    setRatingBusy(true);
    try {
      await onRate(ad.id, rating);
    } catch (error: any) {
      Alert.alert('Não foi possível avaliar', error?.message || 'Tente novamente.');
    } finally {
      setRatingBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.brandIcon}>
          <Icon name="image" size={16} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>AgriLink</Text>
          <Text style={styles.sponsored}>PROMOÇÃO PATROCINADA</Text>
        </View>
        <TouchableOpacity onPress={openAd} style={styles.linkIcon} accessibilityLabel="Abrir anúncio">
          <Icon name="arrow-right" size={17} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.imageFrame}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            setImageIndex(Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH));
          }}
        >
          {ad.image_urls.map((url, index) => (
            <Image key={`${ad.id}-${index}`} source={{ uri: url }} style={styles.image} resizeMode="cover" />
          ))}
        </ScrollView>
        <View style={styles.promoBadge}>
          <Text style={styles.promoBadgeText}>EM DESTAQUE</Text>
        </View>
        <View style={styles.imageCount}>
          <Text style={styles.imageCountText}>{imageIndex + 1}/{ad.image_urls.length}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.description}>{ad.description}</Text>
        <View style={styles.destination}>
          <Icon name="share" size={13} color={COLORS.muted} />
          <Text style={styles.destinationText} numberOfLines={1}>{targetHost}</Text>
        </View>

        <View style={styles.ratingRow}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => selectRating(star)}
                disabled={ratingBusy}
                hitSlop={5}
                accessibilityRole="button"
                accessibilityLabel={`Avaliar com ${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
              >
                <Icon name="star" size={21} filled={star <= filledStars} color={star <= filledStars ? COLORS.gold : COLORS.faint} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingText}>
            {ratingBusy ? 'A guardar avaliação…' : `${Number(ad.rating_average || 0).toFixed(1)} · ${ad.rating_count} ${ad.rating_count === 1 ? 'avaliação' : 'avaliações'}`}
          </Text>
        </View>

        <TouchableOpacity style={styles.openButton} activeOpacity={0.84} onPress={openAd}>
          <Text style={styles.openButtonText}>Abrir anúncio</Text>
          <Icon name="arrow-right" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    marginBottom: 18,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#604B20',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  brandIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.primarySoft },
  brand: { color: COLORS.text, fontSize: 12.5, fontWeight: '800' },
  sponsored: { marginTop: 3, color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.65 },
  linkIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.goldSoft },
  imageFrame: { width: CARD_WIDTH, height: 224, backgroundColor: '#F1EFE8' },
  image: { width: CARD_WIDTH, height: 224 },
  promoBadge: { position: 'absolute', left: 11, top: 11, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 7, backgroundColor: COLORS.gold },
  promoBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  imageCount: { position: 'absolute', right: 10, bottom: 10, minWidth: 40, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 10, backgroundColor: 'rgba(22,35,28,0.72)' },
  imageCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  body: { padding: 16 },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  description: { marginTop: 5, color: COLORS.muted, fontSize: 12.5, lineHeight: 18 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  destinationText: { flex: 1, color: COLORS.muted, fontSize: 10.5, fontWeight: '600' },
  ratingRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: COLORS.muted, fontSize: 10.5 },
  openButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 9, borderRadius: 13, backgroundColor: COLORS.primary },
  openButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
});