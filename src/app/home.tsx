import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Image,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    Text,
    UIManager,
    View,
} from "react-native";

import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PaymentSheet from "@/components/PaymentSheet";
import ProductCard, { Product } from "@/components/ProductCard";
import AgrilinkAdCard from "../components/AgrilinkAdCard";
import BottomToolbar from "../components/BottomToolbar";
import Icon, { IconName } from "../components/Icon";
import ProcessingScreen from "../components/ProcessingScreen";
import { useUserRole } from "../context/RoleContext";
import { AgrilinkAd, isAgrilinkAdmin, loadAgrilinkAds, rateAgrilinkAd } from "../lib/agrilinkAds";
import { supabase } from "../lib/supabase";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Logo = require("../assets/images/logo.jpeg");

// Paleta partilhada com o ProductCard (verde um pouco mais claro)
const COLORS = {
  primary: "#2E8B4F",
  primaryDark: "#25703F",
  tint: "#E9F5EC",
  text: "#16231C",
  muted: "#78877D",
  line: "#E8ECE6",
  bg: "#F6F8F5",
  white: "#FFFFFF",
};

const COUNTRIES = [
  { code: "AO", name: "Angola", flag: "🇦🇴", currency: "Kz" },
  { code: "CD", name: "RDC", flag: "🇨🇩", currency: "FC" },
];

const CATEGORIES: { id: string; name: string; icon: IconName }[] = [
  { id: "all", name: "Todos", icon: "grid" },
  { id: "frutas", name: "Frutas", icon: "apple" },
  { id: "citrus", name: "Cítricos", icon: "citrus" },
  { id: "legumes", name: "Legumes", icon: "leaf" },
  { id: "verduras", name: "Verduras", icon: "sprout" },
  { id: "cereais", name: "Cereais", icon: "layers" },
  { id: "temperos", name: "Temperos", icon: "flask" },
  { id: "pescado", name: "Pescado", icon: "fish" },
  { id: "carnes", name: "Carnes", icon: "utensils" },
  { id: "ovos", name: "Ovos", icon: "egg" },
  { id: "paes", name: "Pães", icon: "coffee" },
  { id: "lacteos", name: "Lácteos", icon: "droplet" },
  { id: "bebidas", name: "Bebidas", icon: "wine" },
];

const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  all: 'home.all',
  frutas: 'home.fruits',
  citrus: 'home.citrus',
  legumes: 'home.vegetables',
  verduras: 'home.greens',
  cereais: 'home.grains',
  temperos: 'home.spices',
  pescado: 'home.fish',
  carnes: 'home.meat',
  ovos: 'home.eggs',
  paes: 'home.bread',
  lacteos: 'home.dairy',
  bebidas: 'home.drinks',
};

const CATEGORY_MAP: Record<string, string[]> = {
  frutas: ["banana", "maçã", "maca", "manga", "abacaxi", "mamão", "mamao", "goiaba", "melancia", "abacate"],
  citrus: ["laranja", "limão", "limao", "tangerina", "toranja"],
  legumes: ["tomate", "cenoura", "mandioca", "batata", "batata-doce", "cebola", "alho", "pepino"],
  verduras: ["alface", "couve", "espinafre", "repolho", "rúcula", "rucula"],
  cereais: ["milho", "arroz", "trigo", "feijão", "feijao", "soja"],
  temperos: ["pimenta", "gengibre", "canela", "cravo"],
  pescado: ["peixe", "tilápia", "tilapia", "sardinha", "cacusso"],
  carnes: ["carne", "frango", "boi", "porco", "cabrito"],
  ovos: ["ovo", "ovos"],
  paes: ["pão", "pao"],
  lacteos: ["leite", "queijo", "iogurte"],
  bebidas: ["sumo", "suco", "água", "agua", "bebida"],
};

// Os mocks só aparecem quando NÃO existem produtos reais no Supabase.
const MOCK_PRODUCTS: Product[] = [
  {
    id: "mock-tomate-001",
    product_type: "Tomate",
    description: "Tomate fresco selecionado, ideal para mercados, restaurantes e distribuidores.",
    quantity: 2500,
    harvest_date: "2026-09-25",
    price: 850,
    province_id: "Bengo",
    municipality_id: "Dande",
    farmer_name: "Agro Bengo",
    contact: "+244 900 000 001",
    photos: [
      "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=1200",
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
      "https://images.unsplash.com/photo-1561136594-7f68413baa99?w=1200",
    ],
    status: "active",
    created_at: new Date().toISOString(),
    user_id: "mock-user-001",
    location_lat: -8.8,
    location_lng: 13.2,
    likes_count: 24,
    is_liked: false,
    comments: [],
    commentsLoaded: true,
    user_verified: true,
  },
  {
    id: "mock-mandioca-002",
    product_type: "Mandioca",
    description: "Mandioca fresca para fornecimento em quantidade. Disponível para compradores B2B.",
    quantity: 8000,
    harvest_date: "2026-10-02",
    price: 420,
    province_id: "Uíge",
    municipality_id: "Uíge",
    farmer_name: "Cooperativa Uíge Verde",
    contact: "+244 900 000 002",
    photos: [
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
      "https://images.unsplash.com/photo-1603048719539-9ecb4f1f3b4f?w=1200",
      "https://images.unsplash.com/photo-1582515073490-399813b9d3a2?w=1200",
    ],
    status: "active",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    user_id: "mock-user-002",
    location_lat: -7.6,
    location_lng: 15.1,
    likes_count: 17,
    is_liked: false,
    comments: [],
    commentsLoaded: true,
    user_verified: true,
  },
  {
    id: "mock-milho-003",
    product_type: "Milho",
    description: "Milho amarelo produzido por agricultores locais, disponível para compradores e distribuidores.",
    quantity: 12000,
    harvest_date: "2026-10-10",
    price: 650,
    province_id: "Huambo",
    municipality_id: "Huambo",
    farmer_name: "Agro Huambo",
    contact: "+244 900 000 003",
    photos: [
      "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=1200",
      "https://images.unsplash.com/photo-1601593768792-7c4e7c0d7c6b?w=1200",
      "https://images.unsplash.com/photo-1603048719539-9ecb4f1f3b4f?w=1200",
    ],
    status: "active",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    user_id: "mock-user-003",
    location_lat: -12.7,
    location_lng: 15.7,
    likes_count: 31,
    is_liked: false,
    comments: [],
    commentsLoaded: true,
    user_verified: true,
  },
  {
    id: "mock-banana-004",
    product_type: "Banana",
    description: "Banana fresca para comercialização. Produção disponível para supermercados e distribuidores.",
    quantity: 4500,
    harvest_date: "2026-09-28",
    price: 700,
    province_id: "Malanje",
    municipality_id: "Malanje",
    farmer_name: "Fazenda Malanje",
    contact: "+244 900 000 004",
    photos: [
      "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=1200",
      "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=1200",
      "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=1200",
    ],
    status: "active",
    created_at: new Date(Date.now() - 259200000).toISOString(),
    user_id: "mock-user-004",
    location_lat: -9.5,
    location_lng: 16.3,
    likes_count: 12,
    is_liked: false,
    comments: [],
    commentsLoaded: true,
    user_verified: false,
  },
];

/* ------------------------- micro-animação de toque ------------------------- */

function PressableScale({
  children,
  onPress,
  className,
  scale = 0.96,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  scale?: number;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(scale)} onPressOut={() => to(1)}>
      <Animated.View style={{ transform: [{ scale: sc }] }}>
        <View className={className}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------ categoria pill ------------------------------ */

function CategoryPill({
  category,
  label,
  selected,
  onPress,
}: {
  category: (typeof CATEGORIES)[number];
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      className={`h-[36px] flex-row items-center gap-[6px] rounded-[10px] border px-[12px] ${
        selected ? "border-[#2E8B4F] bg-[#2E8B4F]" : "border-[#E8ECE6] bg-white"
      }`}
    >
      <Icon name={category.icon} size={15} color={selected ? COLORS.white : COLORS.muted} />
      <Text className={`text-[12.5px] ${selected ? "font-bold text-white" : "font-semibold text-[#16231C]"}`}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ================================== HOME ================================== */

type HomeFeedItem =
  | { key: string; type: 'product'; product: Product }
  | { key: string; type: 'ad'; ad: AgrilinkAd };

export default function HomeScreen() {
  const { role, loading: roleLoading } = useUserRole();
  if (!roleLoading && role === "motorista") return <Redirect href="/entregas" />;
  return <HomeFeed />;
}

function HomeFeed() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[]>([]);
  const [ads, setAds] = useState<AgrilinkAd[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasRealProducts, setHasRealProducts] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [paymentProduct, setPaymentProduct] = useState<Product | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);

  // animação do scroll: a sombra do header aparece ao descer
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBorder = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // modal dos países
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const openCountryModal = () => {
    setCountryModalVisible(true);
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 5 }).start();
  };
  const closeCountryModal = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setCountryModalVisible(false));
  };

  const requireLogin = useCallback(() => {
    Alert.alert("Autenticação", "Entre na sua conta para continuar.");
    router.push("/login");
  }, [router]);

  const checkSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setCurrentUserId(session.user.id);
  };

  const loadUnreadNotifications = useCallback(async (userId: string | null) => {
    if (!userId) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
      setUnreadNotifications(count || 0);
    } catch (error) {
      console.log("Erro ao carregar notificações:", error);
    }
  }, []);

  const loadProducts = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;

      setCurrentUserId(userId);
      await loadUnreadNotifications(userId);

      const [adminAllowed, activeAds] = await Promise.all([
        userId ? isAgrilinkAdmin().catch(() => false) : Promise.resolve(false),
        loadAgrilinkAds({ activeOnly: true, userId }).catch((adsError) => {
          console.warn('Não foi possível carregar publicidade:', adsError);
          return [] as AgrilinkAd[];
        }),
      ]);
      setIsAdmin(adminAllowed);
      setAds(activeAds);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Erro ao carregar produtos:", error);
        setHasRealProducts(false);
        setProducts(MOCK_PRODUCTS);
        return;
      }

      let loadedProducts: Product[] = (data || []).map((item: any) => ({
        ...item,
        photos: Array.isArray(item.photos) ? item.photos : [],
        likes_count: 0,
        is_liked: false,
        comments: [],
        commentsLoaded: false,
        user_verified: !!item.user_verified,
      }));

      if (loadedProducts.length === 0) {
        setHasRealProducts(false);
        setProducts(MOCK_PRODUCTS);
        return;
      }
      setHasRealProducts(true);

      // Fotos de perfil dos produtores (tabela "users", coluna "avatar_url" —
      // a mesma que o ecrã de perfil atualiza). Falha em silêncio e o cartão
      // mostra as iniciais.
      try {
        const userIds = Array.from(new Set(loadedProducts.map((p) => p.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("users")
            .select("id, avatar_url")
            .in("id", userIds);
          if (profiles) {
            const avatarById = new Map<string, string | null>(
              profiles.map((p: any) => [p.id, p.avatar_url ?? null])
            );
            loadedProducts = loadedProducts.map((p) => ({
              ...p,
              user_avatar: p.user_avatar ?? avatarById.get(p.user_id) ?? null,
            }));
          }
        }
      } catch (avatarError) {
        console.log("Erro ao carregar fotos de perfil:", avatarError);
      }

      const productIds = loadedProducts.map((p) => p.id);
      const { data: likes } = await supabase
        .from("product_likes")
        .select("product_id, user_id")
        .in("product_id", productIds);

      if (likes) {
        loadedProducts = loadedProducts.map((product) => {
          const productLikes = likes.filter((l: any) => l.product_id === product.id);
          return {
            ...product,
            likes_count: productLikes.length,
            is_liked: !!userId && productLikes.some((l: any) => l.user_id === userId),
          };
        });
      }

      setProducts(loadedProducts);
    } catch (error) {
      console.log("Erro inesperado:", error);
      setHasRealProducts(false);
      setProducts(MOCK_PRODUCTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkSession();
      loadProducts();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
  };

  const handleProductUpdate = useCallback((updated: Product) => {
    setProducts((current) => current.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleAdRating = useCallback(async (adId: string, rating: number) => {
    const result = await rateAgrilinkAd(adId, rating);
    if (!result) return;
    setAds((current) => current.map((ad) => ad.id === adId
      ? { ...ad, current_rating: rating, rating_average: result.rating_average, rating_count: result.rating_count }
      : ad));
  }, []);

  const selectCategory = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategory(id);
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const text = search.toLowerCase().trim();
      result = result.filter((p) => {
        const type = p.product_type?.toLowerCase() || "";
        const description = p.description?.toLowerCase() || "";
        const farmer = p.farmer_name?.toLowerCase() || "";
        return type.includes(text) || description.includes(text) || farmer.includes(text);
      });
    }

    if (selectedCategory !== "all") {
      result = result.filter((p) => {
        const type = p.product_type?.toLowerCase().trim() || "";
        const words = CATEGORY_MAP[selectedCategory];
        if (!words) return type.includes(selectedCategory);
        return words.some((w) => type.includes(w));
      });
    }

    return result;
  }, [products, search, selectedCategory]);

  const feedItems = useMemo<HomeFeedItem[]>(() => {
    const includeAds = selectedCategory === 'all' && !search.trim();
    const rankedAds = includeAds
      ? [...ads].sort((a, b) => {
          const scoreA = Number(a.rating_average || 0) + Math.log2(Number(a.rating_count || 0) + 1) * 0.025;
          const scoreB = Number(b.rating_average || 0) + Math.log2(Number(b.rating_count || 0) + 1) * 0.025;
          return scoreB - scoreA || b.created_at.localeCompare(a.created_at);
        })
      : [];
    const rotation = rankedAds.length > 1
      ? Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % rankedAds.length
      : 0;
    const rotatedAds = rankedAds.slice(rotation).concat(rankedAds.slice(0, rotation));
    const items: HomeFeedItem[] = [];
    let adIndex = 0;

    filteredProducts.forEach((product, index) => {
      items.push({ key: `product:${product.id}`, type: 'product', product });
      const isSlot = (index + 1) % 4 === 0 || (index === filteredProducts.length - 1 && filteredProducts.length < 4);
      if (isSlot && adIndex < rotatedAds.length) {
        const ad = rotatedAds[adIndex++];
        items.push({ key: `ad:${ad.id}`, type: 'ad', ad });
      }
    });

    return items;
  }, [ads, filteredProducts, search, selectedCategory]);

  const openPayment = (product: Product) => {
    if (product.id.startsWith("mock-")) {
      Alert.alert(
        "Demonstração",
        "Esta publicação é apenas uma demonstração. As compras estarão disponíveis nas publicações reais."
      );
      return;
    }
    if (!currentUserId) {
      requireLogin();
      return;
    }
    setPaymentProduct(product);
    setPaymentVisible(true);
  };

  const handlePaid = ({ order }: { payment: any; order: any }) => {
    if (paymentProduct) {
      setProducts((current) =>
        current.map((p) =>
          p.id === paymentProduct.id
            ? { ...p, quantity: Math.max(0, Number(p.quantity) - Number(order?.quantity ?? 0)) }
            : p
        )
      );
    }
  };

  const handleViewHistory = ({ intentId, orderId }: { intentId?: string; orderId?: string }) => {
    router.push({ pathname: "/historico", params: { intentId, orderId } } as any);
  };

  /* --------------------------------- loading --------------------------------- */

  if (loading) {
    return <ProcessingScreen />;
  }

  /* ---------------------------------- render ---------------------------------- */

  return (
    <SafeAreaView className="flex-1 bg-[#F6F8F5]">
      <StatusBar barStyle="dark-content" backgroundColor="#F6F8F5" />

      <View className="flex-1 bg-[#F6F8F5]">
        {/* HEADER */}
        <View
          className="z-10 flex-row items-center justify-between border-b border-[#E8ECE6] bg-white px-[18px] pb-3"
          style={{ paddingTop: insets.top + 14, height: 78 + insets.top }}
        >
          <Image source={Logo} style={{ width: 138, height: 48 }} resizeMode="contain" />

          <View className="flex-row items-center gap-2">
            <PressableScale
              onPress={openCountryModal}
              className="flex-row items-center gap-2 rounded-[10px] bg-[#E9F5EC] px-[10px] py-[6px]"
            >
              <Text className="text-[19px]">{selectedCountry.flag}</Text>
              <View>
                <Text className="text-[10px] font-semibold text-[#78877D]">{t('home.country')}</Text>
                <Text className="text-[12px] font-extrabold text-[#16231C]">{selectedCountry.name}</Text>
              </View>
              <Icon name="chevron-down" size={16} color={COLORS.text} />
            </PressableScale>

            <PressableScale
              onPress={() => router.push("/notifications")}
              className="h-10 w-10 items-center justify-center rounded-[10px] bg-[#E9F5EC]"
            >
              <Icon name="bell" size={20} color={COLORS.text} />
              {unreadNotifications > 0 ? (
                <View className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#DD5138] px-1">
                  {unreadNotifications <= 9 ? (
                    <Text className="text-[10px] font-extrabold text-white">{unreadNotifications}</Text>
                  ) : null}
                </View>
              ) : null}
            </PressableScale>
          </View>
        </View>

        {/* sombra suave que aparece ao fazer scroll */}
        <Animated.View
          pointerEvents="none"
          className="absolute left-0 right-0 z-[9] h-[10px] bg-[rgba(22,35,28,0.05)]"
          style={{ top: 78 + insets.top, opacity: headerBorder }}
        />

        {/* FEED */}
        <Animated.FlatList
          data={feedItems}
          keyExtractor={(item: HomeFeedItem) => item.key}
          renderItem={({ item }: { item: HomeFeedItem }) => item.type === 'product' ? (
            <ProductCard
              product={item.product}
              currentUserId={currentUserId}
              onProductUpdate={handleProductUpdate}
              onOpenPreOrder={openPayment}
              onRequireLogin={requireLogin}
            />
          ) : (
            <AgrilinkAdCard
              ad={item.ad}
              currentUserId={currentUserId}
              onRequireLogin={requireLogin}
              onRate={handleAdRating}
            />
          )}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View>
              {/* Pesquisa */}
              <PressableScale
                onPress={() => router.push("/search")}
                className="mx-[18px] mb-5 mt-4 h-[46px] flex-row items-center gap-[10px] rounded-[12px] border border-[#E8ECE6] bg-white px-4"
                scale={0.98}
              >
                <Icon name="search" size={17} color={COLORS.muted} />
                <Text className="text-[15px] text-[#78877D]">{t('home.search')}</Text>
              </PressableScale>

              {isAdmin && (
                <PressableScale
                  onPress={() => router.push('/dashboard' as any)}
                  className="mx-[18px] mb-4 min-h-[42px] flex-row items-center justify-between rounded-[10px] border border-[#CFE9D6] bg-white px-3"
                >
                  <View className="flex-row items-center gap-2">
                    <Icon name="bar-chart" size={16} color={COLORS.primary} />
                    <Text className="text-[12px] font-extrabold text-[#25703F]">{t('home.admin')}</Text>
                  </View>
                  <Icon name="arrow-right" size={15} color={COLORS.primary} />
                </PressableScale>
              )}

              {/* Categorias */}
              <View className="mb-3 flex-row items-center justify-between px-[18px]">
                <Text className="text-[17px] font-extrabold tracking-tight text-[#16231C]">{t('home.categories')}</Text>
                <Text className="text-[11px] font-semibold text-[#78877D]">{CATEGORIES.length - 1} {t('home.options')}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 4, gap: 8 }}
              >
                {CATEGORIES.map((category) => (
                  <CategoryPill
                    key={category.id}
                    category={category}
                    label={t(CATEGORY_TRANSLATION_KEYS[category.id])}
                    selected={selectedCategory === category.id}
                    onPress={() => selectCategory(category.id)}
                  />
                ))}
              </ScrollView>

              {/* Título do feed */}
              <View className="mb-3 mt-6 flex-row items-center justify-between px-[18px]">
                <View className="shrink pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[17px] font-extrabold tracking-tight text-[#16231C]">{t('home.feed')}</Text>
                    {!hasRealProducts ? (
                      <View className="rounded-[4px] border border-[#F1D1A5] bg-[#FBEBD3] px-[6px] py-[2px]">
                        <Text className="text-[8px] font-black tracking-wider text-[#B9741A]">{t('home.demo')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-[12px] text-[#78877D]">
                    {hasRealProducts ? t('home.realInventory') : t('home.demoInventory')}
                  </Text>
                </View>

                <View className="min-h-[26px] items-center justify-center rounded-[8px] bg-[#E9F5EC] px-[9px] py-1">
                  <Text className="text-[10px] font-extrabold text-[#25703F]">
                    {t('home.productsAndAds', { products: filteredProducts.length, ads: feedItems.filter((item) => item.type === 'ad').length })}
                  </Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center px-[30px] pb-10 pt-[45px]">
              <View className="h-[80px] w-[80px] items-center justify-center rounded-[16px] bg-[#E9F5EC]">
                <Icon name="sprout" size={40} color={COLORS.primary} />
              </View>
              <Text className="mt-[15px] text-center text-[17px] font-extrabold text-[#16231C]">
                {t('home.emptyTitle')}
              </Text>
              <Text className="mt-[7px] text-center text-[13px] leading-5 text-[#78877D]">
                {t('home.emptyDescription')}
              </Text>
              <PressableScale
                onPress={() => {
                  selectCategory("all");
                  setSearch("");
                }}
                className="mt-[17px] rounded-[10px] bg-[#E9F5EC] px-5 py-[11px]"
              >
                <Text className="text-[13px] font-extrabold text-[#25703F]">{t('home.clearFilters')}</Text>
              </PressableScale>
            </View>
          }
          ListFooterComponent={
            filteredProducts.length > 0 ? (
              <View className="flex-row items-center justify-center gap-[7px] py-[25px]">
                <Icon name="check-circle" size={18} color={COLORS.primary} />
                <Text className="text-[11px] text-[#78877D]">
                  {hasRealProducts ? t('home.realPosts') : t('home.demoPosts')}
                </Text>
              </View>
            ) : null
          }
        />

        <BottomToolbar />
      </View>

      {/* MODAL PAÍSES */}
      <Modal visible={countryModalVisible} transparent animationType="none" onRequestClose={closeCountryModal}>
        <Animated.View className="flex-1 justify-end bg-[rgba(15,20,17,0.5)]" style={{ opacity: sheetAnim }}>
          <Pressable style={{ flex: 1 }} onPress={closeCountryModal} />
          <Animated.View
            className="rounded-t-[16px] bg-white px-5 pb-[30px] pt-[13px]"
            style={{
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }],
            }}
          >
            <View className="mb-5 h-[4px] w-10 self-center rounded-full bg-[#E8ECE6]" />
            <Text className="text-[20px] font-extrabold text-[#16231C]">{t('home.chooseCountry')}</Text>
            <Text className="mb-5 mt-[5px] text-[13px] text-[#78877D]">
              {t('home.countryDescription')}
            </Text>

            {COUNTRIES.map((country) => {
              const selected = country.code === selectedCountry.code;
              return (
                <PressableScale
                  key={country.code}
                  scale={0.98}
                  onPress={() => {
                    setSelectedCountry(country);
                    closeCountryModal();
                  }}
                  className={`mb-[10px] min-h-[66px] flex-row items-center rounded-[12px] border px-3 ${
                    selected ? "border-[#9ED5AC] bg-[#E9F5EC]" : "border-[#E8ECE6] bg-white"
                  }`}
                >
                  <View className="h-[44px] w-[44px] items-center justify-center rounded-[10px] bg-[#F6F8F5]">
                    <Text className="text-[26px]">{country.flag}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[14px] font-extrabold text-[#16231C]">{country.name}</Text>
                    <Text className="mt-[3px] text-[11px] text-[#78877D]">{t('home.currency', { currency: country.currency })}</Text>
                  </View>
                  {selected ? (
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-[#2E8B4F]">
                      <Icon name="check" size={16} color={COLORS.white} strokeWidth={3} />
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* PAGAMENTO */}
      <PaymentSheet
        product={paymentProduct}
        visible={paymentVisible}
        onClose={() => setPaymentVisible(false)}
        onPaid={handlePaid}
        onViewHistory={handleViewHistory}
      />
    </SafeAreaView>
  );
}