import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import BottomToolbar from "../components/BottomToolbar";
import Icon, { IconName } from "../components/Icon";
import ProductCard, { Product } from "@/components/ProductCard";
import PaymentSheet from "@/components/PaymentSheet";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Logo = require("../assets/images/logo.jpeg");

const COLORS = {
  primary: "#1F6B3A",
  text: "#16231C",
  muted: "#78877D",
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
  scale = 0.95,
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
  selected,
  onPress,
}: {
  category: (typeof CATEGORIES)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      className={`h-[36px] flex-row items-center gap-[6px] rounded-full border px-[14px] ${
        selected ? "border-[#1F6B3A] bg-[#1F6B3A]" : "border-[#EAE4D6] bg-white"
      }`}
    >
      <Icon name={category.icon} size={15} color={selected ? COLORS.white : COLORS.muted} />
      <Text className={`text-[12.5px] ${selected ? "font-bold text-white" : "font-semibold text-[#16231C]"}`}>
        {category.name}
      </Text>
    </PressableScale>
  );
}

/* ================================== HOME ================================== */

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[]>([]);
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
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Image source={Logo} style={{ width: 200, height: 88 }} resizeMode="contain" />
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 18 }} />
        <Text className="mt-4 text-[13px] text-[#78877D]">A carregar publicações...</Text>
      </SafeAreaView>
    );
  }

  /* ---------------------------------- render ---------------------------------- */

  return (
    <SafeAreaView className="flex-1 bg-[#FAF8F3]">
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F3" />

      <View className="flex-1 bg-[#FAF8F3]">
        {/* HEADER */}
        <View
          className="z-10 flex-row items-center justify-between rounded-b-[24px] bg-white px-[18px] pb-3"
          style={{ paddingTop: insets.top + 14, height: 78 + insets.top }}
        >
          <Image source={Logo} style={{ width: 138, height: 48 }} resizeMode="contain" />

          <View className="flex-row items-center gap-[10px]">
            <PressableScale
              onPress={openCountryModal}
              className="flex-row items-center gap-2 rounded-[14px] bg-[#EAF3EA] px-[11px] py-[7px]"
            >
              <Text className="text-[20px]">{selectedCountry.flag}</Text>
              <View>
                <Text className="text-[10px] font-semibold text-[#78877D]">País</Text>
                <Text className="text-[12px] font-extrabold text-[#16231C]">{selectedCountry.name}</Text>
              </View>
              <Icon name="chevron-down" size={16} color={COLORS.text} />
            </PressableScale>

            <PressableScale
              onPress={() => router.push("/notifications")}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#EAF3EA]"
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
          className="absolute left-0 right-0 z-[9] h-[14px] bg-[rgba(22,35,28,0.06)]"
          style={{ top: 78 + insets.top, opacity: headerBorder }}
        />

        {/* FEED */}
        <Animated.FlatList
          data={filteredProducts}
          keyExtractor={(item: Product) => String(item.id)}
          renderItem={({ item }: { item: Product }) => (
            <ProductCard
              product={item}
              currentUserId={currentUserId}
              onProductUpdate={handleProductUpdate}
              onOpenPreOrder={openPayment}
              onRequireLogin={requireLogin}
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
                className="mx-[18px] mb-[22px] mt-5 h-[48px] flex-row items-center gap-[10px] rounded-[16px] bg-[#F1EFE8] px-4"
                scale={0.98}
              >
                <Icon name="search" size={17} color={COLORS.muted} />
                <Text className="text-[15px] text-[#78877D]">Pesquisar produtos</Text>
              </PressableScale>

              {/* Categorias */}
              <View className="mb-3 flex-row items-center justify-between px-[18px]">
                <Text className="text-[17px] font-extrabold tracking-tight text-[#16231C]">Categorias</Text>
                <Text className="text-[11px] font-semibold text-[#78877D]">{CATEGORIES.length - 1} opções</Text>
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
                    selected={selectedCategory === category.id}
                    onPress={() => selectCategory(category.id)}
                  />
                ))}
              </ScrollView>

              {/* Título das publicações */}
              <View className="mb-3 mt-6 flex-row items-center justify-between px-[18px]">
                <View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[17px] font-extrabold tracking-tight text-[#16231C]">Publicações</Text>
                    {!hasRealProducts ? (
                      <View className="rounded-full border border-[#F1D1A5] bg-[#FBEBD3] px-2 py-[3px]">
                        <Text className="text-[8px] font-black tracking-wider text-[#B9741A]">DEMO</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-[12px] text-[#78877D]">
                    {hasRealProducts ? "Publicações dos agricultores" : "Exemplos de produtos disponíveis"}
                  </Text>
                </View>

                <View className="h-[26px] min-w-[30px] items-center justify-center rounded-full bg-[#D9EEDD] px-[9px]">
                  <Text className="text-[12px] font-extrabold text-[#1F6B3A]">{filteredProducts.length}</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center px-[30px] pb-10 pt-[45px]">
              <View className="h-[86px] w-[86px] items-center justify-center rounded-[28px] bg-[#D9EEDD]">
                <Icon name="sprout" size={44} color={COLORS.primary} />
              </View>
              <Text className="mt-[15px] text-center text-[17px] font-extrabold text-[#16231C]">
                Nenhum produto encontrado
              </Text>
              <Text className="mt-[7px] text-center text-[13px] leading-5 text-[#78877D]">
                Não encontramos produtos para os filtros selecionados.
              </Text>
              <PressableScale
                onPress={() => {
                  selectCategory("all");
                  setSearch("");
                }}
                className="mt-[17px] rounded-[14px] bg-[#D9EEDD] px-5 py-[11px]"
              >
                <Text className="text-[13px] font-extrabold text-[#1F6B3A]">Limpar filtros</Text>
              </PressableScale>
            </View>
          }
          ListFooterComponent={
            filteredProducts.length > 0 ? (
              <View className="flex-row items-center justify-center gap-[7px] py-[25px]">
                <Icon name="check-circle" size={18} color={COLORS.primary} />
                <Text className="text-[11px] text-[#78877D]">
                  {hasRealProducts ? "Mostrando publicações reais" : "Publicações de demonstração"}
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
            className="rounded-t-[28px] bg-white px-5 pb-[30px] pt-[13px]"
            style={{
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }],
            }}
          >
            <View className="mb-5 h-[5px] w-10 self-center rounded-full bg-[#EAE4D6]" />
            <Text className="text-[21px] font-extrabold text-[#16231C]">Escolha o país</Text>
            <Text className="mb-5 mt-[5px] text-[13px] text-[#78877D]">
              Selecione onde pretende comprar ou vender.
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
                  className={`mb-[10px] min-h-[70px] flex-row items-center rounded-[19px] border px-3 ${
                    selected ? "border-[#8FCB9B] bg-[#EAF3EA]" : "border-[#EAE4D6] bg-white"
                  }`}
                >
                  <View className="h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[#FAF8F3]">
                    <Text className="text-[26px]">{country.flag}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[14px] font-extrabold text-[#16231C]">{country.name}</Text>
                    <Text className="mt-[3px] text-[11px] text-[#78877D]">Moeda: {country.currency}</Text>
                  </View>
                  {selected ? (
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-[#1F6B3A]">
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