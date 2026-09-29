import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import { supabase } from "../lib/supabase";

const COLORS = {
  primary: "#1F6B3A",
  primarySoft: "#EAF3EA",
  accent: "#E2932F",
  accentSoft: "#FBEBD3",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",
  red: "#DD5138",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 36; // 18px de cada lado, igual ao resto do feed

export type Comment = {
  id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  user_name?: string;
};

export type Product = {
  id: string;
  product_type: string;
  description?: string | null;
  quantity: number;
  harvest_date: string;
  price: number;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  contact: string;
  photos: string[];
  status: string;
  created_at: string;
  user_id: string;
  location_lat?: number | null;
  location_lng?: number | null;
  likes_count: number;
  is_liked: boolean;
  comments: Comment[];
  commentsLoaded: boolean;
  user_verified: boolean;
};

type Props = {
  product: Product;
  currentUserId: string | null;
  onProductUpdate: (updated: Product) => void;
  onOpenPreOrder: (product: Product) => void;
  onRequireLogin: () => void;
};

function formatKz(price?: number) {
  const value = Number(price || 0);
  return `${value.toLocaleString("pt-AO")} Kz`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(iso).toLocaleDateString("pt-AO");
}

// URL gratuita do OpenStreetMap, sem chave de API, para dentro de um WebView.
function osmEmbedUrl(lat: number, lng: number) {
  const delta = 0.012;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

/* ---------------------------- micro-animação ---------------------------- */

function PressableScale({ children, style, onPress, disabled, ...rest }: any) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ================================ componente ================================ */

export default function ProductCard({
  product,
  currentUserId,
  onProductUpdate,
  onOpenPreOrder,
  onRequireLogin,
}: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const mapEnter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (mapVisible) {
      mapEnter.setValue(0);
      Animated.spring(mapEnter, { toValue: 1, bounciness: 6, speed: 14, useNativeDriver: true }).start();
    }
  }, [mapVisible]);

  const isMock = product.id.startsWith("mock-");
  const photos = Array.isArray(product.photos) && product.photos.length > 0 ? product.photos : [];
  const hasLocation = typeof product.location_lat === "number" && typeof product.location_lng === "number";

  const nextPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((i) => (i + 1) % photos.length);
  };
  const prevPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  };

  const openMap = () => {
    if (!hasLocation) {
      Alert.alert("Localização", "Este produto não tem localização definida.");
      return;
    }
    setMapVisible(true);
  };

  const closeMap = () => setMapVisible(false);

  const toggleLike = async () => {
    if (isMock) {
      Alert.alert("Demonstração", "Esta publicação é apenas uma demonstração.");
      return;
    }
    if (!currentUserId) {
      onRequireLogin();
      return;
    }
    if (liking) return;
    setLiking(true);

    const wasLiked = product.is_liked;
    onProductUpdate({
      ...product,
      is_liked: !wasLiked,
      likes_count: Math.max(0, product.likes_count + (wasLiked ? -1 : 1)),
    });

    try {
      if (wasLiked) {
        await supabase
          .from("product_likes")
          .delete()
          .eq("product_id", product.id)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("product_likes").insert({ product_id: product.id, user_id: currentUserId });
      }
    } catch (error) {
      onProductUpdate(product);
      console.log("Erro ao curtir:", error);
    } finally {
      setLiking(false);
    }
  };

  const loadComments = async () => {
    setShowComments((v) => !v);
    if (isMock || product.commentsLoaded) return;

    try {
      const { data, error } = await supabase
        .from("product_comments")
        .select("id, user_id, comment_text, created_at")
        .eq("product_id", product.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      onProductUpdate({ ...product, comments: (data || []) as Comment[], commentsLoaded: true });
    } catch (error) {
      console.log("Erro ao carregar comentários:", error);
    }
  };

  const sendComment = async () => {
    if (isMock) {
      Alert.alert("Demonstração", "Esta publicação é apenas uma demonstração.");
      return;
    }
    if (!currentUserId) {
      onRequireLogin();
      return;
    }
    const text = commentText.trim();
    if (!text) return;

    setSendingComment(true);
    try {
      const { data, error } = await supabase
        .from("product_comments")
        .insert({ product_id: product.id, user_id: currentUserId, comment_text: text })
        .select("id, user_id, comment_text, created_at")
        .single();

      if (error) throw error;

      onProductUpdate({
        ...product,
        comments: [...(product.comments || []), data as Comment],
        commentsLoaded: true,
      });
      setCommentText("");
    } catch (error) {
      console.log("Erro ao comentar:", error);
      Alert.alert("Erro", "Não foi possível enviar o comentário.");
    } finally {
      setSendingComment(false);
    }
  };

  const callFarmer = () => {
    if (!product.contact) return;
    Linking.openURL(`tel:${product.contact.replace(/\s/g, "")}`).catch(() => {});
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        },
      ]}
    >
      {/* Cabeçalho: produtor */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="sprout" size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.farmerName} numberOfLines={1}>{product.farmer_name}</Text>
            {product.user_verified ? (
              <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
            ) : null}
          </View>
          <Text style={styles.location} numberOfLines={1}>
            {product.municipality_id}, {product.province_id} · {timeAgo(product.created_at)}
          </Text>
        </View>

        <PressableScale style={styles.mapIconBtn} onPress={openMap}>
          <Ionicons name="map-outline" size={16} color={hasLocation ? COLORS.primary : COLORS.faint} />
        </PressableScale>

        {isMock ? (
          <View style={styles.demoPill}>
            <Text style={styles.demoPillText}>DEMO</Text>
          </View>
        ) : null}
      </View>

      {/* Imagens */}
      <View style={styles.photoWrap}>
        {photos.length > 0 ? (
          <Image source={{ uri: photos[photoIndex] }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="image-outline" size={34} color={COLORS.faint} />
          </View>
        )}

        {photos.length > 1 ? (
          <>
            <TouchableOpacity style={[styles.photoNav, styles.photoNavLeft]} onPress={prevPhoto}>
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoNav, styles.photoNavRight]} onPress={nextPhoto}>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.stockPill}>
          <Text style={styles.stockPillText}>{Number(product.quantity).toLocaleString("pt-AO")} kg disponíveis</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.productType}>{product.product_type}</Text>
          <Text style={styles.price}>{formatKz(product.price)}<Text style={styles.priceUnit}>/kg</Text></Text>
        </View>

        {product.description ? (
          <Text style={styles.description} numberOfLines={3}>{product.description}</Text>
        ) : null}

        {/* Ações */}
        <View style={styles.actions}>
          <PressableScale style={styles.actionBtn} onPress={toggleLike} disabled={liking}>
            <Ionicons
              name={product.is_liked ? "heart" : "heart-outline"}
              size={19}
              color={product.is_liked ? COLORS.red : COLORS.muted}
            />
            <Text style={styles.actionText}>{product.likes_count}</Text>
          </PressableScale>

          <PressableScale style={styles.actionBtn} onPress={loadComments}>
            <Ionicons name="chatbubble-outline" size={17} color={COLORS.muted} />
            <Text style={styles.actionText}>{product.comments?.length ?? 0}</Text>
          </PressableScale>

          <PressableScale style={styles.actionBtn} onPress={callFarmer}>
            <Ionicons name="call-outline" size={17} color={COLORS.muted} />
          </PressableScale>

          <PressableScale style={styles.buyBtn} onPress={() => onOpenPreOrder(product)}>
            <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
            <Text style={styles.buyBtnText}>Comprar</Text>
          </PressableScale>
        </View>

        {/* Comentários */}
        {showComments ? (
          <View style={styles.commentsBox}>
            {(product.comments || []).length === 0 ? (
              <Text style={styles.noComments}>Sê o primeiro a comentar.</Text>
            ) : (
              product.comments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  <Text style={styles.commentText}>{c.comment_text}</Text>
                  <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                </View>
              ))
            )}

            <View style={styles.commentInputRow}>
              <PressableScale
                style={[styles.commentSend, sendingComment && { opacity: 0.5 }]}
                onPress={sendComment}
                disabled={sendingComment}
              >
                <Ionicons name="send" size={15} color="#FFFFFF" />
              </PressableScale>
            </View>
          </View>
        ) : null}
      </View>

      {/* MODAL DO MAPA — gratuito, via OpenStreetMap, sem chave de API */}
      <Modal visible={mapVisible} transparent animationType="fade" onRequestClose={closeMap}>
        <View style={styles.mapOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMap} />
          <Animated.View
            style={[
              styles.mapCard,
              {
                opacity: mapEnter,
                transform: [
                  { scale: mapEnter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  { translateY: mapEnter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.mapHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapTitle}>Localização do produto</Text>
                <Text style={styles.mapSubtitle} numberOfLines={1}>{product.product_type} · {product.farmer_name}</Text>
              </View>
              <TouchableOpacity onPress={closeMap} style={styles.mapCloseX} accessibilityLabel="Fechar">
                <Ionicons name="close" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.mapBody}>
              {hasLocation ? (
                <WebView
                  source={{ uri: osmEmbedUrl(product.location_lat as number, product.location_lng as number) }}
                  style={{ flex: 1 }}
                  startInLoadingState
                />
              ) : (
                <View style={styles.mapEmpty}>
                  <Ionicons name="location-outline" size={30} color={COLORS.faint} />
                  <Text style={styles.mapEmptyText}>Localização não disponível.</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.mapCancelBtn} onPress={closeMap}>
              <Text style={styles.mapCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#16231C",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  farmerName: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  location: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  mapIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  demoPill: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  demoPillText: { fontSize: 9, fontWeight: "900", color: "#B9741A" },

  photoWrap: { width: "100%", aspectRatio: 4 / 3, backgroundColor: COLORS.canvas },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  photoNav: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(22,35,28,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoNavLeft: { left: 10 },
  photoNavRight: { right: 10 },
  dots: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#FFFFFF", width: 16 },
  stockPill: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(22,35,28,0.55)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stockPillText: { fontSize: 10.5, fontWeight: "700", color: "#FFFFFF" },

  body: { padding: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productType: { fontSize: 17, fontWeight: "900", color: COLORS.text, flexShrink: 1, marginRight: 10 },
  price: { fontSize: 16, fontWeight: "900", color: COLORS.primary },
  priceUnit: { fontSize: 11, fontWeight: "600", color: COLORS.muted },
  description: { fontSize: 12.5, color: COLORS.muted, marginTop: 6, lineHeight: 18 },

  actions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  buyBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 38,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  buyBtnText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" },

  commentsBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  noComments: { fontSize: 12, color: COLORS.faint, fontStyle: "italic" },
  commentRow: { marginBottom: 8 },
  commentText: { fontSize: 12.5, color: COLORS.text },
  commentTime: { fontSize: 10, color: COLORS.faint, marginTop: 1 },
  commentInputRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  commentSend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Mapa
  mapOverlay: {
    flex: 1,
    backgroundColor: "rgba(22,35,28,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  mapCard: {
    width: "100%",
    maxWidth: 420,
    height: 440,
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mapTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  mapSubtitle: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  mapCloseX: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  mapBody: { flex: 1, backgroundColor: COLORS.canvas },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  mapEmptyText: { fontSize: 12.5, color: COLORS.faint },
  mapCancelBtn: {
    height: 48,
    margin: 14,
    borderRadius: 14,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  mapCancelText: { fontSize: 13.5, fontWeight: "800", color: COLORS.muted },
});