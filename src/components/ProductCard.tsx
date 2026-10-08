import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { supabase } from "../lib/supabase";
import Icon from "./Icon";
import MapViewer from "./MapViewer";
import { COLORS, PressableScale, SHADOW, ShineButton } from "./ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;
const IMG_W = CARD_WIDTH - 20; // 10px de respiro de cada lado
const IMG_H = Math.round(IMG_W * 0.78);

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
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
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

function Avatar({ uri, name, size = 40, ring }: { uri?: string | null; name?: string; size?: number; ring?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;
  const initials = initialsOf(name);

  const inner = (
    <View
      style={{
        width: ring ? size - 4 : size,
        height: ring ? size - 4 : size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: COLORS.tint,
        borderWidth: ring ? 2 : 0,
        borderColor: COLORS.white,
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

  if (!ring) return inner;
  // anel verde em degradé à volta da foto do produtor
  return (
    <LinearGradient
      colors={[COLORS.primaryLight, "#A6E3B8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      {inner}
    </LinearGradient>
  );
}

/* ------------------------ pílula de ação (like/comentar) ------------------------ */

function ActionPill({
  icon,
  count,
  active,
  activeColor,
  activeBg,
  filled,
  onPress,
  disabled,
  pop,
}: {
  icon: "heart" | "message";
  count: number;
  active?: boolean;
  activeColor: string;
  activeBg: string;
  filled?: boolean;
  onPress: () => void;
  disabled?: boolean;
  pop?: Animated.Value;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scale={0.92}
      className="h-[38px] flex-row items-center gap-[6px] rounded-[10px] px-[13px]"
      style={{ backgroundColor: active ? activeBg : "#F3F6F2" }}
    >
      <Animated.View style={pop ? { transform: [{ scale: pop }] } : undefined}>
        <Icon name={icon} size={icon === "heart" ? 19 : 18} filled={filled} color={active ? activeColor : COLORS.muted} />
      </Animated.View>
      <Text style={{ fontSize: 13, fontWeight: "800", color: active ? activeColor : COLORS.muted }}>{count}</Text>
    </PressableScale>
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
  const router = useRouter();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  // entrada suave do cartão
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // "pop" do coração ao gostar
  const heartPop = useRef(new Animated.Value(1)).current;
  const prevLiked = useRef(product.is_liked);
  useEffect(() => {
    if (product.is_liked && !prevLiked.current) {
      Animated.sequence([
        Animated.spring(heartPop, { toValue: 1.4, useNativeDriver: true, speed: 40, bounciness: 14 }),
        Animated.spring(heartPop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    }
    prevLiked.current = product.is_liked;
  }, [product.is_liked]);

  const isMock = product.id.startsWith("mock-");
  const photos = Array.isArray(product.photos) && product.photos.length > 0 ? product.photos : [];
  const hasLocation = typeof product.location_lat === "number" && typeof product.location_lng === "number";
  const harvest = formatHarvestDate(product.harvest_date);

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / IMG_W);
    if (i !== photoIndex && i >= 0 && i < photos.length) setPhotoIndex(i);
  };

  const openMap = () => {
    if (!hasLocation) {
      Alert.alert("Localização", "Este produto não tem localização definida.");
      return;
    }
    setMapVisible(true);
  };

  const openUserProfile = () => {
    if (!isMock && product.user_id) router.push(`/profile/${product.user_id}`);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
          {
            width: CARD_WIDTH,
            alignSelf: "center",
            marginBottom: 18,
            borderRadius: 12,
            backgroundColor: COLORS.white,
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          },
          SHADOW.soft,
        ]}
      >
        <View className="overflow-hidden rounded-[12px] bg-white">
          {/* Cabeçalho */}
          <View className="flex-row items-center gap-[10px] px-[14px] pb-3 pt-[14px]">
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={openUserProfile}
              disabled={isMock || !product.user_id}
              accessibilityRole="link"
              accessibilityLabel={`Abrir perfil de ${product.farmer_name}`}
            >
              <Avatar uri={product.user_avatar} name={product.farmer_name} size={44} ring />
            </TouchableOpacity>

            <View className="flex-1">
              <TouchableOpacity
                className="flex-row items-center gap-1 self-start"
                activeOpacity={0.75}
                onPress={openUserProfile}
                disabled={isMock || !product.user_id}
                accessibilityRole="link"
                accessibilityLabel={`Abrir perfil de ${product.farmer_name}`}
              >
                <Text className="shrink text-[14.5px] font-extrabold text-[#16231C]" numberOfLines={1}>
                  {product.farmer_name}
                </Text>
                {product.user_verified ? <Icon name="check-circle" size={14} color={COLORS.primary} /> : null}
                {isMock ? (
                  <View className="ml-1 rounded-[4px] bg-[#FBEBD3] px-[7px] py-[2px]">
                    <Text className="text-[9px] font-black text-[#B9741A]">DEMO</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <View className="mt-[2px] flex-row items-center gap-1">
                <Icon name="pin" size={11} color={COLORS.faint} />
                <Text className="shrink text-[11.5px] text-[#78877D]" numberOfLines={1}>
                  {product.municipality_id}, {product.province_id} · {timeAgo(product.created_at)}
                </Text>
              </View>
            </View>

            <PressableScale
              className="h-9 w-9 items-center justify-center rounded-[10px] bg-[#E9F5EC]"
              onPress={openMap}
              scale={0.9}
            >
              <Icon name="map" size={18} color={hasLocation ? COLORS.primary : COLORS.faint} />
            </PressableScale>
          </View>

          {/* Galeria: desliza com o dedo */}
          <View
            style={{
              width: IMG_W,
              height: IMG_H,
              marginHorizontal: 10,
              borderRadius: 8,
              overflow: "hidden",
              backgroundColor: "#F0F4EE",
            }}
          >
            {photos.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                decelerationRate="fast"
                onScroll={onPhotoScroll}
              >
                {photos.map((uri, i) => (
                  <Image key={`${uri}-${i}`} source={{ uri }} style={{ width: IMG_W, height: IMG_H }} resizeMode="cover" />
                ))}
              </ScrollView>
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Icon name="image" size={34} color={COLORS.faint} />
              </View>
            )}

            {/* véu suave em baixo para os pontos ficarem legíveis */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(0,0,0,0)", "rgba(10,20,14,0.38)"]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 80 }}
            />

            {/* Quantidade */}
            <View className="absolute left-[10px] top-[10px] flex-row items-center gap-[5px] rounded-[6px] bg-[rgba(255,255,255,0.88)] px-[10px] py-[5px]">
              <View className="h-[6px] w-[6px] rounded-full bg-[#2E8B4F]" />
              <Text className="text-[11px] font-extrabold text-[#16231C]">
                {Number(product.quantity).toLocaleString("pt-AO")} kg disponíveis
              </Text>
            </View>

            {photos.length > 1 ? (
              <>
                <View className="absolute right-[10px] top-[10px] rounded-[6px] bg-[rgba(22,35,28,0.55)] px-[9px] py-[5px]">
                  <Text className="text-[11px] font-bold text-white">
                    {photoIndex + 1}/{photos.length}
                  </Text>
                </View>
                <View className="absolute bottom-[10px] flex-row gap-[5px] self-center">
                  {photos.map((_, i) => (
                    <View
                      key={i}
                      className={
                        i === photoIndex
                          ? "h-[5px] w-[18px] rounded-full bg-white"
                          : "h-[5px] w-[5px] rounded-full bg-[rgba(255,255,255,0.6)]"
                      }
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>

          {/* Info */}
          <View className="px-[14px] pb-[14px] pt-[14px]">
            <View className="flex-row items-center justify-between">
              <Text className="mr-[10px] shrink text-[19px] font-black tracking-tight text-[#16231C]">
                {product.product_type}
              </Text>
              <View className="flex-row items-baseline">
                <Text className="text-[18px] font-black text-[#237040]">{formatKz(product.price)}</Text>
                <Text className="text-[11.5px] font-semibold text-[#78877D]"> /kg</Text>
              </View>
            </View>

            {product.description ? (
              <Text className="mt-1.5 text-[13px] leading-[19px] text-[#78877D]" numberOfLines={3}>
                {product.description}
              </Text>
            ) : null}

            {harvest ? (
              <View className="mt-[10px] flex-row items-center gap-[6px] self-start rounded-[8px] bg-[#F1F8F3] px-[10px] py-[5px]">
                <Icon name="clock" size={13} color={COLORS.primary} />
                <Text className="text-[11.5px] font-bold text-[#4F7A5E]">Colheita prevista: {harvest}</Text>
              </View>
            ) : null}

            {/* Ações */}
            <View className="mt-[14px] flex-row items-center gap-[8px]">
              <ActionPill
                icon="heart"
                count={product.likes_count}
                active={product.is_liked}
                activeColor={COLORS.red}
                activeBg={COLORS.redSoft}
                filled={product.is_liked}
                onPress={toggleLike}
                disabled={liking}
                pop={heartPop}
              />
              <ActionPill
                icon="message"
                count={product.comments?.length ?? 0}
                active={showComments}
                activeColor={COLORS.primaryDark}
                activeBg={COLORS.tint}
                onPress={loadComments}
              />

              <ShineButton
                label="Comprar"
                icon="cart"
                height={40}
                onPress={() => onOpenPreOrder(product)}
                style={{ marginLeft: "auto" }}
              />
            </View>

            {/* Comentários */}
            {showComments ? (
              <View className="mt-[14px] pt-1">
                {(product.comments || []).length === 0 ? (
                  <Text className="mb-2 text-[12.5px] italic text-[#AEB8AC]">Sê o primeiro a comentar.</Text>
                ) : (
                  product.comments.map((c) => (
                    <View key={c.id} className="mb-[10px] flex-row items-start gap-2">
                      <Avatar uri={c.user_avatar} name={c.user_name} size={30} />
                      <View className="flex-1 rounded-[8px] bg-[#F3F6F2] px-3 py-2">
                        {c.user_name ? (
                          <Text className="text-[11.5px] font-extrabold text-[#16231C]" numberOfLines={1}>
                            {c.user_name}
                          </Text>
                        ) : null}
                        <Text className="text-[13px] text-[#16231C]">{c.comment_text}</Text>
                        <Text className="mt-px text-[10px] text-[#AEB8AC]">{timeAgo(c.created_at)}</Text>
                      </View>
                    </View>
                  ))
                )}

                <View className="mt-1 flex-row items-center gap-2">
                  <TextInput
                    className="h-10 flex-1 rounded-[10px] bg-[#F3F6F2] px-4 text-[13.5px] text-[#16231C]"
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
                  <Pressable onPress={sendComment} disabled={!canSend} style={{ opacity: canSend ? 1 : 0.45 }}>
                    <LinearGradient
                      colors={[COLORS.primaryLight, COLORS.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon name="send" size={16} color={COLORS.white} />
                    </LinearGradient>
                  </Pressable>
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