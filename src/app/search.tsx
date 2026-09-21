import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';

/* =========================================================
   TEMA
========================================================= */

const T = {
  g900: '#236B30',
  g700: '#2C863B',
  g600: '#3A9948',
  g500: '#4CAF50',
  g400: '#81C784',
  g300: '#A5D6A7',
  g100: '#E8F5E9',
  g50: '#F2FAF3',

  e700: '#5C3317',
  e500: '#7B4F2E',
  e300: '#A0522D',
  ePale: '#FDF5EE',

  ink: '#111714',
  mid: '#3D4D40',
  muted: '#758A79',
  faint: '#A8BAA9',

  canvas: '#F7F9F7',
  white: '#FFFFFF',
  rule: '#E5EDE6',

  gold: '#B07D0A',
  goldL: '#E5A020',

  blue: '#3977B8',
  purple: '#7654B8',
  orange: '#D8782E',
  red: '#C94A4A',
};

/* =========================================================
   TIPOS
========================================================= */

interface Product {
  id: string;
  product_type?: string;
  name?: string;
  title?: string;
  description?: string;
  price: number;
  quantity: number;
  unit?: string;
  farmer_name?: string;
  user_id?: string;
  seller_id?: string;
  province_id?: string;
  province?: string;
  location?: string;
  location_lat?: number;
  location_lng?: number;
  image_url?: string;
  created_at?: string;
  status?: string;
  is_active?: boolean;

  likes_count?: number;
  is_liked?: boolean;
  comments?: any[];
}

interface UserResult {
  id: string;
  full_name: string;
  email?: string;
  user_type?: string;
  avatar_url?: string;
}

type SortOption = 'recent' | 'popular' | 'price_asc' | 'price_desc';
type TabOption = 'all' | 'products' | 'users';

interface Category {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

/* =========================================================
   CATEGORIAS / PROVÍNCIAS
========================================================= */

const productCategories: Category[] = [
  { id: 'all', name: 'Todos', icon: 'view-grid-outline', color: T.g700 },
  { id: 'cereais', name: 'Cereais', icon: 'barley', color: T.goldL },
  { id: 'frutas', name: 'Frutas', icon: 'fruit-cherries', color: T.red },
  { id: 'legumes', name: 'Legumes', icon: 'carrot', color: T.orange },
  { id: 'verduras', name: 'Verduras', icon: 'leaf', color: T.g600 },
];

const angolaProvinces = [
  { id: 'bengo', name: 'Bengo' },
  { id: 'benguela', name: 'Benguela' },
  { id: 'bie', name: 'Bié' },
  { id: 'cabinda', name: 'Cabinda' },
  { id: 'cuando-cubango', name: 'Cuando Cubango' },
  { id: 'cuanza-norte', name: 'Cuanza Norte' },
  { id: 'cuanza-sul', name: 'Cuanza Sul' },
  { id: 'cunene', name: 'Cunene' },
  { id: 'huambo', name: 'Huambo' },
  { id: 'huila', name: 'Huíla' },
  { id: 'icolo-e-bengo', name: 'Icolo e Bengo' },
  { id: 'luanda', name: 'Luanda' },
  { id: 'lunda-norte', name: 'Lunda Norte' },
  { id: 'lunda-sul', name: 'Lunda Sul' },
  { id: 'malanje', name: 'Malanje' },
  { id: 'moxico', name: 'Moxico' },
  { id: 'moxico-leste', name: 'Moxico Leste' },
  { id: 'namibe', name: 'Namibe' },
  { id: 'uige', name: 'Uíge' },
  { id: 'zaire', name: 'Zaire' },
];

const productColors = [
  '#E8F5E9',
  '#FFF3E0',
  '#E3F2FD',
  '#F3E5F5',
  '#FFF8E1',
  '#E0F2F1',
  '#FCE4EC',
  '#EFEBE9',
];

/* =========================================================
   HELPERS DE CONSULTA
   O PostgREST recebe os filtros .or() como uma string.
   Vírgulas, pontos, parênteses e % partem essa string,
   por isso o termo tem de ser limpo antes de entrar lá.
========================================================= */

function sanitizeTerm(term: string) {
  return term
    .trim()
    .replace(/[,().*%\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Colunas possíveis para marcar produto activo, por ordem de tentativa.
type ActiveFilter = 'is_active' | 'status' | 'none';
let cachedActiveFilter: ActiveFilter | null = null;

function isMissingColumn(error: any) {
  // 42703 = undefined_column no Postgres
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message || '');
}

/* =========================================================
   SEARCH PAGE
========================================================= */

export default function SearchPage() {
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [activeTab, setActiveTab] = useState<TabOption>('all');

  const [productResults, setProductResults] = useState<Product[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [productError, setProductError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [preOrderModalOpen, setPreOrderModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderData, setOrderData] = useState({ quantity: 1, location: '' });
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const requestId = useRef(0);

  const loading = loadingProducts || loadingUsers;

  /* --------------------------------------------------------
     UTILITÁRIOS
  -------------------------------------------------------- */

  const getProductName = (product: Product) =>
    product.product_type || product.name || product.title || 'Produto agrícola';

  const getSellerName = (product: Product) => product.farmer_name || 'Agricultor';

  /* --------------------------------------------------------
     SESSÃO
  -------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  /* --------------------------------------------------------
     DEBOUNCE DO TERMO
  -------------------------------------------------------- */

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  /* --------------------------------------------------------
     PESQUISA DE PRODUTOS (isolada)
  -------------------------------------------------------- */

  const searchProducts = useCallback(
    async (term: string, province: string, category: string, userId?: string) => {
      const safeTerm = sanitizeTerm(term);

      const runQuery = async (filter: ActiveFilter) => {
        let query = supabase.from('products').select('*');

        if (filter === 'is_active') query = query.eq('is_active', true);
        if (filter === 'status') query = query.eq('status', 'active');

        if (province) query = query.eq('province_id', province);

        if (safeTerm) {
          query = query.or(
            `product_type.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,farmer_name.ilike.%${safeTerm}%`
          );
        }

        if (category && category !== 'all') {
          query = query.ilike('product_type', `%${category}%`);
        }

        return query.limit(60);
      };

      // Descobre uma única vez qual a coluna de estado que existe.
      const order: ActiveFilter[] = cachedActiveFilter
        ? [cachedActiveFilter]
        : ['is_active', 'status', 'none'];

      let products: Product[] = [];
      let lastError: any = null;

      for (const filter of order) {
        const { data, error } = await runQuery(filter);

        if (!error) {
          cachedActiveFilter = filter;
          products = (data || []) as Product[];
          lastError = null;
          break;
        }

        lastError = error;
        if (!isMissingColumn(error)) break; // erro real: não vale a pena tentar outra coluna
        console.warn(`[Search] coluna "${filter}" inexistente, a tentar a seguinte.`);
      }

      if (lastError) throw lastError;
      if (products.length === 0) return [];

      const ids = products.map((product) => product.id);

      // Likes: UMA query para todos os produtos (antes era 1 por produto).
      const likesByProduct: Record<string, number> = {};
      const likedByMe = new Set<string>();

      const { data: likes, error: likesError } = await supabase
        .from('product_likes')
        .select('product_id, user_id')
        .in('product_id', ids);

      if (likesError) {
        console.warn('[Search] likes:', likesError.message);
      } else {
        for (const like of likes || []) {
          likesByProduct[like.product_id] = (likesByProduct[like.product_id] || 0) + 1;
          if (userId && like.user_id === userId) likedByMe.add(like.product_id);
        }
      }

      // Comentários: também numa só query.
      const commentsByProduct: Record<string, any[]> = {};

      const { data: comments, error: commentsError } = await supabase
        .from('product_comments')
        .select('id, product_id, user_id, comment_text, created_at')
        .in('product_id', ids)
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.warn('[Search] comentários:', commentsError.message);
      } else {
        for (const comment of comments || []) {
          const list = commentsByProduct[comment.product_id] || [];
          list.push(comment);
          commentsByProduct[comment.product_id] = list;
        }
      }

      return products.map((product) => ({
        ...product,
        likes_count: likesByProduct[product.id] || 0,
        is_liked: likedByMe.has(product.id),
        comments: commentsByProduct[product.id] || [],
      }));
    },
    []
  );

  /* --------------------------------------------------------
     PESQUISA DE UTILIZADORES (isolada)
  -------------------------------------------------------- */

  const searchUsers = useCallback(async (term: string) => {
    const safeTerm = sanitizeTerm(term);
    if (safeTerm.length < 2) return [];

    const columns = 'id, full_name, email, user_type, avatar_url';

    // 1ª tentativa: nome OU email.
    const primary = await supabase
      .from('users')
      .select(columns)
      .or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`)
      .limit(20);

    if (!primary.error) return (primary.data || []) as UserResult[];

    console.warn('[Search] utilizadores (nome+email):', primary.error.message);

    // 2ª tentativa: só nome — cobre o caso de a coluna email não existir
    // ou de a RLS bloquear a leitura do email.
    const byName = await supabase
      .from('users')
      .select('id, full_name, user_type, avatar_url')
      .ilike('full_name', `%${safeTerm}%`)
      .limit(20);

    if (!byName.error) return (byName.data || []) as UserResult[];

    // 3ª tentativa: tabela profiles, para esquemas que usam esse nome.
    const fromProfiles = await supabase
      .from('profiles')
      .select('id, full_name, user_type, avatar_url')
      .ilike('full_name', `%${safeTerm}%`)
      .limit(20);

    if (!fromProfiles.error) return (fromProfiles.data || []) as UserResult[];

    throw byName.error;
  }, []);

  /* --------------------------------------------------------
     ORQUESTRAÇÃO — as duas pesquisas correm em paralelo
     e uma falha NUNCA cancela a outra.
  -------------------------------------------------------- */

  const runSearch = useCallback(async () => {
    const id = ++requestId.current;
    const wantsUsers = activeTab === 'all' || activeTab === 'users';
    const wantsProducts = activeTab === 'all' || activeTab === 'products';

    if (wantsProducts) setLoadingProducts(true);
    if (wantsUsers) setLoadingUsers(true);

    const [productsOutcome, usersOutcome] = await Promise.allSettled([
      wantsProducts
        ? searchProducts(debouncedTerm, selectedProvince, selectedCategory, currentUser?.id)
        : Promise.resolve([] as Product[]),
      wantsUsers && debouncedTerm.trim()
        ? searchUsers(debouncedTerm)
        : Promise.resolve([] as UserResult[]),
    ]);

    if (id !== requestId.current) return; // resposta obsoleta

    if (productsOutcome.status === 'fulfilled') {
      setProductResults(productsOutcome.value);
      setProductError(null);
    } else {
      console.error('[Search] produtos:', productsOutcome.reason);
      setProductResults([]);
      setProductError(productsOutcome.reason?.message || 'Falha ao carregar produtos.');
    }

    if (usersOutcome.status === 'fulfilled') {
      setUserResults(usersOutcome.value);
      setUserError(null);
    } else {
      console.error('[Search] utilizadores:', usersOutcome.reason);
      setUserResults([]);
      setUserError(usersOutcome.reason?.message || 'Falha ao carregar utilizadores.');
    }

    setLoadingProducts(false);
    setLoadingUsers(false);
  }, [
    activeTab,
    currentUser?.id,
    debouncedTerm,
    searchProducts,
    searchUsers,
    selectedCategory,
    selectedProvince,
  ]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  /* --------------------------------------------------------
     ORDENAÇÃO
  -------------------------------------------------------- */

  const sortedProducts = useMemo(() => {
    const sorted = [...productResults];

    switch (sortBy) {
      case 'recent':
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
      case 'popular':
        return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      case 'price_asc':
        return sorted.sort((a, b) => Number(a.price) - Number(b.price));
      case 'price_desc':
        return sorted.sort((a, b) => Number(b.price) - Number(a.price));
      default:
        return sorted;
    }
  }, [productResults, sortBy]);

  /* --------------------------------------------------------
     FILTROS
  -------------------------------------------------------- */

  const clearFilters = () => {
    setSelectedProvince('');
    setSelectedCategory('all');
    setSortBy('recent');
    setSearchTerm('');
  };

  const hasActiveFilters =
    !!selectedProvince || selectedCategory !== 'all' || sortBy !== 'recent' || !!searchTerm;

  /* --------------------------------------------------------
     PRÉ-COMPRA
  -------------------------------------------------------- */

  const handleOpenPreOrder = (product: Product) => {
    if (!currentUser) {
      Alert.alert('Entrar na conta', 'É preciso entrar para fazer uma pré-compra.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Entrar', onPress: () => router.push('/login') },
      ]);
      return;
    }

    setSelectedProduct(product);
    setOrderData({ quantity: 1, location: '' });
    setPreOrderModalOpen(true);
  };

  const handlePreOrderSubmit = async () => {
    if (!selectedProduct || !currentUser || submitting) return;

    if (!orderData.location.trim()) {
      Alert.alert('Local de entrega', 'Indique onde quer receber o produto.');
      return;
    }

    if (orderData.quantity <= 0) {
      Alert.alert('Quantidade', 'Indique uma quantidade válida.');
      return;
    }

    if (orderData.quantity > Number(selectedProduct.quantity)) {
      Alert.alert('Quantidade indisponível', 'O pedido é maior do que o estoque disponível.');
      return;
    }

    try {
      setSubmitting(true);

      // Nota: se a tabela pre_orders usar buyer_id em vez de user_id,
      // a primeira tentativa falha e a segunda resolve.
      const payload = {
        product_id: selectedProduct.id,
        quantity: orderData.quantity,
        location: orderData.location,
        status: 'pending',
      };

      let { error } = await supabase
        .from('pre_orders')
        .insert({ ...payload, user_id: currentUser.id });

      if (error && isMissingColumn(error)) {
        const retry = await supabase
          .from('pre_orders')
          .insert({ ...payload, buyer_id: currentUser.id });
        error = retry.error;
      }

      if (error) throw error;

      const sellerId = selectedProduct.user_id || selectedProduct.seller_id;

      if (sellerId) {
        try {
          await supabase.rpc('create_notification', {
            p_user_id: sellerId,
            p_type: 'pre_order',
            p_title: 'Nova pré-compra',
            p_message: `${currentUser.email} quer comprar ${orderData.quantity}kg de ${getProductName(
              selectedProduct
            )}`,
            p_metadata: {
              product_id: selectedProduct.id,
              buyer_id: currentUser.id,
              quantity: orderData.quantity,
            },
          });
        } catch (notificationError) {
          console.log('[Search] notificação não enviada:', notificationError);
        }
      }

      Alert.alert('Pedido enviado', 'O agricultor foi notificado da sua pré-compra.');
      setPreOrderModalOpen(false);
      setSelectedProduct(null);
    } catch (error: any) {
      console.error('[Search] pré-compra:', error?.message || error);
      Alert.alert('Pré-compra', error?.message || 'O pedido não foi registado. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  /* --------------------------------------------------------
     TOTAL
  -------------------------------------------------------- */

  const TAX_RATE = 0.1;
  const subtotal = selectedProduct ? orderData.quantity * Number(selectedProduct.price) : 0;
  const tax = subtotal * TAX_RATE;
  const totalPrice = subtotal + tax;

  /* --------------------------------------------------------
     CARD DO PRODUTO
  -------------------------------------------------------- */

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const background = productColors[index % productColors.length];
    const name = getProductName(item);
    const price = Number(item.price || 0);

    return (
      <Pressable
        style={[styles.productCard, { backgroundColor: background }]}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={[styles.productImageBox, { backgroundColor: '#FFFFFF99' }]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons name="sprout" size={52} color={T.g700} />
          )}

          <View style={styles.availableBadge}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText}>Disponível</Text>
          </View>
        </View>

        <View style={styles.productContent}>
          <Text style={styles.productName} numberOfLines={1}>
            {name}
          </Text>

          <Text style={styles.productSeller} numberOfLines={1}>
            <Ionicons name="person-outline" size={12} color={T.muted} /> {getSellerName(item)}
          </Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={T.muted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.province || item.location || 'Angola'}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Preço</Text>
              <Text style={styles.productPrice}>{price.toLocaleString('pt-AO')} Kz</Text>
              <Text style={styles.unitText}>/ {item.unit || 'kg'}</Text>
            </View>

            <View style={styles.stockBox}>
              <Text style={styles.stockNumber}>
                {Number(item.quantity || 0).toLocaleString('pt-AO')}
              </Text>
              <Text style={styles.stockLabel}>estoque</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.detailsButton}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <Text style={styles.detailsButtonText}>Ver produto</Text>
            </Pressable>

            <Pressable style={styles.orderButton} onPress={() => handleOpenPreOrder(item)}>
              <Ionicons name="cart-outline" size={17} color="#fff" />
              <Text style={styles.orderButtonText}>Pré-comprar</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  /* --------------------------------------------------------
     CARD DO UTILIZADOR
  -------------------------------------------------------- */

  const renderUser = (item: UserResult) => {
    const initials =
      item.full_name
        ?.split(' ')
        .slice(0, 2)
        .map((name) => name[0])
        .join('')
        .toUpperCase() || 'U';

    return (
      <Pressable
        key={item.id}
        style={styles.userCard}
        onPress={() => router.push(`/profile/${item.id}`)}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.full_name || 'Utilizador'}
          </Text>
          <Text style={styles.userType}>{item.user_type || 'membro'}</Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color={T.faint} />
      </Pressable>
    );
  };

  /* --------------------------------------------------------
     HEADER
  -------------------------------------------------------- */

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={23} color={T.g700} />
          </Pressable>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={19} color={T.muted} />

            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Pesquisar produtos, agricultores..."
              placeholderTextColor={T.faint}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              blurOnSubmit={false}
              onSubmitEditing={() => setDebouncedTerm(searchTerm)}
              accessibilityLabel="Pesquisar produtos e agricultores"
            />

            {searchTerm.length > 0 ? (
              <Pressable onPress={() => setSearchTerm('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={T.faint} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="options-outline" size={21} color={showFilters ? '#fff' : T.g700} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {productCategories.map((category) => {
            const active = selectedCategory === category.id;

            return (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
              >
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: active ? '#FFFFFF33' : `${category.color}20` },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={17}
                    color={active ? '#fff' : category.color}
                  />
                </View>

                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {showFilters ? (
        <View style={styles.filtersPanel}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filtros avançados</Text>

            {hasActiveFilters ? (
              <Pressable onPress={clearFilters}>
                <Text style={styles.clearText}>Limpar tudo</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.filterLabel}>Ordenar por</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
            {[
              { value: 'recent', label: 'Recentes', icon: 'time-outline' },
              { value: 'popular', label: 'Populares', icon: 'trending-up' },
              { value: 'price_asc', label: 'Menor preço', icon: 'arrow-down' },
              { value: 'price_desc', label: 'Maior preço', icon: 'arrow-up' },
            ].map((option) => {
              const active = sortBy === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSortBy(option.value as SortOption)}
                  style={[styles.sortPill, active && styles.sortPillActive]}
                >
                  <Ionicons name={option.icon as any} size={15} color={active ? '#fff' : T.mid} />
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Província</Text>

          <View style={styles.provinceGrid}>
            {angolaProvinces.map((province) => {
              const active = selectedProvince === province.id;

              return (
                <Pressable
                  key={province.id}
                  onPress={() => setSelectedProvince(active ? '' : province.id)}
                  style={[styles.provincePill, active && styles.provincePillActive]}
                >
                  {active ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  <Text style={[styles.provinceText, active && styles.provinceTextActive]}>
                    {province.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );

  /* --------------------------------------------------------
     TABS
  -------------------------------------------------------- */

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {[
        { id: 'all', label: 'Tudo', icon: 'apps-outline' },
        { id: 'products', label: 'Produtos', icon: 'cube-outline' },
        { id: 'users', label: 'Pessoas', icon: 'people-outline' },
      ].map((tab) => {
        const active = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as TabOption)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Ionicons name={tab.icon as any} size={17} color={active ? T.g700 : T.muted} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  /* --------------------------------------------------------
     RENDER
  -------------------------------------------------------- */

  const showUsersSection = activeTab === 'all' || activeTab === 'users';
  const showProductsSection = activeTab === 'all' || activeTab === 'products';
  const nothingFound =
    !loading && productResults.length === 0 && userResults.length === 0 && !productError && !userError;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={showProductsSection ? sortedProducts : []}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.productColumns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {renderHeader()}

            <View style={styles.content}>
              {renderTabs()}

              {/* Diagnóstico: mostra a mensagem real do Supabase */}
              {productError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={T.red} />
                  <Text style={styles.errorText}>Produtos: {productError}</Text>
                </View>
              ) : null}

              {userError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={T.red} />
                  <Text style={styles.errorText}>Pessoas: {userError}</Text>
                </View>
              ) : null}

              {/* UTILIZADORES */}
              {showUsersSection && userResults.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionIcon}>
                      <Ionicons name="people" size={17} color={T.g700} />
                    </View>

                    <Text style={styles.sectionTitle}>Agricultores e agentes</Text>

                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{userResults.length}</Text>
                    </View>
                  </View>

                  {userResults.map((item) => renderUser(item))}
                </View>
              ) : null}

              {showUsersSection && debouncedTerm.trim().length >= 2 && !loadingUsers &&
              userResults.length === 0 && !userError ? (
                <Text style={styles.hintText}>
                  Ninguém encontrado com esse nome.
                </Text>
              ) : null}

              {/* PRODUTOS */}
              {showProductsSection && sortedProducts.length > 0 ? (
                <View style={styles.sectionHeaderProducts}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionIcon, { backgroundColor: T.g100 }]}>
                      <MaterialCommunityIcons name="sprout" size={18} color={T.g700} />
                    </View>

                    <Text style={styles.sectionTitle}>Produtos disponíveis</Text>

                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{sortedProducts.length}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {loading ? (
                <View style={styles.loadingBox}>
                  <View style={styles.loadingCircle}>
                    <ActivityIndicator size="large" color={T.g700} />
                  </View>
                  <Text style={styles.loadingText}>A procurar...</Text>
                </View>
              ) : null}

              {nothingFound ? (
                <View style={styles.emptyBox}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="search" size={42} color={T.g700} />
                  </View>

                  <Text style={styles.emptyTitle}>Nada encontrado</Text>

                  <Text style={styles.emptyText}>
                    {searchTerm
                      ? `Não há resultados para "${searchTerm}". Tente outra palavra ou remova os filtros.`
                      : 'Escreva o nome de um produto, de um agricultor ou de uma província.'}
                  </Text>

                  {hasActiveFilters ? (
                    <Pressable onPress={clearFilters} style={styles.emptyButton}>
                      <Text style={styles.emptyButtonText}>Limpar filtros</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        }
      />

      {/* MODAL DE PRÉ-COMPRA */}
      <Modal
        visible={preOrderModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPreOrderModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.orderModal}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Pré-compra</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedProduct ? getProductName(selectedProduct) : ''}
                </Text>
              </View>

              <Pressable onPress={() => setPreOrderModalOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={T.mid} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Quantidade (kg)</Text>

              <View style={styles.quantityBox}>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() =>
                    setOrderData((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))
                  }
                >
                  <Ionicons name="remove" size={21} color={T.g700} />
                </Pressable>

                <Text style={styles.quantityText}>{orderData.quantity}</Text>

                <Pressable
                  style={styles.quantityButton}
                  onPress={() =>
                    setOrderData((prev) => ({
                      ...prev,
                      quantity: Math.min(
                        Number(selectedProduct?.quantity || 999999),
                        prev.quantity + 1
                      ),
                    }))
                  }
                >
                  <Ionicons name="add" size={21} color={T.g700} />
                </Pressable>
              </View>

              <Text style={styles.availableTextModal}>
                Disponível:{' '}
                <Text style={{ fontWeight: '800', color: T.g700 }}>
                  {Number(selectedProduct?.quantity || 0).toLocaleString('pt-AO')} kg
                </Text>
              </Text>

              <Text style={[styles.inputLabel, { marginTop: 22 }]}>Local de entrega</Text>

              <TextInput
                value={orderData.location}
                onChangeText={(text) => setOrderData((prev) => ({ ...prev, location: text }))}
                placeholder="Ex.: Luanda, Talatona"
                placeholderTextColor={T.faint}
                style={styles.modalInput}
              />

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Preço por kg</Text>
                  <Text style={styles.summaryValue}>
                    {Number(selectedProduct?.price || 0).toLocaleString('pt-AO')} Kz
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>{subtotal.toLocaleString('pt-AO')} Kz</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelGold}>Taxa de serviço (10%)</Text>
                  <Text style={styles.summaryValueGold}>{tax.toLocaleString('pt-AO')} Kz</Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{totalPrice.toLocaleString('pt-AO')} Kz</Text>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setPreOrderModalOpen(false)}
                  disabled={submitting}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[styles.confirmButton, submitting && { opacity: 0.7 }]}
                  onPress={handlePreOrderSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />
                  )}
                  <Text style={styles.confirmText}>
                    {submitting ? 'A enviar' : 'Confirmar'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.canvas },
  listContent: { paddingBottom: 30 },

  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 18,
    paddingBottom: 14,
    zIndex: 20,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 9,
    minHeight: 48,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.g50,
  },
  searchBox: {
    flex: 1,
    height: 46,
    borderRadius: 22,
    backgroundColor: '#F1F4F1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: T.ink, paddingVertical: 0 },
  filterButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.g50,
  },
  filterButtonActive: { backgroundColor: T.g700 },

  categoriesContainer: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  categoryPill: {
    height: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F4F1',
  },
  categoryPillActive: { backgroundColor: T.g600 },
  categoryIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  categoryText: { fontSize: 13, fontWeight: '700', color: T.mid },
  categoryTextActive: { color: '#fff' },

  filtersPanel: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  filterTitle: { fontSize: 17, fontWeight: '800', color: T.ink },
  clearText: { color: T.gold, fontSize: 13, fontWeight: '800' },
  filterLabel: { color: T.mid, fontSize: 13, fontWeight: '800', marginBottom: 10 },

  sortScroll: { marginBottom: 19 },
  sortPill: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: '#F1F4F1',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 5,
  },
  sortPillActive: { backgroundColor: T.g500 },
  sortText: { fontSize: 12, fontWeight: '700', color: T.mid },
  sortTextActive: { color: '#fff' },

  provinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  provincePill: {
    minHeight: 33,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: '#F1F4F1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  provincePillActive: { backgroundColor: T.g500 },
  provinceText: { color: T.muted, fontSize: 12, fontWeight: '700' },
  provinceTextActive: { color: '#fff' },

  content: { paddingHorizontal: 16, paddingTop: 17 },

  tabsContainer: {
    height: 50,
    backgroundColor: '#E8EEE9',
    borderRadius: 25,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: T.muted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: T.g700 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: T.red, fontSize: 11.5, lineHeight: 16 },

  hintText: { color: T.muted, fontSize: 12, marginBottom: 16 },

  section: { marginBottom: 20 },
  sectionHeaderProducts: { marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.g100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: T.ink, flexShrink: 1 },
  countBadge: {
    minWidth: 27,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: T.g100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },
  countText: { color: T.g700, fontSize: 11, fontWeight: '900' },

  productColumns: { paddingHorizontal: 14, gap: 10, marginBottom: 10 },
  productCard: {
    flex: 1,
    maxWidth: '50%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  productImageBox: {
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: { width: '100%', height: '100%' },
  availableBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.g500,
    marginRight: 4,
  },
  availableText: { color: T.g700, fontSize: 9, fontWeight: '800' },

  productContent: { padding: 11, backgroundColor: 'rgba(255,255,255,0.94)' },
  productName: { fontSize: 15, fontWeight: '900', color: T.ink, marginBottom: 4 },
  productSeller: { fontSize: 10, color: T.muted, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  locationText: { fontSize: 10, color: T.muted, marginLeft: 3, flex: 1 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  priceLabel: { fontSize: 8, color: T.faint, fontWeight: '800', marginBottom: 1 },
  productPrice: { fontSize: 15, fontWeight: '900', color: T.g700 },
  unitText: { fontSize: 9, color: T.muted },
  stockBox: { alignItems: 'flex-end' },
  stockNumber: { fontSize: 12, fontWeight: '900', color: T.mid },
  stockLabel: { fontSize: 8, color: T.muted },

  actionRow: { flexDirection: 'row', gap: 6 },
  detailsButton: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.g50,
  },
  detailsButtonText: { color: T.g700, fontSize: 10, fontWeight: '800' },
  orderButton: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    backgroundColor: T.g600,
  },
  orderButtonText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: T.g100 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: T.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: T.g700, fontSize: 15, fontWeight: '900' },
  userInfo: { flex: 1, marginLeft: 11 },
  userName: { color: T.ink, fontSize: 14, fontWeight: '800' },
  userType: { color: T.muted, fontSize: 11, marginTop: 3, textTransform: 'capitalize' },

  loadingBox: { paddingVertical: 55, alignItems: 'center' },
  loadingCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: T.g100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  loadingText: { color: T.muted, fontSize: 13, fontWeight: '700' },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 50,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.rule,
    marginBottom: 30,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: T.g50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: T.ink },
  emptyText: { textAlign: 'center', color: T.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  emptyButton: {
    marginTop: 17,
    backgroundColor: T.g600,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  orderModal: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D7DDD8',
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  modalTitle: { color: T.g700, fontSize: 21, fontWeight: '900' },
  modalSubtitle: { color: T.muted, fontSize: 13, marginTop: 3 },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputLabel: { color: T.mid, fontSize: 13, fontWeight: '800', marginBottom: 9 },
  quantityBox: {
    height: 53,
    backgroundColor: '#F1F4F1',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: { fontSize: 20, fontWeight: '900', color: T.ink },
  availableTextModal: { color: T.muted, fontSize: 11, marginTop: 7 },
  modalInput: {
    height: 50,
    borderRadius: 17,
    backgroundColor: '#F1F4F1',
    paddingHorizontal: 15,
    color: T.ink,
    fontSize: 14,
  },

  summaryBox: { marginTop: 20, padding: 16, backgroundColor: '#F4F7F4', borderRadius: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: T.mid, fontSize: 13 },
  summaryValue: { color: T.ink, fontSize: 13, fontWeight: '700' },
  summaryLabelGold: { color: T.gold, fontSize: 13 },
  summaryValueGold: { color: T.gold, fontSize: 13, fontWeight: '700' },
  summaryDivider: { height: 1, backgroundColor: '#DDE5DE', marginVertical: 5 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 5,
  },
  totalLabel: { color: T.ink, fontSize: 16, fontWeight: '900' },
  totalValue: { color: T.g700, fontSize: 19, fontWeight: '900' },

  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: T.muted, fontSize: 13, fontWeight: '800' },
  confirmButton: {
    flex: 1.5,
    height: 50,
    borderRadius: 25,
    backgroundColor: T.g600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});