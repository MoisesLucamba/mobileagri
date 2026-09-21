import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CARD_WIDTH = SCREEN_WIDTH - 36;
const IMAGE_HEIGHT = CARD_WIDTH * 0.75;

/* =========================================================
   CORES
========================================================= */

const COLORS = {
  primary: "#1F6B3A",
  primarySoft: "#EAF3EA",
  primaryLight: "#D9EEDD",
  accent: "#E2932F",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",
  red: "#DD5138",
};

const RADIUS = {
  sm: 10,
  md: 14,
  lg: 19,
  xl: 22,
};

/* =========================================================
   MOCKUPS
   Só aparecem quando não existem publicações reais.
========================================================= */

export const MOCK_PRODUCTS = [
  {
    id: "mock-1",

    product_type: "Tomate",

    description:
      "Tomate fresco produzido localmente. Disponível para fornecimento em quantidade para empresas, restaurantes e distribuidores.",

    quantity: 850,

    harvest_date: "2026-10-05",

    price: 850,

    province_id: "Luanda",

    municipality_id: "Viana",

    farmer_name: "Fazenda Esperança",

    contact: "900000000",

    photos: [
      "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=1200",
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
      "https://images.unsplash.com/photo-1561136594-7f68413baa99?w=1200",
    ],

    status: "active",

    created_at: new Date().toISOString(),

    user_id: "mock-user-1",

    location_lat: -8.9167,

    location_lng: 13.4833,

    likes_count: 24,

    is_liked: false,

    comments: [],

    commentsLoaded: true,

    user_verified: true,
  },

  {
    id: "mock-2",

    product_type: "Cebola",

    description:
      "Cebola de produção nacional, selecionada para fornecimento em grandes quantidades para compradores B2B.",

    quantity: 1200,

    harvest_date: "2026-10-18",

    price: 700,

    province_id: "Huambo",

    municipality_id: "Huambo",

    farmer_name: "Cooperativa Agrícola do Huambo",

    contact: "900000001",

    photos: [
      "https://images.unsplash.com/photo-1508747703725-719777637510?w=1200",
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=1200",
      "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb0?w=1200",
    ],

    status: "active",

    created_at: new Date(
      Date.now() - 86400000
    ).toISOString(),

    user_id: "mock-user-2",

    location_lat: -12.7761,

    location_lng: 15.7392,

    likes_count: 18,

    is_liked: false,

    comments: [],

    commentsLoaded: true,

    user_verified: true,
  },

  {
    id: "mock-3",

    product_type: "Milho",

    description:
      "Milho nacional disponível para compradores B2B. Ideal para transformação, distribuição e comercialização.",

    quantity: 3500,

    harvest_date: "2026-11-02",

    price: 420,

    province_id: "Kwanza Norte",

    municipality_id: "Cazengo",

    farmer_name: "Agro Kwanza",

    contact: "900000002",

    photos: [
      "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=1200",
      "https://images.unsplash.com/photo-1601593768794-9c9c7b8e2f6d?w=1200",
      "https://images.unsplash.com/photo-1606914469633-bd3921f7c5c4?w=1200",
    ],

    status: "active",

    created_at: new Date(
      Date.now() - 2 * 86400000
    ).toISOString(),

    user_id: "mock-user-3",

    location_lat: -9.4167,

    location_lng: 14.9167,

    likes_count: 31,

    is_liked: false,

    comments: [],

    commentsLoaded: true,

    user_verified: false,
  },
];

/* =========================================================
   FUNÇÕES
========================================================= */

const formatDate = (date) => {
  if (!date) return "";

  try {
    return new Date(date).toLocaleDateString("pt-AO", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
};

const formatPrice = (price) => {
  return `${(price || 0).toLocaleString("pt-AO")} Kz`;
};

/* =========================================================
   CARROSSEL DE FOTOS
========================================================= */

const PhotoCarousel = ({ photos }) => {
  const [index, setIndex] = useState(0);

  const listRef = useRef(null);

  const validPhotos = Array.isArray(photos)
    ? photos.filter(
        (photo) =>
          typeof photo === "string" &&
          photo.trim().length > 0
      )
    : [];

  const onMomentumEnd = (
    event
  ) => {
    const newIndex = Math.round(
      event.nativeEvent.contentOffset.x /
        CARD_WIDTH
    );

    setIndex(newIndex);
  };

  if (validPhotos.length === 0) {
    return (
      <View
        style={[
          styles.imageWrap,
          styles.noPhoto,
        ]}
      >
        <MaterialCommunityIcons
          name="sprout-outline"
          size={40}
          color={COLORS.primary}
        />

        <Text style={styles.noPhotoText}>
          Sem imagem
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.imageWrap}>
      <FlatList
        ref={listRef}
        data={validPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, i) =>
          `${uri}-${i}`
        }
        onMomentumScrollEnd={
          onMomentumEnd
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
      />

      {/* Contador de fotos */}

      {validPhotos.length > 1 && (
        <View style={styles.photoCounter}>
          <Ionicons
            name="images-outline"
            size={12}
            color="#FFFFFF"
          />

          <Text
            style={styles.photoCounterText}
          >
            {index + 1}/{validPhotos.length}
          </Text>
        </View>
      )}

      {/* Pontos */}

      {validPhotos.length > 1 && (
        <View style={styles.dotsRow}>
          {validPhotos.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index &&
                  styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/* =========================================================
   PRODUCT CARD
========================================================= */

export const ProductCard = memo(
  ({
    product,
    currentUserId,
    onProductUpdate,
    onOpenPreOrder,
    onRequireLogin,
  }) => {
    const [
      commentVisible,
      setCommentVisible,
    ] = useState(false);

    const [
      commentsLoading,
      setCommentsLoading,
    ] = useState(false);

    const [
      comment,
      setComment,
    ] = useState("");

    const [
      replyingTo,
      setReplyingTo,
    ] = useState(null);

    const [
      replyText,
      setReplyText,
    ] = useState("");

    const [
      likeBusy,
      setLikeBusy,
    ] = useState(false);

    /* =====================================================
       DESCONTO
    ===================================================== */

    const discount =
      product.quantity > 100
        ? 15
        : product.quantity > 50
        ? 10
        : 0;

    const originalPrice =
      discount > 0
        ? product.price /
          (1 - discount / 100)
        : product.price;

    /* =====================================================
       NOVO
    ===================================================== */

    const isNew =
      (Date.now() -
        new Date(
          product.created_at
        ).getTime()) /
        86400000 <
      7;

    /* =====================================================
       LIKE
    ===================================================== */

    const toggleLike = async () => {
      if (!currentUserId) {
        return onRequireLogin();
      }

      if (likeBusy) return;

      /*
       * Mockup
       * Não tenta gravar likes no Supabase.
       */

      if (product.id.startsWith("mock-")) {
        const updated = {
          ...product,

          is_liked: !product.is_liked,

          likes_count: product.is_liked
            ? Math.max(
                0,
                (product.likes_count ||
                  1) - 1
              )
            : (product.likes_count ||
                0) + 1,
        };

        onProductUpdate(updated);

        return;
      }

      setLikeBusy(true);

      const optimistic = {
        ...product,

        is_liked: !product.is_liked,

        likes_count: product.is_liked
          ? Math.max(
              0,
              (product.likes_count ||
                1) - 1
            )
          : (product.likes_count ||
              0) + 1,
      };

      onProductUpdate(optimistic);

      try {
        if (product.is_liked) {
          const { error } =
            await supabase
              .from("product_likes")
              .delete()
              .eq(
                "product_id",
                product.id
              )
              .eq(
                "user_id",
                currentUserId
              );

          if (error) throw error;
        } else {
          const { error } =
            await supabase
              .from("product_likes")
              .insert({
                product_id:
                  product.id,
                user_id:
                  currentUserId,
              });

          if (error) throw error;
        }
      } catch (error) {
        console.log(
          "Erro ao curtir:",
          error
        );

        onProductUpdate(product);
      } finally {
        setLikeBusy(false);
      }
    };

    /* =====================================================
       CARREGAR COMENTÁRIOS
    ===================================================== */

    const loadComments = useCallback(
      async () => {
        if (product.commentsLoaded)
          return;

        /*
         * Mockups não precisam
         * consultar comentários.
         */

        if (
          product.id.startsWith("mock-")
        ) {
          onProductUpdate({
            ...product,
            comments: [],
            commentsLoaded: true,
          });

          return;
        }

        setCommentsLoading(true);

        try {
          const {
            data,
            error,
          } = await supabase
            .from(
              "product_comments"
            )
            .select(
              "*, users:user_id (full_name, user_type, avatar_url)"
            )
            .eq(
              "product_id",
              product.id
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

          if (error) throw error;

          const comments =
            (data || []).map(
              (c) => ({
                id: c.id,

                user_id:
                  c.user_id,

                comment_text:
                  c.comment_text,

                created_at:
                  c.created_at,

                user_name:
                  c.users
                    ?.full_name ||
                  "Usuário",

                user_type:
                  c.users
                    ?.user_type ||
                  "agricultor",

                user_avatar:
                  c.users
                    ?.avatar_url,

                likes_count: 0,

                is_liked: false,

                replies: [],
              })
            );

          onProductUpdate({
            ...product,
            comments,
            commentsLoaded: true,
          });
        } catch (error) {
          console.log(
            "Erro ao carregar comentários:",
            error
          );
        } finally {
          setCommentsLoading(false);
        }
      },
      [
        product,
        onProductUpdate,
      ]
    );

    /* =====================================================
       ABRIR COMENTÁRIOS
    ===================================================== */

    const toggleComments = () => {
      const next =
        !commentVisible;

      setCommentVisible(next);

      if (next) {
        loadComments();
      }
    };

    /* =====================================================
       ADICIONAR COMENTÁRIO
    ===================================================== */

    const addComment = async () => {
      if (!comment.trim())
        return;

      if (!currentUserId) {
        return onRequireLogin();
      }

      /*
       * Não grava comentários
       * nos mockups.
       */

      if (
        product.id.startsWith("mock-")
      ) {
        const newComment = {
          id: `mock-comment-${Date.now()}`,

          user_id:
            currentUserId,

          comment_text:
            comment.trim(),

          created_at:
            new Date().toISOString(),

          user_name: "Você",

          user_type: "comprador",

          likes_count: 0,

          is_liked: false,

          replies: [],
        };

        onProductUpdate({
          ...product,

          comments: [
            newComment,
            ...(product.comments ||
              []),
          ],

          commentsLoaded: true,
        });

        setComment("");

        return;
      }

      try {
        const {
          data: newComment,
          error,
        } = await supabase
          .from(
            "product_comments"
          )
          .insert({
            product_id:
              product.id,

            user_id:
              currentUserId,

            comment_text:
              comment.trim(),
          })
          .select()
          .single();

        if (error) throw error;

        const {
          data: userData,
        } = await supabase
          .from("users")
          .select(
            "full_name, user_type, avatar_url"
          )
          .eq(
            "id",
            currentUserId
          )
          .single();

        const withUser = {
          ...newComment,

          user_name:
            userData
              ?.full_name ||
            "Usuário",

          user_type:
            userData
              ?.user_type ||
            "agricultor",

          user_avatar:
            userData
              ?.avatar_url,

          likes_count: 0,

          is_liked: false,

          replies: [],
        };

        onProductUpdate({
          ...product,

          comments: [
            withUser,
            ...(product.comments ||
              []),
          ],

          commentsLoaded: true,
        });

        setComment("");
      } catch (error) {
        console.log(
          "Erro ao comentar:",
          error
        );
      }
    };

    /* =====================================================
       LIKE COMENTÁRIO
    ===================================================== */

    const toggleCommentLike = async (
      commentId,
      isLiked
    ) => {
      if (!currentUserId) {
        return onRequireLogin();
      }

      /*
       * Mockup
       */

      if (
        product.id.startsWith("mock-")
      ) {
        const updated =
          product.comments?.map(
            (c) =>
              c.id === commentId
                ? {
                    ...c,

                    is_liked:
                      !isLiked,

                    likes_count:
                      isLiked
                        ? Math.max(
                            0,
                            (c.likes_count ||
                              1) -
                              1
                          )
                        : (c.likes_count ||
                            0) +
                          1,
                  }
                : c
          );

        onProductUpdate({
          ...product,
          comments: updated,
        });

        return;
      }

      try {
        if (isLiked) {
          const { error } =
            await supabase
              .from(
                "comment_likes"
              )
              .delete()
              .eq(
                "comment_id",
                commentId
              )
              .eq(
                "user_id",
                currentUserId
              );

          if (error) throw error;
        } else {
          const { error } =
            await supabase
              .from(
                "comment_likes"
              )
              .insert({
                comment_id:
                  commentId,

                user_id:
                  currentUserId,
              });

          if (error) throw error;
        }

        const updated =
          product.comments?.map(
            (c) =>
              c.id === commentId
                ? {
                    ...c,

                    is_liked:
                      !isLiked,

                    likes_count:
                      isLiked
                        ? Math.max(
                            0,
                            (c.likes_count ||
                              1) -
                              1
                          )
                        : (c.likes_count ||
                            0) +
                          1,
                  }
                : c
          );

        onProductUpdate({
          ...product,
          comments: updated,
        });
      } catch (error) {
        console.log(
          "Erro ao reagir ao comentário:",
          error
        );
      }
    };

    /* =====================================================
       RESPONDER
    ===================================================== */

    const addReply = async (
      commentId
    ) => {
      if (!replyText.trim())
        return;

      if (!currentUserId) {
        return onRequireLogin();
      }

      /*
       * Mockup
       */

      if (
        product.id.startsWith("mock-")
      ) {
        const newReply = {
          id: `mock-reply-${Date.now()}`,

          user_id:
            currentUserId,

          reply_text:
            replyText.trim(),

          created_at:
            new Date().toISOString(),

          user_name: "Você",

          user_type: "comprador",
        };

        const updated =
          product.comments?.map(
            (c) =>
              c.id === commentId
                ? {
                    ...c,

                    replies: [
                      ...(c.replies ||
                        []),
                      newReply,
                    ],
                  }
                : c
          );

        onProductUpdate({
          ...product,
          comments: updated,
        });

        setReplyText("");

        setReplyingTo(null);

        return;
      }

      try {
        const {
          data: newReply,
          error,
        } = await supabase
          .from(
            "comment_replies"
          )
          .insert({
            comment_id:
              commentId,

            user_id:
              currentUserId,

            reply_text:
              replyText.trim(),
          })
          .select()
          .single();

        if (error) throw error;

        const {
          data: userData,
        } = await supabase
          .from("users")
          .select(
            "full_name, user_type"
          )
          .eq(
            "id",
            currentUserId
          )
          .single();

        const withUser = {
          ...newReply,

          user_name:
            userData
              ?.full_name ||
            "Usuário",

          user_type:
            userData
              ?.user_type ||
            "agricultor",
        };

        const updated =
          product.comments?.map(
            (c) =>
              c.id === commentId
                ? {
                    ...c,

                    replies: [
                      ...(c.replies ||
                        []),
                      withUser,
                    ],
                  }
                : c
          );

        onProductUpdate({
          ...product,
          comments: updated,
        });

        setReplyText("");

        setReplyingTo(null);
      } catch (error) {
        console.log(
          "Erro ao responder:",
          error
        );
      }
    };

    /* =====================================================
       PARTILHAR
    ===================================================== */

    const handleShare =
      async () => {
        try {
          await Share.share({
            title:
              product.product_type,

            message: `Confira ${product.product_type} por ${formatPrice(
              product.price
            )} no AgriLink!`,
          });
        } catch {
          // Cancelado
        }
      };

    /* =====================================================
       LOCALIZAÇÃO
    ===================================================== */

    const openLocation = () => {
      if (
        !product.location_lat ||
        !product.location_lng
      ) {
        return;
      }

      const url =
        `https://www.google.com/maps/search/?api=1&query=` +
        `${product.location_lat},${product.location_lng}`;

      Linking.openURL(url).catch(
        () => {}
      );
    };

    /* =====================================================
       RENDER
    ===================================================== */

    return (
      <View style={styles.card}>
        {/* BADGES */}

        <View
          style={styles.imageBadgeRow}
        >
          {isNew && (
            <View
              style={styles.badgeNew}
            >
              <Ionicons
                name="leaf"
                size={10}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.badgeNewText
                }
              >
                NOVO
              </Text>
            </View>
          )}

          {discount > 0 && (
            <View
              style={
                styles.badgeDiscount
              }
            >
              <Text
                style={
                  styles.badgeDiscountText
                }
              >
                -{discount}%
              </Text>
            </View>
          )}

          {/* MOCKUP */}

          {product.id.startsWith(
            "mock-"
          ) && (
            <View
              style={styles.demoBadge}
            >
              <Ionicons
                name="sparkles-outline"
                size={10}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.demoBadgeText
                }
              >
                EXEMPLO
              </Text>
            </View>
          )}
        </View>

        {/* PARTILHAR */}

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          hitSlop={8}
        >
          <Ionicons
            name="share-social-outline"
            size={16}
            color={COLORS.text}
          />
        </TouchableOpacity>

        {/* FOTOS */}

        <PhotoCarousel
          photos={product.photos}
        />

        <View style={styles.content}>
          {/* AGRICULTOR */}

          <View
            style={styles.farmerRow}
          >
            <View
              style={styles.avatar}
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {product.farmer_name
                  ?.charAt(0)
                  ?.toUpperCase() ||
                  "?"}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <View
                style={
                  styles.farmerNameRow
                }
              >
                <Text
                  style={
                    styles.farmerName
                  }
                  numberOfLines={1}
                >
                  {product.farmer_name}
                </Text>

                {product.user_verified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={
                      COLORS.primary
                    }
                  />
                )}
              </View>

              <View
                style={
                  styles.locationRow
                }
              >
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={COLORS.faint}
                />

                <Text
                  style={
                    styles.locationText
                  }
                  numberOfLines={1}
                >
                  {product.province_id},{" "}
                  {
                    product.municipality_id
                  }
                </Text>
              </View>
            </View>

            <View
              style={
                styles.typeBadge
              }
            >
              <Text
                style={
                  styles.typeBadgeText
                }
                numberOfLines={1}
              >
                {product.product_type}
              </Text>
            </View>
          </View>

          {/* PRODUTO */}

          <Text
            style={styles.title}
          >
            {product.product_type}
          </Text>

          {/* PREÇO */}

          <View
            style={styles.priceRow}
          >
            <Text
              style={styles.price}
            >
              {formatPrice(
                product.price
              )}
            </Text>

            {discount > 0 && (
              <Text
                style={styles.priceOld}
              >
                {formatPrice(
                  originalPrice
                )}
              </Text>
            )}
          </View>

          {/* STOCK */}

          <View
            style={styles.stockRow}
          >
            <Ionicons
              name="trending-up-outline"
              size={13}
              color={COLORS.primary}
            />

            <Text
              style={
                styles.stockText
              }
            >
              {product.quantity.toLocaleString()}{" "}
              kg em estoque
            </Text>
          </View>

          {/* COMPRAR */}

          <TouchableOpacity
            style={styles.buyBtn}
            onPress={() =>
              onOpenPreOrder(
                product
              )
            }
          >
            <Ionicons
              name="cart-outline"
              size={18}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.buyBtnText
              }
            >
              Comprar agora
            </Text>
          </TouchableOpacity>

          {/* DESCRIÇÃO */}

          {!!product.description && (
            <Text
              style={
                styles.description
              }
              numberOfLines={3}
            >
              {product.description}
            </Text>
          )}

          {/* METADADOS */}

          <View
            style={styles.metaRow}
          >
            <View
              style={styles.metaItem}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={COLORS.faint}
              />

              <Text
                style={
                  styles.metaText
                }
              >
                Colheita:{" "}
                {formatDate(
                  product.harvest_date
                )}
              </Text>
            </View>

            {!!product.location_lat &&
              !!product.location_lng && (
                <TouchableOpacity
                  style={
                    styles.metaItem
                  }
                  onPress={
                    openLocation
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={[
                      styles.metaText,
                      {
                        color:
                          COLORS.primary,
                        fontWeight:
                          "600",
                      },
                    ]}
                  >
                    Ver localização
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {/* AÇÕES */}

          <View
            style={styles.actionsRow}
          >
            <View
              style={{
                flexDirection:
                  "row",
                gap: 6,
              }}
            >
              {/* LIKE */}

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  product.is_liked &&
                    styles.actionBtnLiked,
                ]}
                onPress={
                  toggleLike
                }
              >
                <Ionicons
                  name={
                    product.is_liked
                      ? "heart"
                      : "heart-outline"
                  }
                  size={17}
                  color={
                    product.is_liked
                      ? COLORS.red
                      : COLORS.muted
                  }
                />

                {!!product.likes_count && (
                  <Text
                    style={[
                      styles.actionBtnText,
                      {
                        color:
                          product.is_liked
                            ? COLORS.red
                            : COLORS.muted,
                      },
                    ]}
                  >
                    {
                      product.likes_count
                    }
                  </Text>
                )}
              </TouchableOpacity>

              {/* COMENTÁRIOS */}

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  commentVisible &&
                    styles.actionBtnActive,
                ]}
                onPress={
                  toggleComments
                }
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={
                    commentVisible
                      ? COLORS.primary
                      : COLORS.muted
                  }
                />

                {!!product.comments
                  ?.length && (
                  <Text
                    style={[
                      styles.actionBtnText,
                      {
                        color:
                          commentVisible
                            ? COLORS.primary
                            : COLORS.muted,
                      },
                    ]}
                  >
                    {
                      product.comments
                        .length
                    }
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View
              style={styles.timeRow}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={COLORS.faint}
              />

              <Text
                style={
                  styles.timeText
                }
              >
                {formatDate(
                  product.created_at
                )}
              </Text>
            </View>
          </View>

          {/* COMENTÁRIOS */}

          {commentVisible && (
            <View
              style={
                styles.commentBox
              }
            >
              <View
                style={
                  styles.commentInputRow
                }
              >
                <TextInput
                  style={
                    styles.commentInput
                  }
                  placeholder="Adicione um comentário..."
                  placeholderTextColor={
                    COLORS.faint
                  }
                  value={comment}
                  onChangeText={
                    setComment
                  }
                  onSubmitEditing={
                    addComment
                  }
                  returnKeyType="send"
                />

                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      opacity:
                        comment.trim()
                          ? 1
                          : 0.5,
                    },
                  ]}
                  onPress={
                    addComment
                  }
                  disabled={
                    !comment.trim()
                  }
                >
                  <Ionicons
                    name="send"
                    size={15}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              {commentsLoading ? (
                <ActivityIndicator
                  color={
                    COLORS.primary
                  }
                  style={{
                    marginVertical: 16,
                  }}
                />
              ) : product.comments
                  ?.length ? (
                product.comments.map(
                  (c) => (
                    <View
                      key={c.id}
                      style={
                        styles.commentItem
                      }
                    >
                      <View
                        style={{
                          flexDirection:
                            "row",
                          gap: 10,
                        }}
                      >
                        <View
                          style={
                            styles.commentAvatar
                          }
                        >
                          <Text
                            style={
                              styles.commentAvatarText
                            }
                          >
                            {c.user_name
                              ?.charAt(
                                0
                              )
                              ?.toUpperCase() ||
                              "?"}
                          </Text>
                        </View>

                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <View
                            style={
                              styles.commentHeaderRow
                            }
                          >
                            <Text
                              style={
                                styles.commentUserName
                              }
                            >
                              {
                                c.user_name
                              }
                            </Text>

                            <View
                              style={
                                styles.commentTypePill
                              }
                            >
                              <Text
                                style={
                                  styles.commentTypeText
                                }
                              >
                                {
                                  c.user_type
                                }
                              </Text>
                            </View>

                            <Text
                              style={
                                styles.commentDate
                              }
                            >
                              {formatDate(
                                c.created_at
                              )}
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.commentText
                            }
                          >
                            {
                              c.comment_text
                            }
                          </Text>

                          {/* AÇÕES DO COMENTÁRIO */}

                          <View
                            style={
                              styles.commentActionsRow
                            }
                          >
                            <TouchableOpacity
                              style={
                                styles.commentActionBtn
                              }
                              onPress={() =>
                                toggleCommentLike(
                                  c.id,
                                  c.is_liked ||
                                    false
                                )
                              }
                            >
                              <Ionicons
                                name={
                                  c.is_liked
                                    ? "thumbs-up"
                                    : "thumbs-up-outline"
                                }
                                size={13}
                                color={
                                  c.is_liked
                                    ? COLORS.red
                                    : COLORS.faint
                                }
                              />

                              <Text
                                style={[
                                  styles.commentActionText,
                                  {
                                    color:
                                      c.is_liked
                                        ? COLORS.red
                                        : COLORS.faint,
                                  },
                                ]}
                              >
                                {c.likes_count ||
                                  "Curtir"}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={
                                styles.commentActionBtn
                              }
                              onPress={() =>
                                setReplyingTo(
                                  replyingTo ===
                                    c.id
                                    ? null
                                    : c.id
                                )
                              }
                            >
                              <Ionicons
                                name="arrow-undo-outline"
                                size={13}
                                color={
                                  COLORS.primary
                                }
                              />

                              <Text
                                style={[
                                  styles.commentActionText,
                                  {
                                    color:
                                      COLORS.primary,
                                  },
                                ]}
                              >
                                Responder
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* RESPOSTA */}

                          {replyingTo ===
                            c.id && (
                            <View
                              style={[
                                styles.commentInputRow,
                                {
                                  marginTop: 8,
                                },
                              ]}
                            >
                              <TextInput
                                style={[
                                  styles.commentInput,
                                  styles.replyInput,
                                ]}
                                placeholder="Sua resposta..."
                                placeholderTextColor={
                                  COLORS.faint
                                }
                                value={
                                  replyText
                                }
                                onChangeText={
                                  setReplyText
                                }
                                onSubmitEditing={() =>
                                  addReply(
                                    c.id
                                  )
                                }
                                returnKeyType="send"
                                autoFocus
                              />

                              <TouchableOpacity
                                style={[
                                  styles.sendBtn,
                                  styles.replySendBtn,
                                ]}
                                onPress={() =>
                                  addReply(
                                    c.id
                                  )
                                }
                              >
                                <Ionicons
                                  name="send"
                                  size={13}
                                  color="#FFFFFF"
                                />
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* RESPOSTAS */}

                          {!!c.replies
                            ?.length && (
                            <View
                              style={
                                styles.repliesWrap
                              }
                            >
                              {c.replies.map(
                                (r) => (
                                  <View
                                    key={
                                      r.id
                                    }
                                    style={
                                      styles.replyItem
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.replyUserName
                                      }
                                    >
                                      {
                                        r.user_name
                                      }
                                    </Text>

                                    <Text
                                      style={
                                        styles.replySeparator
                                      }
                                    >
                                      {" "}
                                      ·{" "}
                                    </Text>

                                    <Text
                                      style={
                                        styles.replyText
                                      }
                                    >
                                      {
                                        r.reply_text
                                      }
                                    </Text>
                                  </View>
                                )
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )
                )
              ) : (
                <View
                  style={
                    styles.emptyComments
                  }
                >
                  <Ionicons
                    name="leaf-outline"
                    size={28}
                    color={
                      COLORS.border
                    }
                  />

                  <Text
                    style={
                      styles.emptyCommentsText
                    }
                  >
                    Seja o primeiro a
                    comentar!
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }
);

ProductCard.displayName =
  "ProductCard";

/* =========================================================
   COMPONENTE DO FEED
   USE ESTE COMPONENTE NA SUA TELA
========================================================= */

export const ProductFeed = ({
  products = [],
  currentUserId = null,
  onOpenPreOrder = () => {},
  onRequireLogin = () => {},
  refreshing = false,
  onRefresh = () => {},
}) => {
  /*
   * AQUI ESTÁ A REGRA PRINCIPAL:
   *
   * Se existem produtos reais:
   *     usa products
   *
   * Se NÃO existem produtos reais:
   *     usa MOCK_PRODUCTS
   */

  const hasRealProducts =
    Array.isArray(products) &&
    products.length > 0;

  const displayedProducts =
    hasRealProducts
      ? products
      : MOCK_PRODUCTS;

  const [localProducts, setLocalProducts] =
    useState(displayedProducts);

  /*
   * Sempre que o Supabase receber
   * publicações reais, os mockups
   * desaparecem.
   */

  useEffect(() => {
    if (
      Array.isArray(products) &&
      products.length > 0
    ) {
      setLocalProducts(products);
    } else {
      setLocalProducts(
        MOCK_PRODUCTS
      );
    }
  }, [products]);

  /* =====================================================
     ATUALIZAR PRODUTO
  ===================================================== */

  const handleProductUpdate =
    useCallback(
      (updatedProduct) => {
        setLocalProducts(
          (current) =>
            current.map((item) =>
              item.id ===
              updatedProduct.id
                ? updatedProduct
                : item
            )
        );
      },
      []
    );

  return (
    <FlatList
      data={localProducts}
      keyExtractor={(item) =>
        item.id
      }
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          currentUserId={
            currentUserId
          }
          onProductUpdate={
            handleProductUpdate
          }
          onOpenPreOrder={
            onOpenPreOrder
          }
          onRequireLogin={
            onRequireLogin
          }
        />
      )}
      showsVerticalScrollIndicator={
        false
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={{
        paddingTop: 10,
        paddingBottom: 30,
      }}
    />
  );
};

/* =========================================================
   ESTILOS
========================================================= */

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "center",
    borderRadius: RADIUS.xl,
    backgroundColor:
      COLORS.surface,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    marginBottom: 18,
    overflow: "hidden",

    shadowColor: "#16231C",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 2,
  },

  /* =====================================================
     IMAGEM
  ===================================================== */

  imageWrap: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor:
      COLORS.primarySoft,
  },

  image: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },

  noPhoto: {
    alignItems: "center",
    justifyContent:
      "center",
    gap: 6,
  },

  noPhotoText: {
    fontSize: 12,
    color: COLORS.faint,
    fontWeight: "600",
  },

  /* =====================================================
     CONTADOR
  ===================================================== */

  photoCounter: {
    position: "absolute",
    top: 10,
    right: 10,

    backgroundColor:
      "rgba(22,35,28,0.68)",

    borderRadius: 999,

    paddingHorizontal: 8,
    paddingVertical: 5,

    flexDirection: "row",
    alignItems: "center",

    gap: 4,
  },

  photoCounterText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  /* =====================================================
     DOTS
  ===================================================== */

  dotsRow: {
    position: "absolute",

    bottom: 10,
    left: 0,
    right: 0,

    flexDirection: "row",

    justifyContent:
      "center",

    gap: 5,
  },

  dot: {
    width: 5,
    height: 5,

    borderRadius: 3,

    backgroundColor:
      "rgba(255,255,255,0.6)",
  },

  dotActive: {
    width: 14,

    backgroundColor:
      "#FFFFFF",
  },

  /* =====================================================
     BADGES
  ===================================================== */

  imageBadgeRow: {
    position: "absolute",

    top: 10,
    left: 10,

    zIndex: 5,

    flexDirection: "row",

    gap: 6,
  },

  badgeNew: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,

    backgroundColor:
      "rgba(22,35,28,0.6)",

    borderRadius: 999,

    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  badgeNewText: {
    color: "#FFFFFF",

    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 0.3,
  },

  badgeDiscount: {
    backgroundColor:
      "#FFFFFF",

    borderRadius: 999,

    paddingHorizontal: 9,
    paddingVertical: 4,

    borderWidth: 1,

    borderColor:
      COLORS.primaryLight,
  },

  badgeDiscountText: {
    color: COLORS.primary,

    fontSize: 10,

    fontWeight: "800",
  },

  demoBadge: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,

    backgroundColor:
      "rgba(226,147,47,0.92)",

    borderRadius: 999,

    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  demoBadgeText: {
    color: "#FFFFFF",

    fontSize: 10,

    fontWeight: "800",
  },

  /* =====================================================
     SHARE
  ===================================================== */

  shareBtn: {
    position: "absolute",

    top: 10,
    right: 10,

    zIndex: 5,

    width: 30,
    height: 30,

    borderRadius: 15,

    backgroundColor:
      "rgba(255,255,255,0.92)",

    alignItems: "center",

    justifyContent:
      "center",
  },

  /* =====================================================
     CONTEÚDO
  ===================================================== */

  content: {
    padding: 16,
  },

  /* =====================================================
     AGRICULTOR
  ===================================================== */

  farmerRow: {
    flexDirection: "row",

    alignItems: "flex-start",

    gap: 10,

    marginBottom: 14,
  },

  avatar: {
    width: 40,
    height: 40,

    borderRadius: 20,

    backgroundColor:
      COLORS.primary,

    alignItems: "center",

    justifyContent:
      "center",
  },

  avatarText: {
    color: "#FFFFFF",

    fontWeight: "800",

    fontSize: 16,
  },

  farmerNameRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  farmerName: {
    fontSize: 13.5,

    fontWeight: "800",

    color: COLORS.text,

    flexShrink: 1,
  },

  locationRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 3,

    marginTop: 2,
  },

  locationText: {
    fontSize: 11,

    color: COLORS.faint,

    flexShrink: 1,
  },

  typeBadge: {
    maxWidth: 110,

    backgroundColor:
      COLORS.canvas,

    borderRadius: 999,

    paddingHorizontal: 9,

    paddingVertical: 4,

    borderWidth: 1,

    borderColor:
      COLORS.border,
  },

  typeBadgeText: {
    fontSize: 10,

    fontWeight: "700",

    color: COLORS.muted,
  },

  /* =====================================================
     PRODUTO
  ===================================================== */

  title: {
    fontSize: 18,

    fontWeight: "800",

    color: COLORS.text,

    marginBottom: 8,
  },

  priceRow: {
    flexDirection: "row",

    alignItems: "baseline",

    gap: 8,

    marginBottom: 4,
  },

  price: {
    fontSize: 22,

    fontWeight: "800",

    color: COLORS.text,
  },

  priceOld: {
    fontSize: 12,

    color: COLORS.faint,

    textDecorationLine:
      "line-through",
  },

  /* =====================================================
     STOCK
  ===================================================== */

  stockRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 5,

    marginBottom: 14,
  },

  stockText: {
    fontSize: 11.5,

    color: COLORS.muted,

    fontWeight: "600",
  },

  /* =====================================================
     COMPRAR
  ===================================================== */

  buyBtn: {
    height: 48,

    borderRadius:
      RADIUS.md,

    backgroundColor:
      COLORS.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent:
      "center",

    gap: 8,

    marginBottom: 12,
  },

  buyBtnText: {
    color: "#FFFFFF",

    fontSize: 14,

    fontWeight: "800",
  },

  /* =====================================================
     DESCRIÇÃO
  ===================================================== */

  description: {
    fontSize: 13,

    color: COLORS.muted,

    lineHeight: 19,
  },

  /* =====================================================
     META
  ===================================================== */

  metaRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 16,

    flexWrap: "wrap",

    paddingTop: 12,

    marginTop: 12,

    borderTopWidth: 1,

    borderTopColor:
      COLORS.border,
  },

  metaItem: {
    flexDirection: "row",

    alignItems: "center",

    gap: 5,
  },

  metaText: {
    fontSize: 11.5,

    color: COLORS.faint,

    fontWeight: "500",
  },

  /* =====================================================
     AÇÕES
  ===================================================== */

  actionsRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent:
      "space-between",

    paddingTop: 12,

    marginTop: 12,

    borderTopWidth: 1,

    borderTopColor:
      COLORS.border,
  },

  actionBtn: {
    flexDirection: "row",

    alignItems: "center",

    gap: 5,

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 999,
  },

  actionBtnLiked: {
    backgroundColor:
      "rgba(221,81,56,0.08)",
  },

  actionBtnActive: {
    backgroundColor:
      COLORS.primarySoft,
  },

  actionBtnText: {
    fontSize: 12.5,

    fontWeight: "700",
  },

  timeRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  timeText: {
    fontSize: 11,

    color: COLORS.faint,
  },

  /* =====================================================
     COMENTÁRIOS
  ===================================================== */

  commentBox: {
    paddingTop: 14,

    marginTop: 12,

    borderTopWidth: 1,

    borderTopColor:
      COLORS.border,
  },

  commentInputRow: {
    flexDirection: "row",

    gap: 8,

    marginBottom: 14,
  },

  commentInput: {
    flex: 1,

    height: 42,

    borderRadius: 999,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    paddingHorizontal: 15,

    fontSize: 13,

    color: COLORS.text,

    backgroundColor:
      COLORS.surface,
  },

  replyInput: {
    height: 36,

    fontSize: 12,
  },

  sendBtn: {
    width: 42,
    height: 42,

    borderRadius: 21,

    backgroundColor:
      COLORS.primary,

    alignItems: "center",

    justifyContent:
      "center",
  },

  replySendBtn: {
    width: 36,
    height: 36,

    borderRadius: 18,
  },

  commentItem: {
    backgroundColor:
      COLORS.canvas,

    borderRadius:
      RADIUS.md,

    padding: 12,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    marginBottom: 10,
  },

  commentAvatar: {
    width: 30,
    height: 30,

    borderRadius: 15,

    backgroundColor:
      COLORS.primary,

    alignItems: "center",

    justifyContent:
      "center",
  },

  commentAvatarText: {
    color: "#FFFFFF",

    fontWeight: "800",

    fontSize: 12,
  },

  commentHeaderRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 6,

    flexWrap: "wrap",

    marginBottom: 3,
  },

  commentUserName: {
    fontSize: 12.5,

    fontWeight: "800",

    color: COLORS.text,
  },

  commentTypePill: {
    backgroundColor:
      COLORS.surface,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    borderRadius: 999,

    paddingHorizontal: 7,

    paddingVertical: 1,
  },

  commentTypeText: {
    fontSize: 9,

    color: COLORS.faint,

    fontWeight: "600",
  },

  commentDate: {
    fontSize: 10,

    color: COLORS.faint,
  },

  commentText: {
    fontSize: 12.5,

    color: COLORS.text,

    lineHeight: 18,
  },

  commentActionsRow: {
    flexDirection: "row",

    gap: 14,

    marginTop: 8,
  },

  commentActionBtn: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  commentActionText: {
    fontSize: 11.5,

    fontWeight: "600",
  },

  repliesWrap: {
    marginTop: 8,

    paddingLeft: 10,

    borderLeftWidth: 2,

    borderLeftColor:
      COLORS.border,
  },

  replyItem: {
    flexDirection: "row",

    flexWrap: "wrap",

    marginBottom: 4,
  },

  replyUserName: {
    fontSize: 11.5,

    fontWeight: "800",

    color: COLORS.text,
  },

  replySeparator: {
    fontSize: 11.5,

    color: COLORS.faint,
  },

  replyText: {
    fontSize: 11.5,

    color: COLORS.muted,
  },

  emptyComments: {
    alignItems: "center",

    paddingVertical: 22,

    gap: 6,
  },

  emptyCommentsText: {
    fontSize: 12.5,

    color: COLORS.faint,
  },
});

export default ProductCard;