import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
  primary: '#25703F',
  text: '#16231C',
  muted: '#78877D',
  border: '#E8ECE6',
  canvas: '#F6F8F5',
  white: '#FFFFFF',
  orange: '#B9741A',
  danger: '#B54747',
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
  const [quantity, setQuantity] = useState('1');
  const [pickupDate, setPickupDate] = useState<'today' | 'tomorrow'>('today');
  const [savingOrder, setSavingOrder] = useState(false);

  const [pointName, setPointName] = useState('');
  const [province, setProvince] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
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
        supabase.from('green_point_products').select('*').eq('is_available', true).gt('stock_quantity', 0).order('product_name'),
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
    if (!pointName.trim() || !province.trim() || !municipality.trim() || !address.trim()) {
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
      });
      if (insertError) throw insertError;
      setPointName('');
      setProvince('');
      setMunicipality('');
      setAddress('');
      setPhone('');
      await refresh();
    } catch (error) {
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingAdmin(false);
    }
  };

  const createProduct = async (pointId: string) => {
    const itemPrice = Number(price);
    const market = marketPrice.trim() ? Number(marketPrice) : null;
    const stockAmount = Number(stock);
    if (!itemName.trim() || !Number.isFinite(itemPrice) || itemPrice <= 0 ||
        !Number.isFinite(stockAmount) || stockAmount <= 0 ||
        market === null || !Number.isFinite(market) || market <= itemPrice) {
      Alert.alert(t('greenPoints.adminTitle'), t('greenPoints.productFieldsRequired'));
      return;
    }
    setSavingAdmin(true);
    try {
      const { error: insertError } = await supabase.from('green_point_products').insert({
        point_id: pointId,
        product_name: itemName.trim(),
        description: itemDescription.trim() || null,
        unit: unit.trim() || 'kg',
        price: itemPrice,
        market_price: market,
        stock_quantity: stockAmount,
      });
      if (insertError) throw insertError;
      setItemName('');
      setItemDescription('');
      setPrice('');
      setMarketPrice('');
      setStock('');
      await refresh();
    } catch (error) {
      Alert.alert(t('greenPoints.errorTitle'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingAdmin(false);
    }
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
          <Icon name="sprout" size={25} color={COLORS.primary} />
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
              <View style={styles.pointIcon}><Icon name="pin" size={18} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pointName}>{point.name}</Text>
                <Text style={styles.pointAddress}>{point.municipality}, {point.province} · {point.address}</Text>
                {point.phone ? <Text style={styles.pointAddress}>{point.phone}</Text> : null}
              </View>
            </View>
            {products.filter((product) => product.point_id === point.id).length === 0 ? (
              <Text style={styles.noProducts}>{t('greenPoints.noProducts')}</Text>
            ) : products.filter((product) => product.point_id === point.id).map((product) => (
              <View key={product.id} style={styles.productRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{product.product_name}</Text>
                  <Text style={styles.productDetails}>
                    {money(Number(product.price))} / {product.unit} · {t('greenPoints.stock')}: {money(Number(product.stock_quantity))} {product.unit}
                  </Text>
                  {product.market_price ? (
                    <Text style={styles.savings}>{t('greenPoints.belowMarket', { percent: Math.round((1 - Number(product.price) / Number(product.market_price)) * 100) })}</Text>
                  ) : null}
                </View>
                {admin ? (
                  <View style={styles.stockActions}>
                    <TouchableOpacity style={styles.stockButton} onPress={() => void adjustStock(product, false)} accessibilityLabel={t('greenPoints.reduceStock')}>
                      <Icon name="minus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.stockButton} onPress={() => void adjustStock(product, true)} accessibilityLabel={t('greenPoints.increaseStock')}>
                      <Icon name="plus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.orderButton} onPress={() => { setSelectedProduct(product); setQuantity('1'); }}>
                  <Text style={styles.orderButtonText}>{t('greenPoints.order')}</Text>
                </TouchableOpacity>
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
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t('greenPoints.phone')} keyboardType="phone-pad" />
            <TouchableOpacity style={styles.adminButton} onPress={createPoint} disabled={savingAdmin}>
              <Text style={styles.adminButtonText}>{savingAdmin ? t('greenPoints.saving') : t('greenPoints.createPoint')}</Text>
            </TouchableOpacity>

            {points.map((point) => (
              <View key={`manage-${point.id}`} style={styles.inventoryCard}>
                <Text style={styles.pointName}>{t('greenPoints.addInventory', { point: point.name })}</Text>
                <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder={t('greenPoints.productName')} />
                <TextInput style={styles.input} value={itemDescription} onChangeText={setItemDescription} placeholder={t('greenPoints.productDescription')} />
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, styles.thirdInput]} value={price} onChangeText={setPrice} placeholder={t('greenPoints.price')} keyboardType="decimal-pad" />
                  <TextInput style={[styles.input, styles.thirdInput]} value={marketPrice} onChangeText={setMarketPrice} placeholder={t('greenPoints.marketPrice')} keyboardType="decimal-pad" />
                  <TextInput style={[styles.input, styles.thirdInput]} value={stock} onChangeText={setStock} placeholder={t('greenPoints.stock')} keyboardType="decimal-pad" />
                </View>
                <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder={t('greenPoints.unit')} />
                <TouchableOpacity style={styles.adminButton} onPress={() => void createProduct(point.id)} disabled={savingAdmin}>
                  <Text style={styles.adminButtonText}>{savingAdmin ? t('greenPoints.saving') : t('greenPoints.addProduct')}</Text>
                </TouchableOpacity>
              </View>
            ))}
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
  pointIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E9F5EC' },
  pointName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  pointAddress: { marginTop: 3, color: COLORS.muted, fontSize: 11, lineHeight: 15 },
  noProducts: { paddingVertical: 12, color: COLORS.muted, fontSize: 11 },
  productRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  productName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  productDetails: { marginTop: 4, color: COLORS.muted, fontSize: 10.5, lineHeight: 15 },
  savings: { marginTop: 4, color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  orderButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.primary },
  orderButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  stockActions: { flexDirection: 'row', gap: 5 },
  stockButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#E9F5EC' },
  adminSection: { marginTop: 20, padding: 14, borderWidth: 1, borderColor: '#CFE9D6', borderRadius: 15, backgroundColor: COLORS.white },
  section: { marginTop: 20 },
  sectionTitle: { marginBottom: 8, color: COLORS.text, fontSize: 16, fontWeight: '800' },
  caption: { marginBottom: 8, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 43, marginTop: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.canvas, color: COLORS.text, fontSize: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  thirdInput: { flex: 1, minWidth: 0 },
  adminButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: COLORS.primary },
  adminButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  inventoryCard: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  orderRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  smallAction: { padding: 9, borderRadius: 9, backgroundColor: '#E9F5EC' },
  smallActionText: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  orderActions: { alignItems: 'flex-end', gap: 5 },
  cancelOrderAction: { padding: 7 },
  cancelOrderText: { color: COLORS.danger, fontSize: 9, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,20,17,0.48)' },
  modalCard: { paddingHorizontal: 20, paddingTop: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: COLORS.white },
  modalHandle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: COLORS.border },
  label: { marginTop: 14, color: COLORS.text, fontSize: 11, fontWeight: '700' },
  dateButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  dateButtonActive: { borderColor: COLORS.primary, backgroundColor: '#E9F5EC' },
  dateButtonText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  dateButtonTextActive: { color: COLORS.primary },
  cancelButton: { alignItems: 'center', padding: 13 },
  cancelText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
});
