import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PaymentSheet from "@/components/PaymentSheet";
import ProductCard, { Product } from "@/components/ProductCard";
import AgrilinkAdCard from "../components/AgrilinkAdCard";
import BottomToolbar from "../components/BottomToolbar";
import Icon, { IconName } from "../components/Icon";
import ProcessingScreen from "../components/ProcessingScreen";
import { COLORS, PressableScale, SHADOW } from "../components/ui";
import { useUserRole } from "../context/RoleContext";
import { AgrilinkAd, isAgrilinkAdmin, loadAgrilinkAds, rateAgrilinkAd } from "../lib/agrilinkAds";
import { supabase } from "../lib/supabase";
import { AppLanguage, changeAppLanguage, LANGUAGE_STORAGE_KEY } from "../constants/i18n";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Logo = require("../assets/images/logo.jpeg");

const COUNTRY_STORAGE_KEY = "agrilink-country";
const COUNTRIES: { code: string; flag: string; currency: string; language: AppLanguage }[] = [
  { code: "AO", flag: "🇦🇴", currency: "Kz", language: "pt-AO" },
  { code: "CD", flag: "🇨🇩", currency: "FC", language: "fr-CD" },
  { code: "ZA", flag: "🇿🇦", currency: "ZAR", language: "en-ZA" },
  { code: "NA", flag: "🇳🇦", currency: "NAD", language: "en-ZA" },
  { code: "ZM", flag: "🇿🇲", currency: "ZMW", language: "en-ZA" },
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
  all: "home.all",
  frutas: "home.fruits",
  citrus: "home.citrus",
  legumes: "home.vegetables",
  verduras: "home.greens",
  cereais: "home.grains",
  temperos: "home.spices",
  pescado: "home.fish",
  carnes: "home.meat",
  ovos: "home.eggs",
  paes: "home.bread",
  lacteos: "home.dairy",
  bebidas: "home.drinks",
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
const mockProduct = (
  n: string,
  type: string,
  description: string,
  quantity: number,
  harvest_date: string,
  price: number,
  province: string,
  municipality: string,
  farmer: string,
  photos: string[],
  likes: number,
  lat: number,
  lng: number,
  verified: boolean,
  daysAgo: number
): Product => ({
  id: `mock-${type.toLowerCase()}-${n}`,
  product_type: type,
  description,
  quantity,
  harvest_date,
  price,
  province_id: province,
  municipality_id: municipality,
  farmer_name: farmer,
  contact: `+244 900 000 ${n}`,
  photos,
  status: "active",
  created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  user_id: `mock-user-${n}`,
  location_lat: lat,
  location_lng: lng,
  likes_count: likes,
  is_liked: false,
  comments: [],
  commentsLoaded: true,
  user_verified: verified,
});

const MOCK_PRODUCTS: Product[] = [
  mockProduct("001", "Tomate", "Tomate fresco selecionado, ideal para mercados, restaurantes e distribuidores.", 2500, "2026-09-25", 850, "Bengo", "Dande", "Agro Bengo", [
    "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=1200",
    "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
    "https://images.unsplash.com/photo-1561136594-7f68413baa99?w=1200",
  ], 24, -8.8, 13.2, true, 0),
  mockProduct("002", "Mandioca", "Mandioca fresca para fornecimento em quantidade. Disponível para compradores B2B.", 8000, "2026-10-02", 420, "Uíge", "Uíge", "Cooperativa Uíge Verde", [
    "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
    "https://images.unsplash.com/photo-1603048719539-9ecb4f1f3b4f?w=1200",
    "https://images.unsplash.com/photo-1582515073490-399813b9d3a2?w=1200",
  ], 17, -7.6, 15.1, true, 1),
  mockProduct("003", "Milho", "Milho amarelo produzido por agricultores locais, disponível para compradores e distribuidores.", 12000, "2026-10-10", 650, "Huambo", "Huambo", "Agro Huambo", [
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=1200",
    "https://images.unsplash.com/photo-1601593768792-7c4e7c0d7c6b?w=1200",
    "https://images.unsplash.com/photo-1603048719539-9ecb4f1f3b4f?w=1200",
  ], 31, -12.7, 15.7, true, 2),
  mockProduct("004", "Banana", "Banana fresca para comercialização. Produção disponível para supermercados e distribuidores.", 4500, "2026-09-28", 700, "Malanje", "Malanje", "Fazenda Malanje", [
    "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=1200",
    "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=1200",
    "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=1200",
  ], 12, -9.5, 16.3, false, 3),
];

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
      scale={0.93}
      className="h-[40px] flex-row items-center gap-[7px] rounded-[10px] px-[15px]"
      style={[
        { backgroundColor: selected ? COLORS.primary : COLORS.white },
        selected ? SHADOW.glow : SHADOW.tiny,
      ]}
    >
      <Icon name={category.icon} size={16} color={selected ? COLORS.white : COLORS.primary} />
      <Text className={`text-[13px] ${selected ? "font-extrabold text-white" : "font-bold text-[#16231C]"}`}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ================================== HOME ================================== */

type HomeFeedItem =
  | { key: string; type: "product"; product: Product }
  | { key: string; type: "ad"; ad: AgrilinkAd };

export default function HomeScreen() {
  const { role, loading: roleLoading } = useUserRole();
  if (!roleLoading && role === "motorista") return <Redirect href="/entregas" />;
  return <HomeFeed />;
}

function HomeFeed() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useUserRole();

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

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(COUNTRY_STORAGE_KEY)
      .then((savedCode) => {
        const savedCountry = COUNTRIES.find((country) => country.code === savedCode);
        if (mounted && savedCountry) setSelectedCountry(savedCountry);
      })
      .catch((error) => {
        console.warn("[Country] Não foi possível restaurar o país selecionado:", error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const [paymentProduct, setPaymentProduct] = useState<Product | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);

  // a sombra do header surge suavemente ao descer
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerShadow = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // modal dos países: fundo esbate, folha desliza
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const openCountryModal = () => {
    setCountryModalVisible(true);
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
  };
  const closeCountryModal = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
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
      if (!isGuest) router.replace("/login");
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
          console.warn("Não foi possível carregar publicidade:", adsError);
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

      // Fotos de perfil dos produtores (tabela "users", coluna "avatar_url").
      // Falha em silêncio e o cartão mostra as iniciais.
      try {
        const userIds = Array.from(new Set(loadedProducts.map((p) => p.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from("users").select("id, avatar_url").in("id", userIds);
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
    }, [isGuest])
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
    setAds((current) =>
      current.map((ad) =>
        ad.id === adId
          ? { ...ad, current_rating: rating, rating_average: result.rating_average, rating_count: result.rating_count }
          : ad
      )
    );
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
    const includeAds = selectedCategory === "all" && !search.trim();
    const rankedAds = includeAds
      ? [...ads].sort((a, b) => {
          const scoreA = Number(a.rating_average || 0) + Math.log2(Number(a.rating_count || 0) + 1) * 0.025;
          const scoreB = Number(b.rating_average || 0) + Math.log2(Number(b.rating_count || 0) + 1) * 0.025;
          return scoreB - scoreA || b.created_at.localeCompare(a.created_at);
        })
      : [];
    const rotation =
      rankedAds.length > 1 ? Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % rankedAds.length : 0;
    const rotatedAds = rankedAds.slice(rotation).concat(rankedAds.slice(0, rotation));
    const items: HomeFeedItem[] = [];
    let adIndex = 0;

    filteredProducts.forEach((product, index) => {
      items.push({ key: `product:${product.id}`, type: "product", product });
      const isSlot =
        (index + 1) % 4 === 0 || (index === filteredProducts.length - 1 && filteredProducts.length < 4);
      if (isSlot && adIndex < rotatedAds.length) {
        const ad = rotatedAds[adIndex++];
        items.push({ key: `ad:${ad.id}`, type: "ad", ad });
      }
    });

    return items;
  }, [ads, filteredProducts, search, selectedCategory]);

  const adsCount = useMemo(() => feedItems.filter((item) => item.type === "ad").length, [feedItems]);

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

  const headerHeight = 78 + insets.top;

  return (
    <SafeAreaView className="flex-1 bg-[#F5F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F5F8F4" />

      <View className="flex-1 bg-[#F5F8F4]">
        {/* HEADER */}
        <View
          className="z-10 flex-row items-center justify-between bg-white px-[18px] pb-3"
          style={{ paddingTop: insets.top + 14, height: headerHeight }}
        >
          <Image source={Logo} style={{ width: 138, height: 48 }} resizeMode="contain" />

          <View className="flex-row items-center gap-[10px]">
            <PressableScale
              onPress={openCountryModal}
              className="flex-row items-center gap-2 rounded-[10px] bg-[#E9F5EC] py-[6px] pl-[10px] pr-[12px]"
            >
              <Text className="text-[20px]">{selectedCountry.flag}</Text>
              <View>
                <Text className="text-[10px] font-semibold text-[#78877D]">{t("home.country")}</Text>
                <Text className="text-[12px] font-extrabold text-[#16231C]">
                  {t(`home.countries.${selectedCountry.code}`)}
                </Text>
              </View>
              <Icon name="chevron-down" size={15} color={COLORS.text} />
            </PressableScale>

            {!isGuest ? (
              <PressableScale
                onPress={() => router.push("/notifications")}
                scale={0.9}
                className="h-10 w-10 items-center justify-center rounded-[10px] bg-[#E9F5EC]"
              >
                <Icon name="bell" size={20} color={COLORS.text} />
                {unreadNotifications > 0 ? (
                  <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#E0523A] px-1">
                    {unreadNotifications <= 9 ? (
                      <Text className="text-[10px] font-extrabold text-white">{unreadNotifications}</Text>
                    ) : null}
                  </View>
                ) : null}
              </PressableScale>
            ) : null}
          </View>
        </View>

        {/* sombra em degradé que desce do header ao fazer scroll */}
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, top: headerHeight, height: 18, zIndex: 9, opacity: headerShadow }}
        >
          <LinearGradient colors={["rgba(22,35,28,0.09)", "rgba(22,35,28,0)"]} style={{ flex: 1 }} />
        </Animated.View>

        {/* FEED */}
        <Animated.FlatList
          data={feedItems}
          keyExtractor={(item: HomeFeedItem) => item.key}
          renderItem={({ item }: { item: HomeFeedItem }) =>
            item.type === "product" ? (
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
            )
          }
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View>
              {/* Pesquisa */}
              <PressableScale
                onPress={() => router.push("/search")}
                className="mx-4 mb-4 mt-4 h-[50px] flex-row items-center gap-[10px] rounded-[12px] bg-white pl-[18px] pr-[7px]"
                style={SHADOW.soft}
                scale={0.98}
              >
                <Icon name="search" size={18} color={COLORS.muted} />
                <Text className="flex-1 text-[15px] text-[#78877D]">{t("home.search")}</Text>
                <LinearGradient
                  colors={[COLORS.primaryLight, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 38, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center" }}
                >
                  <Icon name="search" size={16} color={COLORS.white} />
                </LinearGradient>
              </PressableScale>

              {/* Duas entradas principais */}
              <View className="mx-4 mb-5 flex-row gap-3">
                <View style={[{ flex: 1, borderRadius: 12 }, SHADOW.glow]}>
                  <LinearGradient
                    colors={[COLORS.primaryLight, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 12, padding: 14, minHeight: 84, justifyContent: "space-between", overflow: "hidden" }}
                  >
                    {/* círculos de luz decorativos */}
                    <View
                      pointerEvents="none"
                      style={{ position: "absolute", right: -22, top: -22, width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,255,255,0.14)" }}
                    />
                    <View
                      pointerEvents="none"
                      style={{ position: "absolute", right: 18, bottom: -30, width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.08)" }}
                    />
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.22)]">
                      <Icon name="cart" size={16} color={COLORS.white} />
                    </View>
                    <Text className="mt-2 text-[13px] font-extrabold text-white">{t("home.buyPlatform")}</Text>
                  </LinearGradient>
                </View>

                <PressableScale fill onPress={() => router.push("/green-points")} scale={0.96}>
                  <View
                    style={[
                      { flex: 1, borderRadius: 12, backgroundColor: COLORS.white, padding: 14, minHeight: 84, justifyContent: "space-between" },
                      SHADOW.soft,
                    ]}
                  >
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E9F5EC]">
                      <Icon name="pin" size={16} color={COLORS.primary} />
                    </View>
                    <Text className="mt-2 text-[13px] font-extrabold text-[#237040]">{t("home.buyGreenPoints")}</Text>
                  </View>
                </PressableScale>
              </View>

              {isAdmin && (
                <PressableScale
                  onPress={() => router.push("/dashboard" as any)}
                  className="mx-4 mb-5 min-h-[46px] flex-row items-center justify-between rounded-[10px] bg-white px-4"
                  style={SHADOW.tiny}
                >
                  <View className="flex-row items-center gap-2">
                    <Icon name="bar-chart" size={16} color={COLORS.primary} />
                    <Text className="text-[12.5px] font-extrabold text-[#237040]">{t("home.admin")}</Text>
                  </View>
                  <Icon name="arrow-right" size={15} color={COLORS.primary} />
                </PressableScale>
              )}

              {/* Categorias */}
              <View className="mb-3 flex-row items-center justify-between px-[18px]">
                <Text className="text-[18px] font-black tracking-tight text-[#16231C]">{t("home.categories")}</Text>
                <Text className="text-[11.5px] font-semibold text-[#78877D]">
                  {CATEGORIES.length - 1} {t("home.options")}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14, gap: 10 }}
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
              <View className="mb-3 mt-3 flex-row items-center justify-between px-[18px]">
                <View className="shrink pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[18px] font-black tracking-tight text-[#16231C]">{t("home.feed")}</Text>
                    {!hasRealProducts ? (
                      <View className="rounded-[4px] bg-[#FBEBD3] px-[7px] py-[2px]">
                        <Text className="text-[8.5px] font-black tracking-wider text-[#B9741A]">{t("home.demo")}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-[12px] text-[#78877D]">
                    {hasRealProducts ? t("home.realInventory") : t("home.demoInventory")}
                  </Text>
                </View>

                <View className="min-h-[28px] items-center justify-center rounded-[8px] bg-[#E9F5EC] px-[11px] py-1">
                  <Text className="text-[10.5px] font-extrabold text-[#237040]">
                    {t("home.productsAndAds", { products: filteredProducts.length, ads: adsCount })}
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
              <Text className="mt-[16px] text-center text-[17px] font-extrabold text-[#16231C]">
                {t("home.emptyTitle")}
              </Text>
              <Text className="mt-[7px] text-center text-[13px] leading-5 text-[#78877D]">
                {t("home.emptyDescription")}
              </Text>
              <PressableScale
                onPress={() => {
                  selectCategory("all");
                  setSearch("");
                }}
                className="mt-[18px] rounded-[10px] bg-[#E9F5EC] px-6 py-[12px]"
              >
                <Text className="text-[13px] font-extrabold text-[#237040]">{t("home.clearFilters")}</Text>
              </PressableScale>
            </View>
          }
          ListFooterComponent={
            filteredProducts.length > 0 ? (
              <View className="flex-row items-center justify-center gap-[7px] py-[25px]">
                <Icon name="check-circle" size={18} color={COLORS.primary} />
                <Text className="text-[11.5px] text-[#78877D]">
                  {hasRealProducts ? t("home.realPosts") : t("home.demoPosts")}
                </Text>
              </View>
            ) : null
          }
        />

        <BottomToolbar />
      </View>

      {/* MODAL PAÍSES */}
      <Modal visible={countryModalVisible} transparent animationType="none" onRequestClose={closeCountryModal}>
        <View className="flex-1 justify-end">
          <Animated.View
            pointerEvents="none"
            style={{ ...absoluteFill, backgroundColor: "rgba(15,20,17,0.5)", opacity: sheetAnim }}
          />
          <Pressable style={{ flex: 1 }} onPress={closeCountryModal} />
          <Animated.View
            className="rounded-t-[16px] bg-white px-5 pb-[34px] pt-[12px]"
            style={{
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [380, 0] }) }],
            }}
          >
            <View className="mb-5 h-[5px] w-11 self-center rounded-full bg-[#E3E8E1]" />
            <Text className="text-[21px] font-black tracking-tight text-[#16231C]">{t("home.chooseCountry")}</Text>
            <Text className="mb-5 mt-[5px] text-[13px] text-[#78877D]">{t("home.countryDescription")}</Text>

            {COUNTRIES.map((country) => {
              const selected = country.code === selectedCountry.code;
              return (
                <PressableScale
                  key={country.code}
                  scale={0.98}
                  onPress={async () => {
                    setSelectedCountry(country);
                    closeCountryModal();
                    try {
                      await AsyncStorage.setItem(COUNTRY_STORAGE_KEY, country.code);
                      await changeAppLanguage(country.language);
                      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, country.language);
                    } catch (error) {
                      console.error("[Country] Não foi possível guardar país/idioma:", error);
                      Alert.alert(t("settings.languageSaveError"));
                    }
                  }}
                  className="mb-[10px] min-h-[66px] flex-row items-center rounded-[12px] px-3"
                  style={{ backgroundColor: selected ? COLORS.tint : "#F7F9F6" }}
                >
                  <View className="h-[44px] w-[44px] items-center justify-center rounded-[10px] bg-white">
                    <Text className="text-[26px]">{country.flag}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[14.5px] font-extrabold text-[#16231C]">
                      {t(`home.countries.${country.code}`)}
                    </Text>
                    <Text className="mt-[3px] text-[11.5px] text-[#78877D]">
                      {t("home.currency", { currency: country.currency })}
                    </Text>
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
        </View>
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

const absoluteFill = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;