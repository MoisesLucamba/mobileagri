import { useCallback, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import { COLORS, SHADOW } from "./ui";
import { supabase } from "../lib/supabase";

type SuggestedUser = {
  id: string;
  full_name: string | null;
  user_type: string | null;
  avatar_url: string | null;
};

type Props = {
  viewerId: string;
  onConnectionsChange: (userIds: string[]) => void;
};

const CARD_WIDTH = 164;
const CARD_HEIGHT = 160;
const CARD_PADDING = 12;
const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 40;
const AVATAR_SIZE = 48;

export default function UserConnections({ viewerId, onConnectionsChange }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [failedAvatarIds, setFailedAvatarIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const [usersResult, connectionsResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, user_type, avatar_url")
        .neq("id", viewerId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("user_connections")
        .select("connected_user_id")
        .eq("viewer_id", viewerId),
    ]);

    if (usersResult.error || connectionsResult.error) {
      const error = usersResult.error ?? connectionsResult.error;
      console.warn("[UserConnections] Não foi possível carregar sugestões:", error);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const suggestions = (usersResult.data ?? [])
      .filter((user) => typeof user.full_name === "string" && user.full_name.trim().length > 0)
      .map((user) => ({
        id: user.id,
        full_name: user.full_name,
        user_type: user.user_type,
        avatar_url: user.avatar_url,
      }));
    const ids = (connectionsResult.data ?? []).map((connection) => connection.connected_user_id);
    suggestions.sort(
      (first, second) =>
        Number(ids.includes(first.id)) - Number(ids.includes(second.id)),
    );

    setUsers(suggestions);
    setConnectedIds(ids);
    onConnectionsChange(ids);
    setLoading(false);
  }, [onConnectionsChange, viewerId]);

  useFocusEffect(
    useCallback(() => {
      void loadSuggestions();
    }, [loadSuggestions]),
  );

  const toggleConnection = async (user: SuggestedUser) => {
    if (busyIds.includes(user.id)) return;

    setBusyIds((current) => [...current, user.id]);
    const isConnected = connectedIds.includes(user.id);
    const result = isConnected
      ? await supabase
          .from("user_connections")
          .delete()
          .eq("viewer_id", viewerId)
          .eq("connected_user_id", user.id)
      : await supabase.from("user_connections").insert({
          viewer_id: viewerId,
          connected_user_id: user.id,
        });

    if (result.error) {
      console.warn("[UserConnections] Não foi possível atualizar a ligação:", result.error);
      Alert.alert(t("home.connectionsErrorTitle"), t("home.connectionsActionError"));
      setBusyIds((current) => current.filter((id) => id !== user.id));
      return;
    }

    const nextIds = isConnected
      ? connectedIds.filter((id) => id !== user.id)
      : [...connectedIds, user.id];
    setConnectedIds(nextIds);
    onConnectionsChange(nextIds);
    setBusyIds((current) => current.filter((id) => id !== user.id));
  };

  const visibleUsers = users.filter((user) => !dismissedIds.includes(user.id));

  return (
    <View style={{ marginTop: 4, marginBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
        <View
          style={{
            width: 28,
            height: 28,
            marginRight: 10,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            backgroundColor: COLORS.tint,
          }}
        >
          <Icon name="users" size={14} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
            {t("home.connectUsers")}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: COLORS.muted }}>
            {t("home.connectUsersDescription")}
          </Text>
        </View>
      </View>

      {loading ? (
        <ScrollView
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          style={{ height: CARD_HEIGHT + 16, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 10 }}
        >
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              style={[
                { width: CARD_WIDTH, padding: CARD_PADDING, borderRadius: 16, backgroundColor: COLORS.white },
                SHADOW.tiny,
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: COLORS.line }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <View style={{ height: 10, width: "80%", borderRadius: 5, backgroundColor: COLORS.line }} />
                  <View style={{ height: 8, width: "50%", marginTop: 6, borderRadius: 4, backgroundColor: COLORS.bg }} />
                </View>
              </View>
              <View style={{ height: BUTTON_HEIGHT, width: BUTTON_WIDTH, marginTop: 10, borderRadius: 20, backgroundColor: COLORS.line }} />
            </View>
          ))}
        </ScrollView>
      ) : loadError ? (
        <Pressable
          onPress={() => void loadSuggestions()}
          style={[
            { marginHorizontal: 16, marginVertical: 8, padding: 12, alignItems: "center", borderRadius: 14, backgroundColor: COLORS.white },
            SHADOW.tiny,
          ]}
        >
          <Text style={{ fontSize: 12, color: COLORS.muted }}>{t("home.connectionsLoadError")}</Text>
          <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "800", color: COLORS.primary }}>
            {t("home.retryConnections")}
          </Text>
        </Pressable>
      ) : visibleUsers.length === 0 ? (
        <View
          style={[
            { marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 14, backgroundColor: COLORS.white },
            SHADOW.tiny,
          ]}
        >
          <Text style={{ fontSize: 12, color: COLORS.muted }}>{t("home.noUsersToConnect")}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          style={{ height: CARD_HEIGHT + 16, flexGrow: 0 }}
          contentContainerStyle={{ height: CARD_HEIGHT + 16, paddingHorizontal: 16, paddingVertical: 8, gap: 10 }}
        >
          {visibleUsers.map((user) => {
            const isConnected = connectedIds.includes(user.id);
            const isBusy = busyIds.includes(user.id);
            const userType = user.user_type?.toLowerCase() || "";
            const connectionLabel = isBusy
              ? t("home.savingConnection")
              : t(isConnected ? "home.following" : "home.follow");

            return (
              <View
                key={user.id}
                style={[
                  {
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    padding: CARD_PADDING,
                    alignItems: "center",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: COLORS.line,
                    backgroundColor: COLORS.white,
                  },
                  SHADOW.tiny,
                ]}
              >
                <Pressable
                  onPress={() => setDismissedIds((current) => [...current, user.id])}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.dismiss", { defaultValue: "Dispensar" })}
                  style={{ position: "absolute", right: 5, top: 3, zIndex: 1, width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 16, lineHeight: 18, color: COLORS.faint }}>×</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push({ pathname: "/profile/[id]", params: { id: user.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={user.full_name || t("home.unknownUserType")}
                  style={{ width: "100%", alignItems: "center" }}
                >
                  <View
                    style={{
                      width: AVATAR_SIZE,
                      height: AVATAR_SIZE,
                      marginBottom: 7,
                      borderRadius: AVATAR_SIZE / 2,
                      borderWidth: 2,
                      borderColor: COLORS.primary,
                      padding: 2,
                      backgroundColor: COLORS.white,
                    }}
                  >
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 24, backgroundColor: COLORS.tint }}>
                      {user.avatar_url && !failedAvatarIds.includes(user.id) ? (
                        <Image
                          source={{ uri: user.avatar_url }}
                          onError={() => setFailedAvatarIds((current) => [...current, user.id])}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ fontSize: 17, fontWeight: "900", color: COLORS.primary }}>
                          {user.full_name?.trim().slice(0, 1).toUpperCase() || "?"}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ width: "100%", textAlign: "center", fontSize: 12, fontWeight: "800", color: COLORS.text }}>
                    {user.full_name}
                  </Text>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ width: "100%", marginTop: 2, textAlign: "center", fontSize: 10, color: COLORS.muted }}>
                    {userType
                      ? t(`home.userTypes.${userType}`, { defaultValue: t("home.unknownUserType") })
                      : t("home.unknownUserType")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(isConnected ? "home.following" : "home.follow")}
                  accessibilityState={{ disabled: isBusy, selected: isConnected, busy: isBusy }}
                  disabled={isBusy}
                  onPress={() => void toggleConnection(user)}
                  hitSlop={2}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={({ pressed }) => ({
                    width: BUTTON_WIDTH,
                    height: BUTTON_HEIGHT,
                    marginTop: "auto",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 20,
                    backgroundColor: COLORS.primary,
                    opacity: pressed || isBusy ? 0.78 : 1,
                  })}
                >
                  <Icon
                    name={isConnected ? "check" : "plus"}
                    size={14}
                    color={COLORS.white}
                  />
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      flexShrink: 1,
                      fontSize: 12,
                      fontWeight: "800",
                      color: COLORS.white,
                    }}
                  >
                    {connectionLabel}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}