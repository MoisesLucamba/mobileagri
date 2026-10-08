import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import ProcessingScreen from '../../components/ProcessingScreen';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../context/RoleContext';

type ProductDetails = {
  id: string;
  product_type: string;
  description: string | null;
  quantity: number;
  price: number;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  contact: string | null;
  photos: string[] | null;
};

const COLORS = {
  background: '#F6F8F5',
  surface: '#FFFFFF',
  primary: '#2E8B4F',
  text: '#16231C',
  muted: '#78877D',
  border: '#E8ECE6',
};

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useUserRole();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const invalidId = !id || !id.trim();

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError('');

      try {
        const { data, error: queryError } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (queryError) throw queryError;
        if (active) {
          if (!data) {
            setError('Este produto não foi encontrado ou já não está disponível.');
          } else {
            setProduct(data);
          }
        }
      } catch (loadError) {
        console.error('Não foi possível carregar o produto:', loadError);
        if (active) setError('Não foi possível carregar o produto. Verifique a ligação e tente novamente.');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) void loadProduct();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading && !invalidId) return <ProcessingScreen />;

  const photo = Array.isArray(product?.photos) ? product.photos.find((item) => typeof item === 'string') : undefined;
  const location = [product?.municipality_id, product?.province_id].filter(Boolean).join(', ');

  async function contactProducer() {
    if (!product?.contact) return;

    try {
      await Linking.openURL(`tel:${product.contact}`);
    } catch (contactError) {
      console.error('Não foi possível abrir o contacto do produtor:', contactError);
      Alert.alert('Contacto indisponível', 'Não foi possível iniciar a chamada neste dispositivo.');
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Voltar">
          <Icon name="chevron-left" size={21} color={COLORS.text} />
        </TouchableOpacity>

        {invalidId ? (
          <View style={styles.messageCard}>
            <Text style={styles.message}>Produto inválido.</Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.message}>{error}</Text>
          </View>
        ) : product ? (
          <>
            {photo ? <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" /> : null}
            <View style={styles.card}>
              <Text style={styles.title}>{product.product_type}</Text>
              <Text style={styles.price}>{Number(product.price || 0).toLocaleString('pt-AO')} Kz</Text>
              {!!product.description && <Text style={styles.description}>{product.description}</Text>}
              <View style={styles.divider} />
              <Text style={styles.label}>Quantidade disponível</Text>
              <Text style={styles.value}>{Number(product.quantity || 0).toLocaleString('pt-AO')}</Text>
              {!!location && (
                <>
                  <Text style={styles.label}>Localização</Text>
                  <Text style={styles.value}>{location}</Text>
                </>
              )}
              {!!product.farmer_name && (
                <>
                  <Text style={styles.label}>Produtor</Text>
                  <Text style={styles.value}>{product.farmer_name}</Text>
                </>
              )}
              {!!product.contact && !isGuest ? (
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => void contactProducer()}
                >
                  <Text style={styles.contactButtonText}>Contactar produtor</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 18, gap: 14 },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loader: { marginTop: 80 },
  messageCard: { padding: 20, borderRadius: 14, backgroundColor: COLORS.surface },
  message: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  photo: { width: '100%', height: 280, borderRadius: 16, backgroundColor: COLORS.border },
  card: { padding: 20, borderRadius: 16, backgroundColor: COLORS.surface },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  price: { marginTop: 8, color: COLORS.primary, fontSize: 21, fontWeight: '800' },
  description: { marginTop: 12, color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  divider: { height: 1, marginVertical: 18, backgroundColor: COLORS.border },
  label: { marginTop: 12, color: COLORS.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { marginTop: 4, color: COLORS.text, fontSize: 16, fontWeight: '600' },
  contactButton: {
    marginTop: 22,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  contactButtonText: { color: COLORS.surface, fontSize: 15, fontWeight: '700' },
});
