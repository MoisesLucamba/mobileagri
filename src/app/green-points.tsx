import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  InteractionManager,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import Icon from '../components/Icon';
import ProcessingScreen from '../components/ProcessingScreen';
import { isAgrilinkAdmin } from '../lib/agrilinkAds';
import { supabase } from '../lib/supabase';

type GreenPoint = {
  id: string;
  name: string;
  province: string;
  municipality: string;
  address: string;
  phone: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

type GreenProduct = {
  id: string;
  point_id: string;
  product_name: string;
  description: string | null;
  unit: string;
  price: number;
  market_price: number;
  stock_quantity: number;
  image_url: string | null;
  is_available: boolean;
};

type GreenOrder = {
  id: string;
  point_id: string;
  buyer_id: string;
  pickup_date: string;
  status: string;
  total_amount: number;
  created_at: string;
};

const COLORS = {
  primary: '#218B4A',
  text: '#16231C',
  muted: '#78877D',
  border: '#E8ECE6',
  canvas: '#F3F6F2',
  white: '#FFFEFC',
  orange: '#B9741A',
  danger: '#B54747',
};

const PRODUCT_CATALOG = [
  { name: 'Milho', unit: 'kg', image: '🌽', color: '#FFF5D7' },
  { name: 'Feijão', unit: 'kg', image: '🫘', color: '#F7E8DE' },
  { name: 'Mandioca', unit: 'kg', image: '🍠', color: '#F8EDE1' },
  { name: 'Batata-doce', unit: 'kg', image: '🍠', color: '#F8EDE1' },
  { name: 'Batata rena', unit: 'kg', image: '🥔', color: '#F4EBDD' },
  { name: 'Arroz', unit: 'kg', image: '🍚', color: '#F3F1E8' },
  { name: 'Tomate', unit: 'kg', image: '🍅', color: '#FCE6E1' },
  { name: 'Cebola', unit: 'kg', image: '🧅', color: '#F5E8D9' },
  { name: 'Couve', unit: 'kg', image: '🥬', color: '#E5F2E5' },
  { name: 'Repolho', unit: 'unidade', image: '🥬', color: '#E5F2E5' },
  { name: 'Cenoura', unit: 'kg', image: '🥕', color: '#FCEBDD' },
  { name: 'Banana', unit: 'kg', image: '🍌', color: '#FFF5D7' },
  { name: 'Laranja', unit: 'kg', image: '🍊', color: '#FCEBDD' },
  { name: 'Manga', unit: 'kg', image: '🥭', color: '#FFF0D6' },
  { name: 'Abacate', unit: 'unidade', image: '🥑', color: '#E5F2E5' },
  { name: 'Amendoim', unit: 'kg', image: '🥜', color: '#F5E8D9' },
] as const;
const CUSTOM_PRODUCT = '__custom__';
const GREEN_PRODUCT_BUCKET = 'green-point-products';
const ANGOLA_MAP_REGION = {
  latitude: -8.839,
  longitude: 13.234,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

function pickupDateString(dayOffset: 0 | 1) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: 'year' | 'month' | 'day') => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day') + dayOffset))
    .toISOString()
    .slice(0, 10);
}

export default function GreenPointsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [points, setPoints] = useState<GreenPoint[]>([]);
  const [products, setProducts] = useState<GreenProduct[]>([]);
  const [orders, setOrders] = useState<GreenOrder[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<GreenProduct | null>(null);
  const [editingProduct, setEditingProduct] = useState<GreenProduct | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editMarketPrice, setEditMarketPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [pickupDate, setPickupDate] = useState<'today' | 'tomorrow'>('today');
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingPointLocation, setEditingPointLocation] = useState<GreenPoint | null>(null);
  const [locationDraft, setLocationDraft] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savingPointLocation, setSavingPointLocation] = useState(false);

  const [pointName, setPointName] = useState('');
  const [province, setProvince] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pointLocation, setPointLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState('');
  const [selectedInventoryPointId, setSelectedInventoryPointId] = useState('');
  const [openAdminSelector, setOpenAdminSelector] = useState<'point' | 'product' | null>(null);
  const [customProductImage, setCustomProductImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [marketPrice, setMarketPrice] = useState('');
  const [stock, setStock] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [{ data: auth }, allowed] = await Promise.all([
        supabase.auth.getUser(),
        isAgrilinkAdmin(),
      ]);
      const activeUserId = auth.user?.id ?? null;
      setUserId(activeUserId);
      setAdmin(allowed);

      const [pointResult, productResult, orderResult] = await Promise.all([
        supabase.from('green_points').select('*').eq('is_active', true).order('name'),
        allowed
          ? supabase.from('green_point_products').select('*').order('product_name')
          : supabase.from('green_point_products').select('*').eq('is_available', true).gt('stock_quantity', 0).order('product_name'),
        activeUserId
          ? supabase.from('green_point_orders').select('*').order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (pointResult.error) throw pointResult.error;
      if (productResult.error) throw productResult.error;
      if (orderResult.error) throw orderResult.error;
      setPoints(pointResult.data ?? []);
      setProducts(productResult.data ?? []);
      setOrders((orderResult.data ?? []) as GreenOrder[]);
    } catch (loadError) {
      console.error('[GreenPoints] Falha ao carregar pontos verdes:', loadError);
      setError(loadError instanceof Error ? loadError.message : t('greenPoints.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });
    return () => task.cancel();
  }, [refresh]);

  const createPoint = async () => {
    if (!pointName.trim() || !province.trim() || !municipality.trim() || !address.trim() || !pointLocation) {
      Alert.alert(t('greenPoints.adminTitle'), t('greenPoints.pointFieldsRequired'));
      return;
    }
    setSavingAdmin(true);
    try {
      const { error: insertError } = await supabase.from('green_points').insert({
        name: pointName.trim(),
        province: province.trim(),
        municipality: municipality.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        location_lat: pointLocation.latitude,
        location_lng: pointLocation.longitude,
      });
      if (insertError) throw insertError;
      setPointName('');
      setProvince('');
      setMunicipality('');
      setAddress('');
      setPhone('');
      setPointLocation(null);
      await refresh();
    } catch (error) {
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingAdmin(false);
    }
  };

  const savePointLocation = async () => {
    if (!editingPointLocation || !locationDraft) return;
    setSavingPointLocation(true);
    try {
      const { error: updateError } = await supabase
        .from('green_points')
        .update({
          location_lat: locationDraft.latitude,
          location_lng: locationDraft.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPointLocation.id);
      if (updateError) throw updateError;
      setEditingPointLocation(null);
      setLocationDraft(null);
      await refresh();
    } catch (error) {
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingPointLocation(false);
    }
  };

  const beginEditProduct = (product: GreenProduct) => {
    setEditingProduct(product);
    setEditPrice(String(product.price));
    setEditMarketPrice(String(product.market_price));
    setEditStock(String(product.stock_quantity));
  };

  const saveProductEdits = async () => {
    if (!editingProduct) return;
    const nextPrice = Number(editPrice);
    const nextMarketPrice = Number(editMarketPrice);
    const nextStock = Number(editStock);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0 ||
        !Number.isFinite(nextMarketPrice) || nextMarketPrice <= nextPrice ||
        !Number.isFinite(nextStock) || nextStock < 0) {
      Alert.alert(t('greenPoints.errorTitle'), t('greenPoints.productFieldsRequired'));
      return;
    }

    setSavingAdmin(true);
    try {
      const { error: updateError } = await supabase
        .from('green_point_products')
        .update({
          price: nextPrice,
          market_price: nextMarketPrice,
          stock_quantity: nextStock,
          is_available: editingProduct.is_available,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProduct.id);
      if (updateError) throw updateError;
      setEditingProduct(null);
      await refresh();
    } catch (error) {
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingAdmin(false);
    }
  };

  const setProductAvailability = (product: GreenProduct, isAvailable: boolean) => {
    Alert.alert(
      isAvailable ? t('greenPoints.restoreProduct') : t('greenPoints.removeProduct'),
      isAvailable
        ? t('greenPoints.restoreProductConfirmation', { product: product.product_name })
        : t('greenPoints.removeProductConfirmation', { product: product.product_name }),
      [
        { text: t('greenPoints.cancel'), style: 'cancel' },
        {
          text: isAvailable ? t('greenPoints.restoreProduct') : t('greenPoints.removeProduct'),
          style: isAvailable ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setSavingAdmin(true);
              try {
                const { error: updateError } = await supabase
                  .from('green_point_products')
                  .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
                  .eq('id', product.id);
                if (updateError) throw updateError;
                await refresh();
              } catch (error) {
                Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
              } finally {
                setSavingAdmin(false);
              }
            })();
          },
        },
      ],
    );
  };

  const createProduct = async () => {
    const itemPrice = Number(price);
    const market = marketPrice.trim() ? Number(marketPrice) : null;
    const stockAmount = Number(stock);
    const customProduct = selectedCatalogProduct === CUSTOM_PRODUCT;
    if (!points.some((point) => point.id === selectedInventoryPointId) ||
        (!customProduct && !PRODUCT_CATALOG.some((product) => product.name === selectedCatalogProduct)) ||
        (customProduct && !itemName.trim()) ||
        !Number.isFinite(itemPrice) || itemPrice <= 0 ||
        !Number.isFinite(stockAmount) || stockAmount <= 0 ||
        market === null || !Number.isFinite(market) || market <= itemPrice) {
      Alert.alert(t('greenPoints.adminTitle'), t('greenPoints.productFieldsRequired'));
      return;
    }
    if (!customProductImage) {
      Alert.alert(t('greenPoints.adminTitle'), t('greenPoints.uploadProductImageRequired'));
      return;
    }
    setSavingAdmin(true);
    let uploadedImagePath: string | null = null;
    try {
      let imageUrl: string | null = null;
      if (customProductImage) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error(t('greenPoints.imageUploadError'));

        const mimeType = customProductImage.mimeType ?? 'image/jpeg';
        const extensionByMimeType: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        };
        const extension = extensionByMimeType[mimeType];
        if (!extension) throw new Error(t('greenPoints.unsupportedImageFormat'));
        uploadedImagePath = `${user.id}/${Crypto.randomUUID()}.${extension}`;
        const response = await fetch(customProductImage.uri);
        if (!response.ok) throw new Error(t('greenPoints.imageUploadError'));
        const imageData = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(GREEN_PRODUCT_BUCKET)
          .upload(uploadedImagePath, imageData, {
            contentType: mimeType,
          });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from(GREEN_PRODUCT_BUCKET).getPublicUrl(uploadedImagePath).data.publicUrl;
      }

      const catalogProduct = PRODUCT_CATALOG.find((product) => product.name === selectedCatalogProduct);
      const { error: insertError } = await supabase.from('green_point_products').insert({
        point_id: selectedInventoryPointId,
        product_name: customProduct ? itemName.trim() : catalogProduct!.name,
        description: itemDescription.trim() || null,
        unit: unit.trim() || catalogProduct?.unit || 'kg',
        price: itemPrice,
        market_price: market,
        stock_quantity: stockAmount,
        image_url: imageUrl,
      });
      if (insertError) throw insertError;
      uploadedImagePath = null;
      setItemName('');
      setItemDescription('');
      setSelectedCatalogProduct('');
      setSelectedInventoryPointId('');
      setCustomProductImage(null);
      setUnit('kg');
      setPrice('');
      setMarketPrice('');
      setStock('');
      await refresh();
    } catch (error) {
      if (uploadedImagePath) {
        try {
          const { error: cleanupError } = await supabase.storage.from(GREEN_PRODUCT_BUCKET).remove([uploadedImagePath]);
          if (cleanupError) console.warn('[GreenPoints] Não foi possível remover a foto não utilizada:', cleanupError);
        } catch (cleanupError) {
          console.warn('[GreenPoints] Não foi possível remover a foto não utilizada:', cleanupError);
        }
      }
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingAdmin(false);
    }
  };

  const pickCustomProductImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('greenPoints.adminTitle'), t('greenPoints.imagePermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled) setCustomProductImage(result.assets[0]);
  };

  const adjustStock = async (product: GreenProduct, increase: boolean) => {
    const nextStock = Math.max(0, Number(product.stock_quantity) + (increase ? 10 : -10));
    try {
      const { error: updateError } = await supabase
        .from('green_point_products')
        .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
        .eq('id', product.id);
      if (updateError) throw updateError;
      await refresh();
    } catch (error) {
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    }
  };

  const submitOrder = async () => {
    if (!selectedProduct || !userId) {
      setSelectedProduct(null);
      router.push('/login');
      return;
    }
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(selectedProduct.stock_quantity)) {
      Alert.alert(t('greenPoints.errorTitle'), t('greenPoints.invalidQuantity'));
      return;
    }
    const pickup = pickupDateString(pickupDate === 'tomorrow' ? 1 : 0);
    setSavingOrder(true);
    try {
      const { data, error: orderError } = await supabase.rpc('create_green_point_order', {
        p_point_id: selectedProduct.point_id,
        p_product_id: selectedProduct.id,
        p_quantity: amount,
        p_pickup_date: pickup,
      });
      if (orderError) throw orderError;
      setSelectedProduct(null);
      setQuantity('1');
      await refresh();
      Alert.alert(
        t('greenPoints.orderCreated'),
        t('greenPoints.orderCreatedDescription', {
          id: String(data?.id ?? '').slice(0, 8),
          date: pickup,
        }),
      );
    } catch (orderError) {
      console.error('[GreenPoints] Não foi possível reservar o pedido:', orderError);
      Alert.alert(t('greenPoints.errorTitle'), orderError instanceof Error ? orderError.message : t('greenPoints.orderError'));
    } finally {
      setSavingOrder(false);
    }
  };

  const updateOrderStatus = async (order: GreenOrder, nextStatus: string) => {
    const { error: updateError } = await supabase.rpc('update_green_point_order_status', {
      p_order_id: order.id,
      p_status: nextStatus,
    });
    if (updateError) {
      Alert.alert(t('greenPoints.errorTitle'), updateError.message);
      return;
    }
    await refresh();
  };

  const pointById = new Map(points.map((point) => [point.id, point]));
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);

  if (loading) return <ProcessingScreen />;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 35 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refresh(); }} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/home')}>
            <Icon name="chevron-left" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t('greenPoints.eyebrow')}</Text>
            <Text style={styles.title}>{t('greenPoints.title')}</Text>
          </View>
          <View style={styles.headerMapIcon}>
            <Icon name="map" size={24} color={COLORS.primary} />
            <View style={styles.headerMapPin}><Icon name="pin" size={9} color={COLORS.white} /></View>
          </View>
        </View>
        <Text style={styles.intro}>{t('greenPoints.description')}</Text>
        <View style={styles.hint}>
          <Icon name="check-circle" size={18} color={COLORS.primary} />
          <Text style={styles.hintText}>{t('greenPoints.pickupPayment')}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {points.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="pin" size={26} color={COLORS.muted} />
            <Text style={styles.emptyText}>{t('greenPoints.noPoints')}</Text>
          </View>
        ) : points.map((point) => (
          <View key={point.id} style={styles.pointCard}>
            <View style={styles.pointHeading}>
              <View style={styles.pointIcon}>
                <Icon name="map" size={20} color={COLORS.primary} />
                <View style={styles.pointPin}><Icon name="pin" size={7} color={COLORS.white} /></View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pointName}>{point.name}</Text>
                <Text style={styles.pointAddress}>{point.municipality}, {point.province} · {point.address}</Text>
                {point.phone ? <Text style={styles.pointAddress}>{point.phone}</Text> : null}
              </View>
              {admin ? (
                <TouchableOpacity
                  style={styles.locationEditButton}
                  onPress={() => {
                    setEditingPointLocation(point);
                    setLocationDraft(
                      point.location_lat != null && point.location_lng != null
                        ? { latitude: point.location_lat, longitude: point.location_lng }
                        : null,
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('greenPoints.editPointLocation')}
                >
                  <Icon name="map" size={15} color={COLORS.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {point.location_lat != null && point.location_lng != null ? (
              <View style={styles.pointMapFrame}>
                <MapView
                  style={styles.pointMap}
                  initialRegion={{
                    latitude: point.location_lat,
                    longitude: point.location_lng,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  pointerEvents="none"
                >
                  <Marker coordinate={{ latitude: point.location_lat, longitude: point.location_lng }} pinColor={COLORS.primary} />
                </MapView>
                <View style={styles.mapCaption}>
                  <Icon name="pin" size={12} color={COLORS.primary} />
                  <Text style={styles.mapCaptionText}>Local de levantamento</Text>
                </View>
              </View>
            ) : null}
            {products.filter((product) => product.point_id === point.id).length === 0 ? (
              <Text style={styles.noProducts}>{t('greenPoints.noProducts')}</Text>
            ) : products.filter((product) => product.point_id === point.id).map((product) => (
              <View key={product.id} style={[styles.productCard, !product.is_available && styles.unavailableProduct]}>
                <View style={[styles.productArtwork, { backgroundColor: PRODUCT_CATALOG.find((item) => item.name.toLocaleLowerCase() === product.product_name.toLocaleLowerCase())?.color ?? '#E9F5EC' }]}>
                  {product.image_url ? (
                    <Image source={{ uri: product.image_url }} style={styles.productImage} />
                  ) : (
                    <Text style={styles.productEmoji}>
                      {PRODUCT_CATALOG.find((item) => item.name.toLocaleLowerCase() === product.product_name.toLocaleLowerCase())?.image ?? '🧺'}
                    </Text>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.product_name}</Text>
                    {!product.is_available ? <Text style={styles.unavailableLabel}>{t('greenPoints.productUnavailable')}</Text> : null}
                    <Text style={styles.productDetails}>
                      {money(Number(product.price))} / {product.unit} · {t('greenPoints.stock')}: {money(Number(product.stock_quantity))} {product.unit}
                    </Text>
                    {product.market_price ? (
                      <Text style={styles.savings}>{t('greenPoints.belowMarket', { percent: Math.round((1 - Number(product.price) / Number(product.market_price)) * 100) })}</Text>
                    ) : null}
                  </View>
                  <View style={styles.productActions}>
                    {admin ? (
                      <>
                        <TouchableOpacity
                          style={styles.stockButton}
                          onPress={() => setProductAvailability(product, !product.is_available)}
                          accessibilityLabel={product.is_available ? t('greenPoints.removeProduct') : t('greenPoints.restoreProduct')}
                        >
                          <Icon name={product.is_available ? 'trash' : 'refresh'} size={14} color={product.is_available ? COLORS.danger : COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.stockButton} onPress={() => beginEditProduct(product)} accessibilityLabel={t('greenPoints.editProduct')}>
                          <Icon name="edit" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                        <View style={styles.stockActions}>
                          <TouchableOpacity style={styles.stockButton} onPress={() => void adjustStock(product, false)} accessibilityLabel={t('greenPoints.reduceStock')}>
                            <Icon name="minus" size={14} color={COLORS.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.stockButton} onPress={() => void adjustStock(product, true)} accessibilityLabel={t('greenPoints.increaseStock')}>
                            <Icon name="plus" size={14} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : null}
                    {product.is_available ? (
                      <TouchableOpacity style={styles.orderButton} onPress={() => { setSelectedProduct(product); setQuantity('1'); }}>
                        <Text style={styles.orderButtonText}>{t('greenPoints.order')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}

        {admin ? (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>{t('greenPoints.adminTitle')}</Text>
            <Text style={styles.caption}>{t('greenPoints.adminDescription')}</Text>
            <TextInput style={styles.input} value={pointName} onChangeText={setPointName} placeholder={t('greenPoints.pointName')} />
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, styles.halfInput]} value={province} onChangeText={setProvince} placeholder={t('greenPoints.province')} />
              <TextInput style={[styles.input, styles.halfInput]} value={municipality} onChangeText={setMunicipality} placeholder={t('greenPoints.municipality')} />
            </View>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder={t('greenPoints.address')} />
              <Text style={styles.label}>{t('greenPoints.locationMapTitle')}</Text>
              <Text style={styles.caption}>{t('greenPoints.locationMapHint')}</Text>
              <View style={styles.locationPicker}>
                <MapView
                  style={styles.locationMap}
                  initialRegion={ANGOLA_MAP_REGION}
                  onPress={(event) => setPointLocation(event.nativeEvent.coordinate)}
                >
                  {pointLocation ? <Marker coordinate={pointLocation} pinColor={COLORS.primary} /> : null}
                </MapView>
                {!pointLocation ? (
                  <View pointerEvents="none" style={styles.mapPickerHint}>
                    <Icon name="pin" size={15} color={COLORS.primary} />
                    <Text style={styles.mapPickerHintText}>Toque para marcar</Text>
                  </View>
                ) : (
                  <View style={styles.mapPickerSelected}>
                    <Icon name="check" size={13} color={COLORS.white} />
                    <Text style={styles.mapPickerSelectedText}>
                      {pointLocation.latitude.toFixed(5)}, {pointLocation.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}
              </View>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t('greenPoints.phone')} keyboardType="phone-pad" />
            <TouchableOpacity style={styles.adminButton} onPress={createPoint} disabled={savingAdmin}>
              <Text style={styles.adminButtonText}>{savingAdmin ? t('greenPoints.saving') : t('greenPoints.createPoint')}</Text>
            </TouchableOpacity>

            <View style={styles.inventoryCard}>
              <Text style={styles.pointName}>{t('greenPoints.addInventoryTitle')}</Text>
              {points.length === 0 ? (
                <Text style={styles.caption}>{t('greenPoints.createPointFirst')}</Text>
              ) : (
                <>
                  <Text style={styles.label}>{t('greenPoints.selectPoint')}</Text>
                  <TouchableOpacity
                    style={styles.selectorButton}
                    onPress={() => setOpenAdminSelector('point')}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.selectorText, !selectedInventoryPointId && styles.selectorPlaceholder]}>
                      {points.find((point) => point.id === selectedInventoryPointId)?.name ?? t('greenPoints.selectPoint')}
                    </Text>
                    <Icon name="chevron-down" size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                  <Text style={styles.label}>{t('greenPoints.productName')}</Text>
                  <TouchableOpacity
                    style={styles.selectorButton}
                    onPress={() => setOpenAdminSelector('product')}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.selectorText, !selectedCatalogProduct && styles.selectorPlaceholder]}>
                      {selectedCatalogProduct === CUSTOM_PRODUCT
                        ? t('greenPoints.otherProduct')
                        : PRODUCT_CATALOG.find((product) => product.name === selectedCatalogProduct)?.name ?? t('greenPoints.selectProduct')}
                    </Text>
                    <Icon name="chevron-down" size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                  {selectedCatalogProduct ? (
                    <>
                      {selectedCatalogProduct === CUSTOM_PRODUCT ? (
                      <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder={t('greenPoints.productName')} />
                      ) : null}
                      <TouchableOpacity style={styles.photoButton} onPress={() => void pickCustomProductImage()}>
                        {customProductImage ? (
                          <Image source={{ uri: customProductImage.uri }} style={styles.photoPreview} />
                        ) : (
                          <View style={styles.photoPlaceholder}>
                            <Text style={styles.selectedProductEmoji}>
                              {selectedCatalogProduct === CUSTOM_PRODUCT
                                ? '🧺'
                                : PRODUCT_CATALOG.find((product) => product.name === selectedCatalogProduct)?.image}
                            </Text>
                            <Text style={styles.photoButtonText}>{t('greenPoints.builtInImage')}</Text>
                          </View>
                        )}
                        <Text style={styles.photoButtonText}>
                          {customProductImage ? t('greenPoints.changePhoto') : t('greenPoints.addPhoto')}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.caption}>{t('greenPoints.uploadProductImageRequired')}</Text>
                    </>
                  ) : null}
                  <TextInput style={styles.input} value={itemDescription} onChangeText={setItemDescription} placeholder={t('greenPoints.productDescription')} />
                  <View style={styles.inputRow}>
                    <TextInput style={[styles.input, styles.thirdInput]} value={price} onChangeText={setPrice} placeholder={t('greenPoints.price')} keyboardType="decimal-pad" />
                    <TextInput style={[styles.input, styles.thirdInput]} value={marketPrice} onChangeText={setMarketPrice} placeholder={t('greenPoints.marketPrice')} keyboardType="decimal-pad" />
                    <TextInput style={[styles.input, styles.thirdInput]} value={stock} onChangeText={setStock} placeholder={t('greenPoints.stock')} keyboardType="decimal-pad" />
                  </View>
                  <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder={t('greenPoints.unit')} />
                  <TouchableOpacity style={styles.adminButton} onPress={() => void createProduct()} disabled={savingAdmin}>
                    <Text style={styles.adminButtonText}>{savingAdmin ? t('greenPoints.saving') : t('greenPoints.addProduct')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ) : null}

        {userId ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('greenPoints.myOrders')}</Text>
            {orders.filter((order) => admin || order.buyer_id === userId).length === 0 ? (
              <Text style={styles.noProducts}>{t('greenPoints.noOrders')}</Text>
            ) : orders.filter((order) => admin || order.buyer_id === userId).map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{pointById.get(order.point_id)?.name ?? t('greenPoints.title')}</Text>
                  <Text style={styles.productDetails}>{order.pickup_date} · {t(`greenPoints.status.${order.status}`, { defaultValue: order.status })} · {money(Number(order.total_amount))} Kz</Text>
                  {admin ? <Text style={styles.productDetails}>{order.buyer_id.slice(0, 8)} · {order.id.slice(0, 8)}</Text> : null}
                </View>
                {admin && order.status === 'reserved' ? (
                  <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.smallAction} onPress={() => void updateOrderStatus(order, 'confirmed')}>
                      <Text style={styles.smallActionText}>{t('greenPoints.confirmPickup')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelOrderAction} onPress={() => void updateOrderStatus(order, 'cancelled')}>
                      <Text style={styles.cancelOrderText}>{t('greenPoints.cancelOrder')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {admin && order.status === 'confirmed' ? (
                  <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.smallAction} onPress={() => void updateOrderStatus(order, 'ready')}>
                      <Text style={styles.smallActionText}>{t('greenPoints.markReady')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelOrderAction} onPress={() => void updateOrderStatus(order, 'cancelled')}>
                      <Text style={styles.cancelOrderText}>{t('greenPoints.cancelOrder')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {admin && order.status === 'ready' ? (
                  <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.smallAction} onPress={() => void updateOrderStatus(order, 'picked_up')}>
                      <Text style={styles.smallActionText}>{t('greenPoints.markPickedUp')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelOrderAction} onPress={() => void updateOrderStatus(order, 'cancelled')}>
                      <Text style={styles.cancelOrderText}>{t('greenPoints.cancelOrder')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={openAdminSelector !== null} transparent animationType="fade" onRequestClose={() => setOpenAdminSelector(null)}>
        <View style={styles.selectorBackdrop}>
          <View style={styles.selectorModal}>
            <Text style={styles.sectionTitle}>
              {openAdminSelector === 'point' ? t('greenPoints.selectPoint') : t('greenPoints.selectProduct')}
            </Text>
            <ScrollView style={styles.selectorOptions} keyboardShouldPersistTaps="handled">
              {openAdminSelector === 'point'
                ? points.map((point) => (
                  <TouchableOpacity
                    key={point.id}
                    style={styles.selectorOption}
                    onPress={() => {
                      setSelectedInventoryPointId(point.id);
                      setOpenAdminSelector(null);
                    }}
                  >
                    <Text style={styles.selectorText}>{point.name}</Text>
                  </TouchableOpacity>
                ))
                : (
                  <>
                    {PRODUCT_CATALOG.map((product) => (
                      <TouchableOpacity
                        key={product.name}
                        style={styles.selectorOption}
                        onPress={() => {
                          setSelectedCatalogProduct(product.name);
                          setCustomProductImage(null);
                          setItemName(product.name);
                          setUnit(product.unit);
                          setOpenAdminSelector(null);
                        }}
                      >
                        <Text style={styles.selectorOptionEmoji}>{product.image}</Text>
                        <Text style={styles.selectorText}>{product.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.selectorOption}
                      onPress={() => {
                        setSelectedCatalogProduct(CUSTOM_PRODUCT);
                        setCustomProductImage(null);
                        setItemName('');
                        setUnit('kg');
                        setOpenAdminSelector(null);
                      }}
                    >
                      <Text style={styles.selectorOptionEmoji}>＋</Text>
                      <Text style={styles.selectorText}>{t('greenPoints.otherProduct')}</Text>
                    </TouchableOpacity>
                  </>
                )}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setOpenAdminSelector(null)}>
              <Text style={styles.cancelText}>{t('greenPoints.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!editingPointLocation}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPointLocation(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.sectionTitle}>{t('greenPoints.editPointLocation')}</Text>
            {editingPointLocation ? (
              <>
                <Text style={styles.caption}>{editingPointLocation.name} · {t('greenPoints.locationMapHint')}</Text>
                <View style={styles.editLocationMapFrame}>
                  <MapView
                    style={styles.locationMap}
                    initialRegion={
                      locationDraft
                        ? {
                            ...locationDraft,
                            latitudeDelta: 0.012,
                            longitudeDelta: 0.012,
                          }
                        : ANGOLA_MAP_REGION
                    }
                    onPress={(event) => setLocationDraft(event.nativeEvent.coordinate)}
                  >
                    {locationDraft ? <Marker coordinate={locationDraft} pinColor={COLORS.primary} /> : null}
                  </MapView>
                </View>
                <TouchableOpacity
                  style={[styles.adminButton, !locationDraft && styles.disabledButton]}
                  onPress={() => void savePointLocation()}
                  disabled={!locationDraft || savingPointLocation}
                >
                  <Text style={styles.adminButtonText}>
                    {savingPointLocation ? t('greenPoints.saving') : t('greenPoints.savePointLocation')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditingPointLocation(null);
                setLocationDraft(null);
              }}
            >
              <Text style={styles.cancelText}>{t('greenPoints.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingProduct} transparent animationType="slide" onRequestClose={() => setEditingProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.sectionTitle}>{t('greenPoints.editProduct')}</Text>
            {editingProduct ? (
              <>
                <Text style={styles.productName}>{editingProduct.product_name}</Text>
                <Text style={styles.label}>{t('greenPoints.price')}</Text>
                <TextInput style={styles.input} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" />
                <Text style={styles.label}>{t('greenPoints.marketPrice')}</Text>
                <TextInput style={styles.input} value={editMarketPrice} onChangeText={setEditMarketPrice} keyboardType="decimal-pad" />
                <Text style={styles.label}>{t('greenPoints.stock')}</Text>
                <TextInput style={styles.input} value={editStock} onChangeText={setEditStock} keyboardType="decimal-pad" />
                <TouchableOpacity style={styles.adminButton} onPress={() => void saveProductEdits()} disabled={savingAdmin}>
                  <Text style={styles.adminButtonText}>{savingAdmin ? t('greenPoints.saving') : t('greenPoints.saveProduct')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingProduct(null)}>
              <Text style={styles.cancelText}>{t('greenPoints.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedProduct} transparent animationType="slide" onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.sectionTitle}>{t('greenPoints.confirmOrder')}</Text>
            {selectedProduct ? (
              <>
                <Text style={styles.productName}>{selectedProduct.product_name}</Text>
                <Text style={styles.productDetails}>{t('greenPoints.total')}: {money(Number(selectedProduct.price) * Number(quantity || 0))} Kz</Text>
                <Text style={styles.label}>{t('greenPoints.quantity')}</Text>
                <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
                <Text style={styles.label}>{t('greenPoints.pickupDate')}</Text>
                <View style={styles.inputRow}>
                  {(['today', 'tomorrow'] as const).map((day) => (
                    <TouchableOpacity key={day} style={[styles.dateButton, pickupDate === day && styles.dateButtonActive]} onPress={() => setPickupDate(day)}>
                      <Text style={[styles.dateButtonText, pickupDate === day && styles.dateButtonTextActive]}>{t(`greenPoints.${day}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.productDetails}>{t('greenPoints.paymentAtPoint')}</Text>
                <TouchableOpacity style={styles.adminButton} onPress={() => void submitOrder()} disabled={savingOrder}>
                  <Text style={styles.adminButtonText}>{savingOrder ? t('greenPoints.saving') : userId ? t('greenPoints.confirmReservation') : t('greenPoints.loginToOrder')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedProduct(null)}>
              <Text style={styles.cancelText}>{t('greenPoints.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  headerMapIcon: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E9F5EC' },
  headerMapPin: { position: 'absolute', top: 1, right: 1, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: COLORS.primary },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.white },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { marginTop: 3, color: COLORS.text, fontSize: 23, fontWeight: '800' },
  intro: { marginBottom: 13, color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#E9F5EC' },
  hintText: { flex: 1, color: COLORS.primary, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  error: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FCECEC', color: COLORS.danger, fontSize: 12 },
  empty: { marginTop: 16, minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, borderRadius: 14, backgroundColor: COLORS.white },
  emptyText: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  pointCard: { marginTop: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, backgroundColor: COLORS.white },
  pointHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 },
  pointIcon: { position: 'relative', width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E9F5EC' },
  pointPin: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: COLORS.primary },
  locationEditButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#E9F5EC' },
  pointMapFrame: { height: 145, marginBottom: 12, borderRadius: 11, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  pointMap: { flex: 1 },
  mapCaption: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.white },
  mapCaptionText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  pointName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  pointAddress: { marginTop: 3, color: COLORS.muted, fontSize: 11, lineHeight: 15 },
  noProducts: { paddingVertical: 12, color: COLORS.muted, fontSize: 11 },
  productCard: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  unavailableProduct: { opacity: 0.65 },
  productArtwork: { width: '100%', height: 190, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productEmoji: { fontSize: 76 },
  productInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 11 },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productName: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  unavailableLabel: { marginTop: 3, color: COLORS.danger, fontSize: 10, fontWeight: '700' },
  productDetails: { marginTop: 4, color: COLORS.muted, fontSize: 10.5, lineHeight: 15 },
  savings: { marginTop: 4, color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  orderButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.primary },
  orderButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  stockActions: { flexDirection: 'row', gap: 5 },
  stockButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#E9F5EC' },
  adminSection: { marginTop: 20, padding: 14, borderWidth: 1, borderColor: '#CFE9D6', borderRadius: 15, backgroundColor: COLORS.white },
  section: { marginTop: 20 },
  sectionTitle: { marginBottom: 8, color: COLORS.text, fontSize: 16, fontWeight: '800' },
  caption: { marginBottom: 8, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 43, marginTop: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.canvas, color: COLORS.text, fontSize: 12 },
  locationPicker: { height: 210, marginTop: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, overflow: 'hidden' },
  locationMap: { flex: 1 },
  mapPickerHint: { position: 'absolute', alignSelf: 'center', top: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: COLORS.white },
  mapPickerHintText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  mapPickerSelected: { position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: COLORS.primary },
  mapPickerSelectedText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  thirdInput: { flex: 1, minWidth: 0 },
  adminButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: COLORS.primary },
  adminButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  inventoryCard: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  selectorButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.canvas },
  selectorText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  selectorPlaceholder: { color: COLORS.muted, fontWeight: '400' },
  selectedProductEmoji: { fontSize: 28 },
  photoButton: { minHeight: 120, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.canvas, overflow: 'hidden' },
  photoPlaceholder: { alignItems: 'center', gap: 6 },
  photoButtonText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  customImagePreview: { width: 32, height: 32, borderRadius: 6 },
  photoPreview: { width: '100%', height: 120, position: 'absolute' },
  selectorBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15,20,17,0.48)' },
  selectorModal: { maxHeight: '75%', padding: 18, borderRadius: 16, backgroundColor: COLORS.white },
  selectorOptions: { flexGrow: 0 },
  selectorOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  selectorOptionEmoji: { width: 30, fontSize: 21, textAlign: 'center' },
  orderRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  smallAction: { padding: 9, borderRadius: 9, backgroundColor: '#E9F5EC' },
  smallActionText: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  orderActions: { alignItems: 'flex-end', gap: 5 },
  cancelOrderAction: { padding: 7 },
  cancelOrderText: { color: COLORS.danger, fontSize: 9, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,20,17,0.48)' },
  modalCard: { paddingHorizontal: 20, paddingTop: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: COLORS.white },
  modalHandle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: COLORS.border },
  editLocationMapFrame: { height: 280, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, overflow: 'hidden' },
  disabledButton: { opacity: 0.55 },
  label: { marginTop: 14, color: COLORS.text, fontSize: 11, fontWeight: '700' },
  dateButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  dateButtonActive: { borderColor: COLORS.primary, backgroundColor: '#E9F5EC' },
  dateButtonText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  dateButtonTextActive: { color: COLORS.primary },
  cancelButton: { alignItems: 'center', padding: 13 },
  cancelText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
});
