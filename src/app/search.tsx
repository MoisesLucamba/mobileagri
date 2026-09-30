import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

import { supabase } from '../lib/supabase';
import Icon, { IconName } from '../components/Icon';
import ProductCard, { Product as CardProduct } from '@/components/ProductCard';
import PaymentSheet from '@/components/PaymentSheet';

/* =========================================================
   TEMA
========================================================= */

const T = {
  g900: '#173D24',
  g700: '#1F6B3A',
  g600: '#1F6B3A',
  g500: '#1F6B3A',
  g400: '#79C267',
  g300: '#C7D6C4',
  g100: '#EEF0E9',
  g50: '#F5F3EC',

  e700: '#5C4A3A',
  e500: '#7B6652',
  e300: '#A0846A',
  ePale: '#F3ECE4',

  ink: '#3D403A',
  mid: '#4D554B',
  muted: '#77796F',
  faint: '#A3A398',

  canvas: '#FBFAF6',
  white: '#FFFFFF',
  rule: '#E8E5DC',

  gold: '#B7833D',
  goldL: '#D3A557',

  blue: '#637F9C',
  purple: '#7654B8',
  orange: '#D8782E',
  red: '#B95E54',
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
  contact?: string;
  harvest_date?: string;
  user_id?: string;
  seller_id?: string;
  province_id?: string;
  province?: string;
  municipality_id?: string;
  location?: string;
  location_lat?: number;
  location_lng?: number;
  image_url?: string;
  photos?: string[];
  created_at?: string;
  status?: string;
  is_active?: boolean;

  likes_count?: number;
  is_liked?: boolean;
  comments?: any[];
  user_verified?: boolean;
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
  icon: IconName;
}

/* =========================================================
   CATEGORIAS / PROVÍNCIAS
========================================================= */

const productCategories: Category[] = [
  { id: 'all', name: 'Todos', icon: 'grid' },
  { id: 'cereais', name: 'Cereais', icon: 'layers' },
  { id: 'frutas', name: 'Frutas', icon: 'apple' },
  { id: 'legumes', name: 'Legumes', icon: 'leaf' },
  { id: 'verduras', name: 'Verduras', icon: 'sprout' },
];

const SORT_OPTIONS: { value: SortOption; label: string; icon: IconName }[] = [
  { value: 'recent', label: 'Recentes', icon: 'clock' },
  { value: 'popular', label: 'Populares', icon: 'trending-up' },
  { value: 'price_asc', label: 'Menor preço', icon: 'arrow-down' },
  { value: 'price_desc', label: 'Maior preço', icon: 'arrow-up' },
];

const TABS: { id: TabOption; label: string; icon: IconName }[] = [
  { id: 'all', label: 'Tudo', icon: 'grid' },
  { id: 'products', label: 'Produtos', icon: 'package' },
  { id: 'users', label: 'Pessoas', icon: 'users' },
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
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Pagamento (substitui o antigo modal de pré-compra)
  const [paymentProduct, setPaymentProduct] = useState<CardProduct | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);

  const requestId = useRef(0);

  const loading = loadingProducts || loadingUsers;

  /* --------------------------------------------------------
     UTILITÁRIOS
  -------------------------------------------------------- */

  const getProductName = (product: Product) =>
    product.product_type || product.name || product.title || 'Produto agrícola';

  const getSellerName = (product: Product) => product.farmer_name || 'Agricultor';

  // Converte o resultado de pesquisa (formato solto) para o formato que o
  // ProductCard e a PaymentSheet partilhados esperam.
  const toCardProduct = (item: Product): CardProduct => ({
    id: item.id,
    product_type: getProductName(item),
    description: item.description ?? null,
    quantity: Number(item.quantity || 0),
    harvest_date: item.harvest_date || '',
    price: Number(item.price || 0),
    province_id: item.province_id || item.province || '',
    municipality_id: item.municipality_id || item.location || '',
    farmer_name: getSellerName(item),
    contact: item.contact || '',
    photos: Array.isArray(item.photos) && item.photos.length > 0
      ? item.photos
      : item.image_url
        ? [item.image_url]
        : [],
    status: item.status || 'active',
    created_at: item.created_at || new Date().toISOString(),
    user_id: item.user_id || item.seller_id || '',
    location_lat: item.location_lat ?? null,
    location_lng: item.location_lng ?? null,
    likes_count: item.likes_count || 0,
    is_liked: !!item.is_liked,
    comments: (item.comments || []) as any,
    commentsLoaded: true,
    user_verified: !!item.user_verified,
  });

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

      // Likes: UMA query para todos os produtos.
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

    const primary = await supabase
      .from('users')
      .select(columns)
      .or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`)
      .limit(20);

    if (!primary.error) return (primary.data || []) as UserResult[];

    console.warn('[Search] utilizadores (nome+email):', primary.error.message);

    const byName = await supabase
      .from('users')
      .select('id, full_name, user_type, avatar_url')
      .ilike('full_name', `%${safeTerm}%`)
      .limit(20);

    if (!byName.error) return (byName.data || []) as UserResult[];

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
     LOGIN
  -------------------------------------------------------- */

  const requireLogin = useCallback(() => {
    Alert.alert('Entrar na conta', 'É preciso entrar para continuar.', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Entrar', onPress: () => router.push('/login') },
    ]);
  }, [router]);

  /* --------------------------------------------------------
     PAGAMENTO — abre a PaymentSheet real em vez da pré-compra
  -------------------------------------------------------- */

  const openPayment = (cardProduct: CardProduct) => {
    if (!currentUser) {
      requireLogin();
      return;
    }
    setPaymentProduct(cardProduct);
    setPaymentVisible(true);
  };

  const closePayment = () => setPaymentVisible(false);

  const handlePaid = ({ order }: { payment: any; order: any }) => {
    if (!paymentProduct) return;
    setProductResults((current) =>
      current.map((p) =>
        p.id === paymentProduct.id
          ? { ...p, quantity: Math.max(0, Number(p.quantity) - Number(order?.quantity ?? 0)) }
          : p
      )
    );
  };

  const handleViewHistory = ({ intentId, orderId }: { intentId?: string; orderId?: string }) => {
    router.push({ pathname: '/historico', params: { intentId, orderId } } as any);
  };

  const handleProductUpdate = useCallback((updated: CardProduct) => {
    setProductResults((current) =>
      current.map((p) =>
        p.id === updated.id
          ? { ...p, likes_count: updated.likes_count, is_liked: updated.is_liked, comments: updated.comments }
          : p
      )
    );
  }, []);

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

        <Icon name="chevron-right" size={20} color={T.faint} />
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
            <Icon name="chevron-left" size={23} color={T.g700} />
          </Pressable>

          <View style={styles.searchBox}>
            <Icon name="search" size={19} color={T.muted} />

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
                <Icon name="close-circle" size={18} color={T.faint} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Icon name="sliders" size={21} color={showFilters ? '#fff' : T.g700} />
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
                    { backgroundColor: active ? '#FFFFFF' : T.g100 },
                  ]}
                >
                  <Icon name={category.icon} size={15} color={T.g700} />
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
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSortBy(option.value)}
                  style={[styles.sortPill, active && styles.sortPillActive]}
                >
                  <Icon name={option.icon} size={15} color={active ? '#fff' : T.mid} />
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
                  {active ? <Icon name="check" size={14} color="#fff" strokeWidth={3} /> : null}
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
      {TABS.map((tab) => {
        const active = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Icon name={tab.icon} size={17} color={active ? T.g700 : T.muted} />
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
      <StatusBar barStyle="dark-content" backgroundColor={T.canvas} translucent={false} />

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={showProductsSection ? sortedProducts : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={toCardProduct(item)}
            currentUserId={currentUser?.id ?? null}
            onProductUpdate={handleProductUpdate}
            onOpenPreOrder={openPayment}
            onRequireLogin={requireLogin}
          />
        )}
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
                  <Icon name="alert-circle" size={18} color={T.red} />
                  <Text style={styles.errorText}>Produtos: {productError}</Text>
                </View>
              ) : null}

              {userError ? (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle" size={18} color={T.red} />
                  <Text style={styles.errorText}>Pessoas: {userError}</Text>
                </View>
              ) : null}

              {/* UTILIZADORES */}
              {showUsersSection && userResults.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionIcon}>
                      <Icon name="users" size={17} color={T.g700} />
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
                      <Icon name="sprout" size={18} color={T.g700} />
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
                    <Icon name="search" size={42} color={T.g700} />
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

      {/* PAGAMENTO — substitui o antigo modal de pré-compra */}
      <PaymentSheet
        product={paymentProduct}
        visible={paymentVisible}
        onClose={closePayment}
        onPaid={handlePaid}
        onViewHistory={handleViewHistory}
      />
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
    backgroundColor: T.canvas,
    paddingTop: 40,
    paddingBottom: 8,
    zIndex: 20,
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 9,
    minHeight: 42,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.g50,
  },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3EC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: T.ink, paddingVertical: 0 },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.g50,
  },
  filterButtonActive: { backgroundColor: T.g700 },

  categoriesContainer: { paddingHorizontal: 16, paddingTop: 8, gap: 7 },
  categoryPill: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3EC',
  },
  categoryPillActive: { backgroundColor: T.g600 },
  categoryIcon: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  categoryText: { fontSize: 13, fontWeight: '700', color: T.mid },
  categoryTextActive: { color: '#fff' },

  filtersPanel: {
    backgroundColor: T.canvas,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterTitle: { fontSize: 17, fontWeight: '800', color: T.ink },
  clearText: { color: T.gold, fontSize: 13, fontWeight: '800' },
  filterLabel: { color: T.mid, fontSize: 13, fontWeight: '800', marginBottom: 7 },

  sortScroll: { marginBottom: 14 },
  sortPill: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F5F3EC',
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
    minHeight: 29,
    paddingHorizontal: 9,
    borderRadius: 17,
    backgroundColor: '#F5F3EC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  provincePillActive: { backgroundColor: T.g500 },
  provinceText: { color: T.muted, fontSize: 12, fontWeight: '700' },
  provinceTextActive: { color: '#fff' },

  content: { paddingHorizontal: 16, paddingTop: 12 },

  tabsContainer: {
    height: 44,
    backgroundColor: '#EEF0E9',
    borderRadius: 25,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 14,
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
    backgroundColor: '#F6ECE9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: T.red, fontSize: 11.5, lineHeight: 16 },

  hintText: { color: T.muted, fontSize: 12, marginBottom: 16 },

  section: { marginBottom: 16 },
  sectionHeaderProducts: { marginBottom: 9 },
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
    backgroundColor: T.canvas,
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
});