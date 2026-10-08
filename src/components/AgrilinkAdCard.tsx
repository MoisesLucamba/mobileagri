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
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#EAE4D6',
  gold: '#D79427',
  surface: '#FFFFFF',
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
          <Icon name="star" size={16} color={COLORS.primary} filled />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>AgriLink</Text>
          <Text style={styles.sponsored}>PUBLICIDADE</Text>
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
        <View style={styles.imageCount}>
          <Text style={styles.imageCountText}>{imageIndex + 1}/{ad.image_urls.length}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.description}>{ad.description}</Text>

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
  card: { width: CARD_WIDTH, alignSelf: 'center', marginBottom: 18, overflow: 'hidden', borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  brandIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EAF3EA' },
  brand: { color: COLORS.text, fontSize: 12.5, fontWeight: '800' },
  sponsored: { marginTop: 2, color: COLORS.muted, fontSize: 8.5, fontWeight: '800' },
  linkIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F1EFE8' },
  imageFrame: { width: CARD_WIDTH, height: 218, backgroundColor: '#F1EFE8' },
  image: { width: CARD_WIDTH, height: 218 },
  imageCount: { position: 'absolute', right: 10, bottom: 10, minWidth: 40, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 10, backgroundColor: 'rgba(22,35,28,0.72)' },
  imageCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  body: { padding: 14 },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  description: { marginTop: 5, color: COLORS.muted, fontSize: 12.5, lineHeight: 18 },
  ratingRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: COLORS.muted, fontSize: 10.5 },
  openButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 9, borderRadius: 11, backgroundColor: COLORS.primary },
  openButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
});