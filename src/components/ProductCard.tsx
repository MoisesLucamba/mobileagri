import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
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
  primary: "#2E8B4F",
  primaryDark: "#25703F",
  tint: "#E9F5EC",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  line: "#E8ECE6",
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
  user_avatar?: string | null;
};

export type Product = {
  id: string;
  product_type: string;
  description?: string | null;
  quantity: number;
  harvest_date?: string | null;
  price: number;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  /** URL da foto de perfil do produtor (opcional) */
  user_avatar?: string | null;
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

function formatHarvestDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day));
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

function initialsOf(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/* ------------------------------- avatar -------------------------------- */

function Avatar({ uri, name, size = 40 }: { uri?: string | null; name?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;
  const initials = initialsOf(name);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: COLORS.tint,
        borderWidth: 1,
        borderColor: COLORS.line,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : initials ? (
        <Text style={{ color: COLORS.primaryDark, fontWeight: "800", fontSize: size * 0.36 }}>{initials}</Text>
      ) : (
        <Icon name="leaf" size={size * 0.45} color={COLORS.primary} />
      )}
    </View>
  );
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
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => to(0.95)} onPressOut={() => to(1)}>
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
      duration: 380,
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

  const canSend = commentText.trim().length > 0 && !sendingComment;

  return (
    <>
      <Animated.View
        style={[
          s.card,
          {
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          },
        ]}
      >
        <View className="overflow-hidden rounded-[12px] bg-white">
          {/* Cabeçalho: foto + nome do produtor */}
          <View className="flex-row items-center gap-[10px] px-3 pb-[10px] pt-3">
            <Avatar uri={product.user_avatar} name={product.farmer_name} size={40} />

            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="shrink text-[14px] font-extrabold text-[#16231C]" numberOfLines={1}>
                  {product.farmer_name}
                </Text>
                {product.user_verified ? <Icon name="check-circle" size={14} color={COLORS.primary} /> : null}
                {isMock ? (
                  <View className="ml-1 rounded-[4px] bg-[#FBEBD3] px-[6px] py-[2px]">
                    <Text className="text-[9px] font-black text-[#B9741A]">DEMO</Text>
                  </View>
                ) : null}
              </View>
              <View className="mt-[2px] flex-row items-center gap-1">
                <Icon name="pin" size={11} color={COLORS.faint} />
                <Text className="shrink text-[11.5px] text-[#78877D]" numberOfLines={1}>
                  {product.municipality_id}, {product.province_id} · {timeAgo(product.created_at)}
                </Text>
              </View>
            </View>

            <PressableScale className="h-9 w-9 items-center justify-center rounded-[10px] bg-[#E9F5EC]" onPress={openMap}>
              <Icon name="map" size={17} color={hasLocation ? COLORS.primary : COLORS.faint} />
            </PressableScale>
          </View>

          {/* Imagens */}
          <View className="mx-3 overflow-hidden rounded-[8px] bg-[#F4F6F2]" style={{ aspectRatio: 4 / 3 }}>
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
                  className="absolute left-2 top-1/2 -mt-4 h-8 w-8 items-center justify-center rounded-[8px] bg-[rgba(22,35,28,0.45)]"
                  onPress={prevPhoto}
                >
                  <Icon name="chevron-left" size={18} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="absolute right-2 top-1/2 -mt-4 h-8 w-8 items-center justify-center rounded-[8px] bg-[rgba(22,35,28,0.45)]"
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
                          ? "h-[5px] w-4 rounded-full bg-white"
                          : "h-[5px] w-[5px] rounded-full bg-[rgba(255,255,255,0.55)]"
                      }
                    />
                  ))}
                </View>
              </>
            ) : null}

            {/* Quantidade */}
            <View className="absolute left-2 top-2 rounded-[6px] bg-[rgba(22,35,28,0.6)] px-2 py-1">
              <Text className="text-[10.5px] font-bold text-white">
                {Number(product.quantity).toLocaleString("pt-AO")} kg disponíveis
              </Text>
            </View>

            {/* Contador de fotos */}
            {photos.length > 1 ? (
              <View className="absolute right-2 top-2 rounded-[6px] bg-[rgba(22,35,28,0.6)] px-2 py-1">
                <Text className="text-[10.5px] font-bold text-white">
                  {photoIndex + 1}/{photos.length}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Info */}
          <View className="px-3 pb-3 pt-3">
            <View className="flex-row items-center justify-between">
              <Text className="mr-[10px] shrink text-[17px] font-black text-[#16231C]">{product.product_type}</Text>
              <View className="rounded-[8px] bg-[#E9F5EC] px-[10px] py-[5px]">
                <Text className="text-[14px] font-black text-[#25703F]">
                  {formatKz(product.price)}
                  <Text className="text-[11px] font-semibold text-[#5B7A66]"> /kg</Text>
                </Text>
              </View>
            </View>

            {product.description ? (
              <Text className="mt-1.5 text-[12.5px] leading-[18px] text-[#78877D]" numberOfLines={3}>
                {product.description}
              </Text>
            ) : null}

            {formatHarvestDate(product.harvest_date) ? (
              <View className="mt-2 flex-row items-center gap-[6px]">
                <Icon name="clock" size={14} color={COLORS.primary} />
                <Text className="text-[11.5px] font-semibold text-[#5B7A66]">
                  Colheita prevista: {formatHarvestDate(product.harvest_date)}
                </Text>
              </View>
            ) : null}

            {/* Ações */}
            <View className="mt-3 flex-row items-center gap-[18px] border-t border-[#E8ECE6] pt-3">
              <PressableScale className="flex-row items-center gap-[5px]" onPress={toggleLike} disabled={liking}>
                <Icon
                  name="heart"
                  size={20}
                  filled={product.is_liked}
                  color={product.is_liked ? COLORS.red : COLORS.muted}
                />
                <Text className="text-[12.5px] font-bold text-[#78877D]">{product.likes_count}</Text>
              </PressableScale>

              <PressableScale className="flex-row items-center gap-[5px]" onPress={loadComments}>
                <Icon name="message" size={18} color={showComments ? COLORS.primary : COLORS.muted} />
                <Text className="text-[12.5px] font-bold text-[#78877D]">{product.comments?.length ?? 0}</Text>
              </PressableScale>

              <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenPreOrder(product)} style={s.buyBtn}>
                <Icon name="cart" size={16} color={COLORS.white} />
                <Text style={s.buyText}>Comprar</Text>
              </TouchableOpacity>
            </View>

            {/* Comentários */}
            {showComments ? (
              <View className="mt-3 border-t border-[#E8ECE6] pt-3">
                {(product.comments || []).length === 0 ? (
                  <Text className="mb-2 text-xs italic text-[#AEB8AC]">Sê o primeiro a comentar.</Text>
                ) : (
                  product.comments.map((c) => (
                    <View key={c.id} className="mb-[10px] flex-row items-start gap-2">
                      <Avatar uri={c.user_avatar} name={c.user_name} size={28} />
                      <View className="flex-1 rounded-[8px] bg-[#F4F7F3] px-[10px] py-[7px]">
                        {c.user_name ? (
                          <Text className="text-[11.5px] font-extrabold text-[#16231C]" numberOfLines={1}>
                            {c.user_name}
                          </Text>
                        ) : null}
                        <Text className="text-[12.5px] text-[#16231C]">{c.comment_text}</Text>
                        <Text className="mt-px text-[10px] text-[#AEB8AC]">{timeAgo(c.created_at)}</Text>
                      </View>
                    </View>
                  ))
                )}

                <View className="mt-1 flex-row items-center gap-2">
                  <TextInput
                    className="h-10 flex-1 rounded-[10px] border border-[#E8ECE6] bg-[#F9FAF8] px-3 text-[13px] text-[#16231C]"
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

// Estilos nativos: cartão plano (borda fina, sombra quase nula) e botões verdes.
const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "center",
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: "#16231C",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  buyBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  buyText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});