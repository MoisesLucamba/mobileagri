import React, { useCallback, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import BottomToolbar from "../components/BottomToolbar";
import ProductCard, { Product } from "@/components/ProductCard";

const Logo = require("../assets/images/logo.jpeg");

// =====================================================
// DESIGN TOKENS
// =====================================================

const COLORS = {
  primary: "#1F6B3A",
  primaryDark: "#123C22",
  primarySoft: "#EAF3EA",
  primaryLight: "#D9EEDD",

  selectedGreen: "#CFEAD3",
  selectedBorder: "#8FCB9B",

  accent: "#E2932F",
  accentDark: "#B9741A",
  accentSoft: "#FBEBD3",

  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",

  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",

  searchFill: "#F1EFE8",

  red: "#DD5138",
  blue: "#4C7EDB",
};

const RADIUS = {
  sm: 10,
  md: 14,
  lg: 19,
  xl: 26,
};

const SHADOW = {
  header: {
    shadowColor: "#16231C",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },
};

// =====================================================
// PAÍSES
// =====================================================

const COUNTRIES = [
  {
    code: "AO",
    name: "Angola",
    flag: "🇦🇴",
    currency: "Kz",
  },
  {
    code: "CD",
    name: "RDC",
    flag: "🇨🇩",
    currency: "FC",
  },
];

// =====================================================
// CATEGORIAS
// =====================================================

const CATEGORIES = [
  {
    id: "all",
    name: "Todos",
    icon: "grid-outline",
  },
  {
    id: "frutas",
    name: "Frutas",
    icon: "nutrition-outline",
  },
  {
    id: "citrus",
    name: "Cítricos",
    icon: "ellipse-outline",
  },
  {
    id: "legumes",
    name: "Legumes",
    icon: "leaf-outline",
  },
  {
    id: "verduras",
    name: "Verduras",
    icon: "leaf",
  },
  {
    id: "cereais",
    name: "Cereais",
    icon: "layers-outline",
  },
  {
    id: "temperos",
    name: "Temperos",
    icon: "flask-outline",
  },
  {
    id: "pescado",
    name: "Pescado",
    icon: "fish-outline",
  },
  {
    id: "carnes",
    name: "Carnes",
    icon: "restaurant-outline",
  },
  {
    id: "ovos",
    name: "Ovos",
    icon: "egg-outline",
  },
  {
    id: "paes",
    name: "Pães",
    icon: "cafe-outline",
  },
  {
    id: "lacteos",
    name: "Lácteos",
    icon: "water-outline",
  },
  {
    id: "bebidas",
    name: "Bebidas",
    icon: "wine-outline",
  },
];

// =====================================================
// PUBLICAÇÕES MOCKUP
//
// IMPORTANTE:
// Os mocks só aparecem quando NÃO existem produtos
// reais no Supabase.
//
// Cada publicação possui pelo menos 3 imagens.
// =====================================================

const MOCK_PRODUCTS: Product[] = [
  {
    id: "mock-tomate-001",
    product_type: "Tomate",
    description:
      "Tomate fresco selecionado, ideal para mercados, restaurantes e distribuidores.",
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
    description:
      "Mandioca fresca para fornecimento em quantidade. Disponível para compradores B2B.",
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
    description:
      "Milho amarelo produzido por agricultores locais, disponível para compradores e distribuidores.",
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
    description:
      "Banana fresca para comercialização. Produção disponível para supermercados e distribuidores.",
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

// =====================================================
// CATEGORIA PILL
// =====================================================

type CategoryPillProps = {
  category: (typeof CATEGORIES)[number];
  selected: boolean;
  onPress: () => void;
};

function CategoryPill({
  category,
  selected,
  onPress,
}: CategoryPillProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.categoryPill,
        selected && styles.categoryPillSelected,
      ]}
    >
      <Ionicons
        name={category.icon as any}
        size={14}
        color={selected ? "#FFFFFF" : COLORS.muted}
        style={{ marginRight: 6 }}
      />

      <Text
        style={[
          styles.categoryPillText,
          selected && styles.categoryPillTextSelected,
        ]}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

// =====================================================
// HOME SCREEN
// =====================================================

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ===================================================
  // ESTADOS
  // ===================================================

  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [hasRealProducts, setHasRealProducts] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState("all");

  const [selectedCountry, setSelectedCountry] =
    useState(COUNTRIES[0]);

  const [countryModalVisible, setCountryModalVisible] =
    useState(false);

  const [search, setSearch] = useState("");

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [unreadNotifications, setUnreadNotifications] =
    useState(0);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [preOrderVisible, setPreOrderVisible] =
    useState(false);

  const [quantity, setQuantity] = useState("1");

  const [deliveryLocation, setDeliveryLocation] =
    useState("");

  const [preOrderLoading, setPreOrderLoading] =
    useState(false);

  // ===================================================
  // LOGIN
  // ===================================================

  const requireLogin = useCallback(() => {
    Alert.alert(
      "Autenticação",
      "Entre na sua conta para continuar."
    );

    router.push("/login");
  }, [router]);

  // ===================================================
  // SESSION
  // ===================================================

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

  // ===================================================
  // NOTIFICAÇÕES
  // ===================================================

  const loadUnreadNotifications = useCallback(
    async (userId: string | null) => {
      if (!userId) {
        setUnreadNotifications(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", userId)
          .eq("read", false);

        if (error) throw error;

        setUnreadNotifications(count || 0);
      } catch (error) {
        console.log(
          "Erro ao carregar notificações:",
          error
        );
      }
    },
    []
  );

  // ===================================================
  // CARREGAR PRODUTOS
  // ===================================================

  const loadProducts = async () => {
    try {
      setLoading(true);

      const {
        data: sessionData,
      } = await supabase.auth.getSession();

      const userId =
        sessionData.session?.user?.id || null;

      setCurrentUserId(userId);

      await loadUnreadNotifications(userId);

      // ===============================================
      // PRODUTOS REAIS
      // ===============================================

      const {
        data,
        error,
      } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.log(
          "Erro ao carregar produtos:",
          error
        );

        /*
         * Se ocorrer erro de conexão,
         * não fingimos que os mocks são dados reais.
         */
        setHasRealProducts(false);
        setProducts(MOCK_PRODUCTS);

        return;
      }

      let loadedProducts: Product[] =
        (data || []).map((item: any) => ({
          ...item,

          photos: Array.isArray(item.photos)
            ? item.photos
            : [],

          likes_count: 0,

          is_liked: false,
        }));

      // ===============================================
      // IMPORTANTE
      //
      // Se houver pelo menos uma publicação real,
      // OS MOCKS DESAPARECEM COMPLETAMENTE.
      // ===============================================

      if (loadedProducts.length > 0) {
        setHasRealProducts(true);
      } else {
        setHasRealProducts(false);
        setProducts(MOCK_PRODUCTS);
        return;
      }

      // ===============================================
      // LIKES
      // ===============================================

      const productIds =
        loadedProducts.map(
          (product) => product.id
        );

      if (productIds.length > 0) {
        const {
          data: likes,
        } = await supabase
          .from("product_likes")
          .select(
            "product_id, user_id"
          )
          .in(
            "product_id",
            productIds
          );

        if (likes) {
          loadedProducts =
            loadedProducts.map(
              (product) => {
                const productLikes =
                  likes.filter(
                    (like: any) =>
                      like.product_id ===
                      product.id
                  );

                return {
                  ...product,

                  likes_count:
                    productLikes.length,

                  is_liked:
                    !!userId &&
                    productLikes.some(
                      (like: any) =>
                        like.user_id ===
                        userId
                    ),
                };
              }
            );
        }
      }

      // ===============================================
      // MOSTRA SOMENTE PUBLICAÇÕES REAIS
      // ===============================================

      setProducts(loadedProducts);
    } catch (error) {
      console.log(
        "Erro inesperado:",
        error
      );

      /*
       * Em caso de erro inesperado,
       * mostramos mocks para que o feed
       * continue visualmente utilizável.
       */
      setHasRealProducts(false);
      setProducts(MOCK_PRODUCTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ===================================================
  // FOCUS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      checkSession();
      loadProducts();
    }, [])
  );

  // ===================================================
  // REFRESH
  // ===================================================

  const onRefresh = async () => {
    setRefreshing(true);

    await loadProducts();
  };

  // ===================================================
  // UPDATE PRODUCT
  // ===================================================

  const handleProductUpdate = useCallback(
    (updated: Product) => {
      setProducts((current) =>
        current.map((product) =>
          product.id === updated.id
            ? updated
            : product
        )
      );
    },
    []
  );

  // ===================================================
  // FILTROS
  // ===================================================

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // -----------------------------------------------
    // PESQUISA
    // -----------------------------------------------

    if (search.trim()) {
      const searchText =
        search.toLowerCase().trim();

      result = result.filter(
        (product) => {
          const type =
            product.product_type
              ?.toLowerCase() || "";

          const description =
            product.description
              ?.toLowerCase() || "";

          const farmer =
            product.farmer_name
              ?.toLowerCase() || "";

          return (
            type.includes(searchText) ||
            description.includes(searchText) ||
            farmer.includes(searchText)
          );
        }
      );
    }

    // -----------------------------------------------
    // CATEGORIA
    // -----------------------------------------------

    if (
      selectedCategory !== "all"
    ) {
      result = result.filter(
        (product) => {
          const type =
            product.product_type
              ?.toLowerCase()
              .trim() || "";

          const category =
            selectedCategory
              .toLowerCase()
              .trim();

          /*
           * Permite:
           * "Tomate" -> legumes
           * "Laranja" -> citrus
           * etc.
           */

          const categoryMap: Record<
            string,
            string[]
          > = {
            frutas: [
              "banana",
              "maçã",
              "maca",
              "manga",
              "abacaxi",
              "mamão",
              "mamao",
              "goiaba",
              "melancia",
              "abacate",
            ],

            citrus: [
              "laranja",
              "limão",
              "limao",
              "tangerina",
              "toranja",
            ],

            legumes: [
              "tomate",
              "cenoura",
              "mandioca",
              "batata",
              "batata-doce",
              "cebola",
              "alho",
              "pepino",
            ],

            verduras: [
              "alface",
              "couve",
              "espinafre",
              "repolho",
              "rúcula",
              "rucula",
            ],

            cereais: [
              "milho",
              "arroz",
              "trigo",
              "feijão",
              "feijao",
              "soja",
            ],

            temperos: [
              "pimenta",
              "gengibre",
              "canela",
              "cravo",
            ],

            pescado: [
              "peixe",
              "tilápia",
              "tilapia",
              "sardinha",
              "cacusso",
            ],

            carnes: [
              "carne",
              "frango",
              "boi",
              "porco",
              "cabrito",
            ],

            ovos: [
              "ovo",
              "ovos",
            ],

            paes: [
              "pão",
              "pao",
            ],

            lacteos: [
              "leite",
              "queijo",
              "iogurte",
            ],

            bebidas: [
              "sumo",
              "suco",
              "água",
              "agua",
              "bebida",
            ],
          };

          const words =
            categoryMap[category];

          if (!words) {
            return type.includes(category);
          }

          return words.some(
            (word) =>
              type.includes(word)
          );
        }
      );
    }

    return result;
  }, [
    products,
    search,
    selectedCategory,
  ]);

  // ===================================================
  // PREÇO
  // ===================================================

  const formatPrice = (
    price?: number
  ) => {
    const value = Number(
      price || 0
    );

    return `${value.toLocaleString(
      "pt-AO"
    )} ${selectedCountry.currency}`;
  };

  // ===================================================
  // PRÉ-ENCOMENDA
  // ===================================================

  const openPreOrder = (
    product: Product
  ) => {
    /*
     * Não permite pré-encomenda de mock.
     */
    if (
      product.id.startsWith("mock-")
    ) {
      Alert.alert(
        "Demonstração",
        "Esta publicação é apenas uma demonstração. As pré-encomendas estarão disponíveis nas publicações reais."
      );

      return;
    }

    setSelectedProduct(product);

    setQuantity("1");

    setDeliveryLocation("");

    setPreOrderVisible(true);
  };

  // ===================================================
  // ENVIAR PRÉ-ENCOMENDA
  // ===================================================

  const submitPreOrder = async () => {
    if (!selectedProduct) return;

    if (
      selectedProduct.id.startsWith(
        "mock-"
      )
    ) {
      Alert.alert(
        "Demonstração",
        "Esta publicação é apenas uma demonstração."
      );

      return;
    }

    if (!currentUserId) {
      requireLogin();
      return;
    }

    const qty =
      Number(quantity);

    if (!qty || qty <= 0) {
      Alert.alert(
        "Quantidade inválida",
        "Introduza uma quantidade válida."
      );

      return;
    }

    if (
      !deliveryLocation.trim()
    ) {
      Alert.alert(
        "Localização",
        "Introduza o local de entrega."
      );

      return;
    }

    try {
      setPreOrderLoading(true);

      const {
        error,
      } = await supabase
        .from("pre_orders")
        .insert({
          product_id:
            selectedProduct.id,

          buyer_id:
            currentUserId,

          quantity: qty,

          delivery_location:
            deliveryLocation.trim(),

          status: "pending",
        });

      if (error) {
        console.log(
          "Erro pre-order:",
          error
        );

        Alert.alert(
          "Erro",
          "Não foi possível criar a pré-encomenda."
        );

        return;
      }

      try {
        if (
          selectedProduct.user_id
        ) {
          await supabase.rpc(
            "create_notification",
            {
              p_user_id:
                selectedProduct.user_id,

              p_type:
                "pre_order",

              p_title:
                "Nova pré-encomenda",

              p_message: `Recebeste uma nova pré-encomenda para ${selectedProduct.product_type}.`,

              p_reference_id:
                selectedProduct.id,
            }
          );
        }
      } catch (
        notificationError
      ) {
        console.log(
          "Erro notificação:",
          notificationError
        );
      }

      setPreOrderVisible(false);

      Alert.alert(
        "Pré-encomenda enviada",
        "A sua pré-encomenda foi enviada com sucesso."
      );
    } catch (error) {
      console.log(error);

      Alert.alert(
        "Erro",
        "Ocorreu um erro ao criar a pré-encomenda."
      );
    } finally {
      setPreOrderLoading(false);
    }
  };

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loadingContainer
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={
            COLORS.surface
          }
        />

        <View
          style={
            styles.loadingLogoWrapper
          }
        >
          <Image
            source={Logo}
            style={
              styles.loadingLogo
            }
            resizeMode="contain"
          />

          <View
            style={
              styles.loadingSpinner
            }
          >
            <ActivityIndicator
              size="large"
              color={
                COLORS.primary
              }
            />
          </View>
        </View>

        <Text
          style={
            styles.loadingText
          }
        >
          A carregar publicações...
        </Text>
      </SafeAreaView>
    );
  }

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          COLORS.canvas
        }
      />

      <View
        style={styles.screen}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={[
            styles.header,
            {
              paddingTop:
                insets.top + 14,

              height:
                78 + insets.top,
            },
          ]}
        >
          <View
            style={
              styles.headerLeft
            }
          >
            <Image
              source={Logo}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View
            style={
              styles.headerRight
            }
          >
            <TouchableOpacity
              style={
                styles.countrySelector
              }
              onPress={() =>
                setCountryModalVisible(
                  true
                )
              }
              activeOpacity={0.8}
            >
              <Text
                style={
                  styles.countryFlag
                }
              >
                {
                  selectedCountry.flag
                }
              </Text>

              <View>
                <Text
                  style={
                    styles.countryLabel
                  }
                >
                  País
                </Text>

                <Text
                  style={
                    styles.countryName
                  }
                >
                  {
                    selectedCountry.name
                  }
                </Text>
              </View>

              <Ionicons
                name="chevron-down"
                size={16}
                color={
                  COLORS.text
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.notificationButton
              }
              activeOpacity={0.8}
              onPress={() =>
                router.push(
                  "/notifications"
                )
              }
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={
                  COLORS.text
                }
              />

              {unreadNotifications >
                0 && (
                <View
                  style={
                    styles.notificationDot
                  }
                >
                  {unreadNotifications <=
                    9 && (
                    <Text
                      style={
                        styles.notificationDotText
                      }
                    >
                      {
                        unreadNotifications
                      }
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* =================================================
            FEED
        ================================================= */}

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) =>
            String(item.id)
          }
          renderItem={({
            item,
          }) => (
            <ProductCard
              product={item}
              currentUserId={
                currentUserId
              }
              onProductUpdate={
                handleProductUpdate
              }
              onOpenPreOrder={
                openPreOrder
              }
              onRequireLogin={
                requireLogin
              }
            />
          )}
          contentContainerStyle={[
            styles.productsContent,
            {
              paddingBottom:
                120 +
                insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                onRefresh
              }
              tintColor={
                COLORS.primary
              }
            />
          }
          ListHeaderComponent={
            <View>
              {/* =================================================
                  SEARCH
              ================================================= */}

              <TouchableOpacity
                style={
                  styles.searchBox
                }
                activeOpacity={0.7}
                onPress={() =>
                  router.push(
                    "/search"
                  )
                }
              >
                <Ionicons
                  name="search"
                  size={17}
                  color={
                    COLORS.muted
                  }
                />

                <Text
                  style={
                    styles.searchPlaceholder
                  }
                >
                  Pesquisar produtos
                </Text>
              </TouchableOpacity>

              {/* =================================================
                  CATEGORIAS
              ================================================= */}

              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Categorias
                </Text>

                <Text
                  style={
                    styles.sectionCount
                  }
                >
                  {
                    CATEGORIES.length -
                    1
                  }{" "}
                  opções
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.categoriesContent
                }
              >
                {CATEGORIES.map(
                  (
                    category
                  ) => (
                    <CategoryPill
                      key={
                        category.id
                      }
                      category={
                        category
                      }
                      selected={
                        selectedCategory ===
                        category.id
                      }
                      onPress={() =>
                        setSelectedCategory(
                          category.id
                        )
                      }
                    />
                  )
                )}
              </ScrollView>

              {/* =================================================
                  PRODUTOS
              ================================================= */}

              <View
                style={[
                  styles.sectionHeader,
                  {
                    marginTop: 24,
                  },
                ]}
              >
                <View>
                  <View
                    style={{
                      flexDirection:
                        "row",
                      alignItems:
                        "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      {hasRealProducts
                        ? "Publicações"
                        : "Publicações"}
                    </Text>

                    {!hasRealProducts && (
                      <View
                        style={
                          styles.demoBadge
                        }
                      >
                        <Text
                          style={
                            styles.demoBadgeText
                          }
                        >
                          DEMO
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={
                      styles.productsSubtitle
                    }
                  >
                    {hasRealProducts
                      ? "Publicações dos agricultores"
                      : "Exemplos de produtos disponíveis"}
                  </Text>
                </View>

                <View
                  style={
                    styles.productsCountBadge
                  }
                >
                  <Text
                    style={
                      styles.productsCountText
                    }
                  >
                    {
                      filteredProducts.length
                    }
                  </Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View
              style={
                styles.emptyContainer
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <MaterialCommunityIcons
                  name="sprout-outline"
                  size={44}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Nenhum produto encontrado
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                Não encontramos produtos
                para os filtros
                selecionados.
              </Text>

              <TouchableOpacity
                style={
                  styles.clearFiltersButton
                }
                onPress={() => {
                  setSelectedCategory(
                    "all"
                  );

                  setSearch("");
                }}
              >
                <Text
                  style={
                    styles.clearFiltersText
                  }
                >
                  Limpar filtros
                </Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            filteredProducts.length >
            0 ? (
              <View
                style={
                  styles.productsFooter
                }
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={
                    COLORS.primary
                  }
                />

                <Text
                  style={
                    styles.productsFooterText
                  }
                >
                  {hasRealProducts
                    ? "Mostrando publicações reais"
                    : "Publicações de demonstração"}
                </Text>
              </View>
            ) : null
          }
        />

        {/* =================================================
            BOTTOM TOOLBAR
        ================================================= */}

        <BottomToolbar />
      </View>

      {/* =====================================================
          MODAL PAÍSES
      ===================================================== */}

      <Modal
        visible={
          countryModalVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCountryModalVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.modalOverlay
          }
          onPress={() =>
            setCountryModalVisible(
              false
            )
          }
        >
          <Pressable
            style={
              styles.countryModal
            }
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <View
              style={
                styles.modalHandle
              }
            />

            <Text
              style={
                styles.modalTitle
              }
            >
              Escolha o país
            </Text>

            <Text
              style={
                styles.modalSubtitle
              }
            >
              Selecione onde pretende
              comprar ou vender.
            </Text>

            {COUNTRIES.map(
              (country) => {
                const selected =
                  country.code ===
                  selectedCountry.code;

                return (
                  <TouchableOpacity
                    key={
                      country.code
                    }
                    style={[
                      styles.countryOption,
                      selected &&
                        styles.countryOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedCountry(
                        country
                      );

                      setCountryModalVisible(
                        false
                      );
                    }}
                    activeOpacity={
                      0.8
                    }
                  >
                    <View
                      style={
                        styles.countryOptionFlag
                      }
                    >
                      <Text
                        style={
                          styles.countryFlagLarge
                        }
                      >
                        {
                          country.flag
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.countryOptionInfo
                      }
                    >
                      <Text
                        style={
                          styles.countryOptionName
                        }
                      >
                        {
                          country.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.countryOptionCurrency
                        }
                      >
                        Moeda:{" "}
                        {
                          country.currency
                        }
                      </Text>
                    </View>

                    {selected && (
                      <View
                        style={
                          styles.selectedCountryCheck
                        }
                      >
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* =====================================================
          MODAL PRÉ-ENCOMENDA
      ===================================================== */}

      <Modal
        visible={
          preOrderVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPreOrderVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.modalOverlay
          }
          onPress={() =>
            setPreOrderVisible(
              false
            )
          }
        >
          <Pressable
            style={
              styles.preOrderModal
            }
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <View
              style={
                styles.modalHandle
              }
            />

            <View
              style={
                styles.preOrderHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.preOrderTitle
                  }
                >
                  Pré-encomenda
                </Text>

                <Text
                  style={
                    styles.preOrderSubtitle
                  }
                  numberOfLines={
                    1
                  }
                >
                  {
                    selectedProduct?.product_type
                  }
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.closeButton
                }
                onPress={() =>
                  setPreOrderVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={
                    COLORS.text
                  }
                />
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.formLabel
              }
            >
              Quantidade
            </Text>

            <View
              style={
                styles.quantityContainer
              }
            >
              <TouchableOpacity
                style={
                  styles.quantityButton
                }
                onPress={() => {
                  const current =
                    Number(
                      quantity
                    ) || 1;

                  if (
                    current >
                    1
                  ) {
                    setQuantity(
                      String(
                        current -
                          1
                      )
                    );
                  }
                }}
              >
                <Ionicons
                  name="remove"
                  size={19}
                  color={
                    COLORS.primary
                  }
                />
              </TouchableOpacity>

              <TextInput
                style={
                  styles.quantityInput
                }
                value={
                  quantity
                }
                onChangeText={
                  setQuantity
                }
                keyboardType="numeric"
                textAlign="center"
              />

              <TouchableOpacity
                style={
                  styles.quantityButton
                }
                onPress={() => {
                  const current =
                    Number(
                      quantity
                    ) || 0;

                  setQuantity(
                    String(
                      current +
                        1
                    )
                  );
                }}
              >
                <Ionicons
                  name="add"
                  size={19}
                  color={
                    COLORS.primary
                  }
                />
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.formLabel
              }
            >
              Local de entrega
            </Text>

            <View
              style={
                styles.deliveryInput
              }
            >
              <Ionicons
                name="location-outline"
                size={19}
                color={
                  COLORS.muted
                }
              />

              <TextInput
                style={
                  styles.deliveryTextInput
                }
                placeholder="Ex.: Luanda, Talatona"
                placeholderTextColor={
                  COLORS.muted
                }
                value={
                  deliveryLocation
                }
                onChangeText={
                  setDeliveryLocation
                }
              />
            </View>

            <View
              style={
                styles.orderSummary
              }
            >
              <View>
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Preço unitário
                </Text>

                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {formatPrice(
                    selectedProduct?.price
                  )}
                </Text>
              </View>

              <View>
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Quantidade
                </Text>

                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {quantity}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitOrderButton,
                preOrderLoading &&
                  styles.disabledButton,
              ]}
              onPress={
                submitPreOrder
              }
              disabled={
                preOrderLoading
              }
            >
              {preOrderLoading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="cart-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.submitOrderText
                    }
                  >
                    Enviar pré-encomenda
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      COLORS.canvas,
  },

  screen: {
    flex: 1,
    backgroundColor:
      COLORS.canvas,
  },

  // ===================================================
  // HEADER
  // ===================================================

  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    backgroundColor:
      COLORS.surface,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...SHADOW.header,
  },

  headerLeft: {
    flex: 1,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  logo: {
    width: 138,
    height: 48,
  },

  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius:
      RADIUS.md,
    backgroundColor:
      COLORS.primarySoft,
  },

  countryFlag: {
    fontSize: 20,
  },

  countryLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "600",
  },

  countryName: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },

  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor:
      COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor:
      COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor:
      COLORS.surface,
  },

  notificationDotText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ===================================================
  // SEARCH
  // ===================================================

  searchBox: {
    height: 46,
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 22,
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor:
      COLORS.searchFill,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  searchPlaceholder: {
    fontSize: 15,
    color: COLORS.muted,
    fontWeight: "400",
  },

  // ===================================================
  // SECTION
  // ===================================================

  sectionHeader: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  sectionCount: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "600",
  },

  productsSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },

  demoBadge: {
    backgroundColor:
      COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor:
      "#F1D1A5",
  },

  demoBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color:
      COLORS.accentDark,
    letterSpacing: 0.5,
  },

  // ===================================================
  // PRODUCTS
  // ===================================================

  productsCountBadge: {
    minWidth: 30,
    height: 26,
    borderRadius: 13,
    backgroundColor:
      COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },

  productsCountText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },

  productsContent: {
    paddingTop: 4,
    paddingHorizontal: 0,
  },

  // ===================================================
  // CATEGORIES
  // ===================================================

  categoriesContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    gap: 8,
  },

  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    backgroundColor:
      COLORS.surface,
  },

  categoryPillSelected: {
    backgroundColor:
      COLORS.primary,
    borderColor:
      COLORS.primary,
  },

  categoryPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.text,
  },

  categoryPillTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // ===================================================
  // EMPTY
  // ===================================================

  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 45,
    paddingBottom: 40,
  },

  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 28,
    backgroundColor:
      COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 15,
    textAlign: "center",
  },

  emptyDescription: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 7,
  },

  clearFiltersButton: {
    marginTop: 17,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius:
      RADIUS.md,
    backgroundColor:
      COLORS.primaryLight,
  },

  clearFiltersText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  // ===================================================
  // FOOTER
  // ===================================================

  productsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 25,
  },

  productsFooterText: {
    fontSize: 11,
    color: COLORS.muted,
  },

  // ===================================================
  // LOADING
  // ===================================================

  loadingContainer: {
    flex: 1,
    backgroundColor:
      COLORS.surface,
    alignItems: "center",
    justifyContent:
      "center",
  },

  loadingLogoWrapper: {
    width: 230,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogo: {
    width: 200,
    height: 88,
  },

  loadingSpinner: {
    position: "absolute",
    bottom: 0,
  },

  loadingText: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 20,
  },

  // ===================================================
  // MODALS
  // ===================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(15,20,17,0.5)",
    justifyContent:
      "flex-end",
  },

  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor:
      COLORS.border,
    alignSelf: "center",
    marginBottom: 20,
  },

  // ===================================================
  // COUNTRY MODAL
  // ===================================================

  countryModal: {
    backgroundColor:
      COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 30,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.text,
  },

  modalSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 5,
    marginBottom: 20,
  },

  countryOption: {
    minHeight: 70,
    borderRadius:
      RADIUS.lg,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  countryOptionSelected: {
    backgroundColor:
      COLORS.primarySoft,
    borderColor:
      COLORS.selectedBorder,
  },

  countryOptionFlag: {
    width: 46,
    height: 46,
    borderRadius:
      RADIUS.md,
    backgroundColor:
      COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },

  countryFlagLarge: {
    fontSize: 26,
  },

  countryOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },

  countryOptionName: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },

  countryOptionCurrency: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
  },

  selectedCountryCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor:
      COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // ===================================================
  // PRE ORDER
  // ===================================================

  preOrderModal: {
    backgroundColor:
      COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 30,
  },

  preOrderHeader: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  preOrderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },

  preOrderSubtitle: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
    marginTop: 3,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius:
      RADIUS.sm,
    backgroundColor:
      COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },

  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },

  quantityContainer: {
    height: 50,
    borderRadius:
      RADIUS.md,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    overflow: "hidden",
  },

  quantityButton: {
    width: 50,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      COLORS.primarySoft,
  },

  quantityInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },

  deliveryInput: {
    height: 50,
    borderRadius:
      RADIUS.md,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    marginBottom: 18,
  },

  deliveryTextInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 9,
  },

  orderSummary: {
    backgroundColor:
      COLORS.primarySoft,
    borderRadius:
      RADIUS.lg,
    padding: 14,
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginBottom: 18,
  },

  summaryLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "600",
  },

  summaryValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },

  submitOrderButton: {
    height: 54,
    borderRadius:
      RADIUS.md,
    backgroundColor:
      COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    gap: 9,
  },

  submitOrderText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },
});