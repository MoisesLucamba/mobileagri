import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import ProcessingScreen from "../components/ProcessingScreen";
import { supabase } from "../lib/supabase";

type Conversation = {
  id: string;
  title?: string | null;
  last_message?: string | null;
  last_timestamp?: string | null;
  unread_count?: number | null;
  avatar?: string | null;
  participant_id?: string | null;
};

type UserProfile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

const COLORS = {
  primary: "#1F6B3A",
  primaryDark: "#173D24",
  pale: "#EEF0E9",
  field: "#F5F3EC",
  background: "#FBFAF6",
  surface: "#FFFFFF",
  text: "#3D403A",
  muted: "#77796F",
  border: "#E8E5DC",
};

const getInitial = (name?: string | null) =>
  (name || "?").trim().charAt(0).toUpperCase();

const formatTime = (timestamp?: string | null) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
};

export default function ConversationsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newSearchTerm, setNewSearchTerm] = useState("");
  const [newConversationVisible, setNewConversationVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadConversations = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_id.eq.${currentUserId},participant_id.eq.${currentUserId}`)
      .order("last_timestamp", { ascending: false });

    if (error) {
      console.error("Erro ao carregar conversas:", error);
      return;
    }
    setConversations((data || []) as Conversation[]);
  }, []);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/login");
        return;
      }
      if (!mounted) return;
      setUserId(data.user.id);
      await loadConversations(data.user.id);
      if (mounted) setLoading(false);
    };

    start();
    return () => {
      mounted = false;
    };
  }, [loadConversations, router]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`conversations-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadConversations(userId),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations, userId]);

  useEffect(() => {
    if (!userId || !searchTerm.trim()) {
      setUserResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .ilike("full_name", `%${searchTerm.trim()}%`)
        .neq("id", userId)
        .limit(10);

      if (!error) setUserResults((data || []) as UserProfile[]);
      setSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, userId]);

  const visibleConversations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) =>
      (conversation.title || "").toLowerCase().includes(term),
    );
  }, [conversations, searchTerm]);

  const filteredUsers = useMemo(() => {
    const term = newSearchTerm.trim().toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter((user) =>
      (user.full_name || "").toLowerCase().includes(term),
    );
  }, [allUsers, newSearchTerm]);

  const openNewConversation = async () => {
    if (!userId) return;
    setNewConversationVisible(true);
    setNewSearchTerm("");

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .neq("id", userId)
      .order("full_name", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Erro ao carregar utilizadores:", error);
      return;
    }
    setAllUsers((data || []) as UserProfile[]);
  };

  const startConversation = async (profile: UserProfile) => {
    if (!userId) return;

    const { data: existing, error: searchError } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user_id.eq.${userId},participant_id.eq.${profile.id}),and(user_id.eq.${profile.id},participant_id.eq.${userId})`,
      )
      .limit(1);

    if (searchError) {
      console.error("Erro ao procurar conversa:", searchError);
      return;
    }

    let conversationId = existing?.[0]?.id;

    if (!conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          participant_id: profile.id,
          title: profile.full_name || "Conversa",
          avatar: profile.avatar_url,
          last_message: null,
          last_timestamp: new Date().toISOString(),
          unread_count: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Erro ao criar conversa:", error);
        return;
      }
      conversationId = data.id;
    }

    setNewConversationVisible(false);
    router.push({ pathname: "/messages", params: { id: conversationId } });
  };

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await loadConversations(userId);
    setRefreshing(false);
  };

  if (loading) {
    return <ProcessingScreen />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Mensagens</Text>
          <Text style={styles.subtitle}>
            {conversations.length}{" "}
            {conversations.length === 1 ? "conversa" : "conversas"}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={openNewConversation}
          accessibilityRole="button"
          accessibilityLabel="Nova conversa"
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Pesquisar conversas ou utilizadores"
          placeholderTextColor={COLORS.muted}
        />
        {!!searchTerm && !searching && (
          <Pressable
            onPress={() => setSearchTerm("")}
            accessibilityRole="button"
            accessibilityLabel="Limpar pesquisa"
          >
            <Ionicons name="close-circle" size={19} color={COLORS.muted} />
          </Pressable>
        )}
      </View>

      {userResults.length > 0 && searchTerm.trim() !== "" && (
        <View style={styles.searchResults}>
          <Text style={styles.sectionLabel}>Utilizadores</Text>
          {userResults.map((profile) => (
            <Pressable
              key={profile.id}
              style={styles.userResult}
              onPress={() => startConversation(profile)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitial(profile.full_name)}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {profile.full_name || "Utilizador"}
                </Text>
                <Text style={styles.mutedText}>Toca para iniciar conversa</Text>
              </View>
              <Ionicons
                name="person-add-outline"
                size={20}
                color={COLORS.primary}
              />
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={visibleConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          visibleConversations.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="chatbubbles-outline"
                size={28}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>Ainda não tens conversas</Text>
            <Text style={styles.mutedText}>
              Começa uma conversa para manteres o contacto com a comunidade.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
              onPress={openNewConversation}
              accessibilityRole="button"
              accessibilityLabel="Iniciar nova conversa"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyActionText}>Iniciar conversa</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.conversationRow, pressed && styles.pressedCard]}
            onPress={() =>
              router.push({ pathname: "/messages", params: { id: item.id } })
            }
          >
            <View style={styles.avatar}>
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{getInitial(item.title)}</Text>
              )}
            </View>
            <View style={styles.conversationInfo}>
              <View style={styles.topRow}>
                <Text style={styles.conversationTitle} numberOfLines={1}>
                  {item.title || "Conversa"}
                </Text>
                <Text style={styles.time}>
                  {formatTime(item.last_timestamp)}
                </Text>
              </View>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message || "Nenhuma mensagem ainda"}
              </Text>
            </View>
            {(item.unread_count || 0) > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        )}
      />

      <Modal
        visible={newConversationVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewConversationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova conversa</Text>
              <Pressable onPress={() => setNewConversationVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color={COLORS.muted} />
              <TextInput
                style={styles.searchInput}
                value={newSearchTerm}
                onChangeText={setNewSearchTerm}
                placeholder="Pesquisar utilizador"
                placeholderTextColor={COLORS.muted}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              ListEmptyComponent={
                <Text style={styles.mutedText}>
                  Nenhum utilizador encontrado.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.userResult}
                  onPress={() => startConversation(item)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitial(item.full_name)}
                    </Text>
                  </View>
                  <Text style={styles.userName}>
                    {item.full_name || "Utilizador"}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.muted}
                  />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.field,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerText: { flex: 1, marginLeft: 13 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  pressedCard: { opacity: 0.82 },
  title: { color: COLORS.text, fontSize: 23, fontWeight: "800" },
  subtitle: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.field,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14, marginLeft: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 10 },
  emptyList: { flexGrow: 1, justifyContent: "center", padding: 24 },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    shadowColor: "#343B32",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: COLORS.pale,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: "800" },
  conversationInfo: { flex: 1, marginLeft: 12 },
  topRow: { flexDirection: "row", alignItems: "center" },
  conversationTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  time: { color: COLORS.muted, fontSize: 10, marginLeft: 8 },
  lastMessage: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    backgroundColor: COLORS.primary,
  },
  unreadText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 28 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.pale,
    marginBottom: 4,
  },
  emptyAction: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  emptyActionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 14,
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  sectionLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 7,
  },
  searchResults: { paddingHorizontal: 14, marginBottom: 4 },
  userResult: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userInfo: { flex: 1, marginLeft: 10 },
  userName: { color: COLORS.text, fontSize: 14, fontWeight: "700", flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(52,59,50,0.42)",
  },
  modalCard: {
    maxHeight: "82%",
    minHeight: "55%",
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800" },
  modalList: { flex: 1 },
});
