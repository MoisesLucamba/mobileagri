import { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import { COLORS, SHADOW } from "./ui";
import { supabase } from "../lib/supabase";

type ConnectionProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

const AVATAR_SIZE = 38;

export default function UserConnectionsSummary({
  userId,
  enabled,
}: {
  userId: string | null;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [failedAvatarIds, setFailedAvatarIds] = useState<string[]>([]);

  const loadConnections = useCallback(async () => {
    if (!enabled || !userId) return;

    const { data: connections, count: connectionCount, error } = await supabase
      .from("user_connections")
      .select("connected_user_id", { count: "exact" })
      .eq("viewer_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.warn("[UserConnectionsSummary] Não foi possível carregar as ligações:", error);
      return;
    }

    const connectedIds = (connections ?? []).map((connection) => connection.connected_user_id);
    setCount(connectionCount ?? connectedIds.length);
    if (connectedIds.length === 0) {
      setProfiles([]);
      return;
    }

    const { data, error: profilesError } = await supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", connectedIds);

    if (profilesError) {
      console.warn("[UserConnectionsSummary] Não foi possível carregar os perfis ligados:", profilesError);
      return;
    }

    const profilesById = new Map((data ?? []).map((profile) => [profile.id, profile]));
    setProfiles(
      connectedIds
        .map((connectedId) => profilesById.get(connectedId))
        .filter((profile): profile is ConnectionProfile => !!profile),
    );
  }, [enabled, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadConnections();
    }, [loadConnections]),
  );

  if (!enabled || !userId) return null;

  const extraCount = Math.max(count - profiles.length, 0);

  return (
    <View
      style={SHADOW.tiny}
      className="mx-4 mb-4 flex-row items-center rounded-[18px] bg-white px-4 py-3.5"
    >
      {profiles.length > 0 ? (
        <View className="mr-3.5 flex-row items-center">
          {profiles.map((profile, index) => (
            <Pressable
              key={profile.id}
              accessibilityRole="button"
              accessibilityLabel={profile.full_name || t("home.unknownUserType")}
              onPress={() => router.push(`/profile/${profile.id}`)}
              style={{ marginLeft: index === 0 ? 0 : -12, zIndex: profiles.length - index }}
            >
              {profile.avatar_url && !failedAvatarIds.includes(profile.id) ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  onError={() => setFailedAvatarIds((current) => [...current, profile.id])}
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  className="rounded-full border-[2.5px] border-white bg-[#EAF5ED]"
                />
              ) : (
                <View
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  className="items-center justify-center rounded-full border-[2.5px] border-white bg-[#EAF5ED]"
                >
                  <Text className="text-[13px] font-black text-[#218B4A]">
                    {profile.full_name?.trim().slice(0, 1).toUpperCase() || "?"}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
          {extraCount > 0 ? (
            <View
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, marginLeft: -12, zIndex: 0 }}
              className="items-center justify-center rounded-full border-[2.5px] border-white bg-[#218B4A]"
            >
              <Text className="text-[11px] font-extrabold text-white">+{extraCount}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="mr-3.5 h-[38px] w-[38px] items-center justify-center rounded-full bg-[#EAF5ED]">
          <Icon name="users" size={18} color={COLORS.primary} />
        </View>
      )}

      <View className="flex-1">
        <Text numberOfLines={1} className="text-[14px] font-extrabold text-[#16231C]">
          {t(count === 1 ? "home.connectionCountOne" : "home.connectionCountOther", { count })}
        </Text>
        <Text numberOfLines={2} className="mt-0.5 text-[11.5px] leading-4 text-[#78877D]">
          {t("home.connectionSummaryDescription")}
        </Text>
      </View>
    </View>
  );
}