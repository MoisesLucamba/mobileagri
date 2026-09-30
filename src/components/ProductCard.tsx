import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";
import Icon from "./Icon";
import MapViewer from "./MapViewer";

const COLORS = {
  primary: "#1F6B3A",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  red: "#DD5138",
  white: "#FFFFFF",
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

/* ---------------------------- micro-animação ---------------------------- */

type PressableScaleProps = {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  disabled?: boolean;
};

function PressableScale({ children, className, onPress, disabled }: PressableScaleProps) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => to(0.94)} onPressOut={() => to(1)}>
      <Animated.View style={{ transform: [{ scale: sc }] }}>
        <View className={className}>{children}</View>
      </Animated.View>
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

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

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
    const opening = !showComments;
    setShowComments(opening);
    if (!opening || isMock || product.commentsLoaded) return;

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
    if (!text || sendingComment) return;

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
    } catch (error: any) {
      console.log("Erro ao comentar:", error);
      Alert.alert("Erro", error?.message || "Não foi possível enviar o comentário.");
    } finally {
      setSendingComment(false);
    }
  };

  const callFarmer = () => {
    if (!product.contact) return;
    Linking.openURL(`tel:${product.contact.replace(/\s/g, "")}`).catch(() => {});
  };

  const canSend = commentText.trim().length > 0 && !sendingComment;

  return (
    <>
      <Animated.View
        style={[
          s.cardShadow,
          {
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
            ],
          },
        ]}
      >
        <View className="overflow-hidden rounded-[22px] bg-white">
          {/* Cabeçalho: produtor */}
          <View className="flex-row items-center gap-[10px] p-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EAF3EA]">
              <Icon name="leaf" size={18} color={COLORS.primary} />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="shrink text-[13.5px] font-extrabold text-[#16231C]" numberOfLines={1}>
                  {product.farmer_name}
                </Text>
                {product.user_verified ? <Icon name="check-circle" size={14} color={COLORS.primary} /> : null}
              </View>
              <Text className="mt-px text-[11px] text-[#78877D]" numberOfLines={1}>
                {product.municipality_id}, {product.province_id} · {timeAgo(product.created_at)}
              </Text>
            </View>

            <PressableScale className="h-8 w-8 items-center justify-center rounded-full bg-[#FAF8F3]" onPress={openMap}>
              <Icon name="map" size={16} color={hasLocation ? COLORS.primary : COLORS.faint} />
            </PressableScale>

            {isMock ? (
              <View className="ml-1.5 rounded-full bg-[#FBEBD3] px-2 py-[3px]">
                <Text className="text-[9px] font-black text-[#B9741A]">DEMO</Text>
              </View>
            ) : null}
          </View>

          {/* Imagens */}
          <View className="w-full bg-[#FAF8F3]" style={{ aspectRatio: 4 / 3 }}>
            {photos.length > 0 ? (
              <Image source={{ uri: photos[photoIndex] }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Icon name="image" size={34} color={COLORS.faint} />
              </View>
            )}

            {photos.length > 1 ? (
              <>
                <TouchableOpacity
                  className="absolute left-[10px] top-1/2 -mt-4 h-8 w-8 items-center justify-center rounded-full bg-[rgba(22,35,28,0.45)]"
                  onPress={prevPhoto}
                >
                  <Icon name="chevron-left" size={18} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="absolute right-[10px] top-1/2 -mt-4 h-8 w-8 items-center justify-center rounded-full bg-[rgba(22,35,28,0.45)]"
                  onPress={nextPhoto}
                >
                  <Icon name="chevron-right" size={18} color={COLORS.white} />
                </TouchableOpacity>
                <View className="absolute bottom-[10px] flex-row gap-[5px] self-center">
                  {photos.map((_, i) => (
                    <View
                      key={i}
                      className={
                        i === photoIndex
                          ? "h-[6px] w-4 rounded-full bg-white"
                          : "h-[6px] w-[6px] rounded-full bg-[rgba(255,255,255,0.5)]"
                      }
                    />
                  ))}
                </View>
              </>
            ) : null}

            <View className="absolute left-[10px] top-[10px] rounded-[10px] bg-[rgba(22,35,28,0.55)] px-2 py-1">
              <Text className="text-[10.5px] font-bold text-white">
                {Number(product.quantity).toLocaleString("pt-AO")} kg disponíveis
              </Text>
            </View>
          </View>

          {/* Info */}
          <View className="p-[14px]">
            <View className="flex-row items-center justify-between">
              <Text className="mr-[10px] shrink text-[17px] font-black text-[#16231C]">{product.product_type}</Text>
              <Text className="text-base font-black text-[#1F6B3A]">
                {formatKz(product.price)}
                <Text className="text-[11px] font-semibold text-[#78877D]">/kg</Text>
              </Text>
            </View>

            {product.description ? (
              <Text className="mt-1.5 text-[12.5px] leading-[18px] text-[#78877D]" numberOfLines={3}>
                {product.description}
              </Text>
            ) : null}

            {/* Ações */}
            <View className="mt-3 flex-row items-center gap-4">
              <PressableScale className="flex-row items-center gap-1" onPress={toggleLike} disabled={liking}>
                <Icon
                  name="heart"
                  size={19}
                  filled={product.is_liked}
                  color={product.is_liked ? COLORS.red : COLORS.muted}
                />
                <Text className="text-xs font-bold text-[#78877D]">{product.likes_count}</Text>
              </PressableScale>

              <PressableScale className="flex-row items-center gap-1" onPress={loadComments}>
                <Icon name="message" size={17} color={COLORS.muted} />
                <Text className="text-xs font-bold text-[#78877D]">{product.comments?.length ?? 0}</Text>
              </PressableScale>

              <PressableScale className="flex-row items-center gap-1" onPress={callFarmer}>
                <Icon name="phone" size={17} color={COLORS.muted} />
              </PressableScale>

              <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenPreOrder(product)} style={s.buyBtn}>
                <Icon name="cart" size={16} color={COLORS.white} />
                <Text style={s.buyText}>Comprar</Text>
              </TouchableOpacity>
            </View>

            {/* Comentários */}
            {showComments ? (
              <View className="mt-3 border-t border-[#EAE4D6] pt-[10px]">
                {(product.comments || []).length === 0 ? (
                  <Text className="mb-2 text-xs italic text-[#AEB8AC]">Sê o primeiro a comentar.</Text>
                ) : (
                  product.comments.map((c) => (
                    <View key={c.id} className="mb-2">
                      <Text className="text-[12.5px] text-[#16231C]">{c.comment_text}</Text>
                      <Text className="mt-px text-[10px] text-[#AEB8AC]">{timeAgo(c.created_at)}</Text>
                    </View>
                  ))
                )}

                <View className="mt-1 flex-row items-center gap-2">
                  <TextInput
                    className="h-10 flex-1 rounded-full border border-[#EAE4D6] bg-[#FAF8F3] px-[14px] text-[13px] text-[#16231C]"
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="Escreve um comentário..."
                    placeholderTextColor={COLORS.faint}
                    maxLength={500}
                    returnKeyType="send"
                    blurOnSubmit={false}
                    onSubmitEditing={sendComment}
                    editable={!sendingComment}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={sendComment}
                    disabled={!canSend}
                    style={[s.sendBtn, !canSend && { opacity: 0.45 }]}
                  >
                    <Icon name="send" size={15} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Mapa: componente separado, aberto pelo ícone do cabeçalho */}
      <MapViewer
        visible={mapVisible}
        coords={
          hasLocation
            ? { lat: product.location_lat as number, lng: product.location_lng as number }
            : null
        }
        title={product.product_type}
        subtitle={product.farmer_name}
        onClose={() => setMapVisible(false)}
      />
    </>
  );
}

// Estilos nativos: sombras e botões verdes principais.
const s = StyleSheet.create({
  cardShadow: {
    width: CARD_WIDTH,
    alignSelf: "center",
    marginBottom: 18,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16231C",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  buyBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#1F6B3A",
    shadowColor: "#1F6B3A",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  buyText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1F6B3A",
    alignItems: "center",
    justifyContent: "center",
  },
});