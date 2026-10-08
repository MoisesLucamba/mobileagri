import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import ProcessingScreen from "../components/ProcessingScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type ChatFile = {
  url: string;
  name: string;
  size?: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  files?: ChatFile[] | null;
};

type Conversation = {
  id: string;
  title?: string | null;
  avatar?: string | null;
  participant_id?: string | null;
  last_message?: string | null;
  last_timestamp?: string | null;
};

type SelectedFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

const BUCKET_NAME = "chatfiles";
const MAX_FILE_SIZE = 35 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 5000;

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  pale: "#EEF0E9",
  background: "#FBFAF6",
  surface: "#FFFFFF",
  text: "#3D403A",
  muted: "#77796F",
  border: "#E8E5DC",
  danger: "#B95E54",
};

const formatTime = (timestamp?: string | null) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const initials = (name?: string | null) =>
  (name || "?").trim().charAt(0).toUpperCase();

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const isConversationOpen = Boolean(conversationId);

  const loadSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      router.replace("/login");
      return null;
    }
    setUserId(data.user.id);
    return data.user.id;
  }, [router]);

  const loadConversations = useCallback(async (currentUserId: string) => {
    // Esta consulta pressupõe que a tabela conversations tem participant_id.
    // Se usares uma tabela de membros, substitui esta consulta pela tua RPC.
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_id.eq.${currentUserId},participant_id.eq.${currentUserId}`)
      .order("last_timestamp", { ascending: false });

    if (error) {
      console.error("Erro ao carregar conversas:", error);
      Alert.alert("Erro", "Não foi possível carregar as conversas.");
      return;
    }

    setConversations((data || []) as Conversation[]);
  }, []);

  const loadConversation = useCallback(
    async (id: string, currentUserId: string) => {
      setLoading(true);
      try {
        const [
          { data: conversationData, error: conversationError },
          { data, error },
        ] = await Promise.all([
          supabase.from("conversations").select("*").eq("id", id).single(),
          supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", id)
            .order("created_at", { ascending: true }),
        ]);

        if (conversationError) throw conversationError;
        if (error) throw error;

        const loadedMessages = ((data || []) as Message[]).map((message) => ({
          ...message,
          files: Array.isArray(message.files) ? message.files : [],
        }));

        setConversation(conversationData as Conversation);
        setMessages(loadedMessages);

        const unreadIds = loadedMessages
          .filter(
            (message) => message.receiver_id === currentUserId && !message.read,
          )
          .map((message) => message.id);

        if (unreadIds.length > 0) {
          await supabase
            .from("messages")
            .update({ read: true })
            .in("id", unreadIds);
        }
      } catch (error) {
        console.error("Erro ao carregar conversa:", error);
        Alert.alert("Erro", "Não foi possível carregar esta conversa.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const start = async () => {
      const currentUserId = await loadSession();
      if (!currentUserId || !active) return;

      if (conversationId) {
        await loadConversation(conversationId, currentUserId);
      } else {
        setLoading(true);
        await loadConversations(currentUserId);
        if (active) setLoading(false);
      }
    };

    start();
    return () => {
      active = false;
    };
  }, [conversationId, loadConversations, loadConversation, loadSession]);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = {
            ...(payload.new as Message),
            files: Array.isArray((payload.new as Message).files)
              ? (payload.new as Message).files
              : [],
          };

          setMessages((current) =>
            current.some((item) => item.id === message.id)
              ? current
              : [...current, message],
          );

          if (message.receiver_id === userId && !message.read) {
            supabase
              .from("messages")
              .update({ read: true })
              .eq("id", message.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  const chooseFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: "*/*",
    });

    if (result.canceled) return;

    const validFiles: SelectedFile[] = [];
    for (const file of result.assets) {
      if ((file.size || 0) > MAX_FILE_SIZE) {
        Alert.alert("Ficheiro demasiado grande", `${file.name} excede 35 MB.`);
        continue;
      }
      validFiles.push({
        uri: file.uri,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
      });
    }

    setSelectedFiles((current) => [...current, ...validFiles]);
  };

  const uploadFiles = async (currentUserId: string) => {
    const uploaded: ChatFile[] = [];

    for (const file of selectedFiles) {
      const extension = file.name.split(".").pop() || "bin";
      const path = `${currentUserId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, blob, {
          contentType: file.mimeType || "application/octet-stream",
          upsert: false,
        });

      if (error) throw error;

      // O bucket deve ser público para que esta URL seja utilizável depois.
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      uploaded.push({ url: data.publicUrl, name: file.name, size: file.size });
    }

    return uploaded;
  };

  const sendMessage = async () => {
    if (!userId || !conversationId || !conversation?.participant_id) return;
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    setSending(true);
    try {
      const uploadedFiles = await uploadFiles(userId);
      const content =
        newMessage.trim() || `📎 ${uploadedFiles.length} ficheiro(s)`;

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: conversation.participant_id,
          content: content.slice(0, MAX_MESSAGE_LENGTH),
          read: false,
          files: uploadedFiles,
        })
        .select("*")
        .single();

      if (error) throw error;

      setMessages((current) =>
        current.some((item) => item.id === data.id)
          ? current
          : [...current, data as Message],
      );
      setNewMessage("");
      setSelectedFiles([]);

      await supabase
        .from("conversations")
        .update({
          last_message: content,
          last_timestamp: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível enviar a mensagem.",
      );
    } finally {
      setSending(false);
    }
  };

  const groupedMessages = useMemo(() => messages, [messages]);

  if (loading) {
    return <ProcessingScreen />;
  }

  if (!isConversationOpen) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Mensagens</Text>
          <Ionicons
            name="chatbubbles-outline"
            size={24}
            color={COLORS.primary}
          />
        </View>

        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            conversations.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="chatbubbles-outline"
                size={52}
                color={COLORS.border}
              />
              <Text style={styles.emptyTitle}>Ainda não tens mensagens</Text>
              <Text style={styles.mutedText}>
                As conversas com compradores e vendedores aparecerão aqui.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.conversationRow}
              onPress={() =>
                router.push({ pathname: "/messages", params: { id: item.id } })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.title)}</Text>
              </View>
              <View style={styles.conversationInfo}>
                <View style={styles.conversationTopRow}>
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
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </Pressable>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>
              {initials(conversation?.title)}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conversation?.title || "Conversa"}
            </Text>
            <Text style={styles.onlineText}>Conversa</Text>
          </View>
        </View>

        <FlatList
          data={groupedMessages}
          keyExtractor={(item) => item.id}
          style={styles.flex}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const own = item.sender_id === userId;
            return (
              <View style={[styles.messageLine, own && styles.messageLineOwn]}>
                <View
                  style={[
                    styles.bubble,
                    own ? styles.ownBubble : styles.otherBubble,
                  ]}
                >
                  <Text
                    style={[styles.messageText, own && styles.ownMessageText]}
                  >
                    {item.content}
                  </Text>

                  {item.files?.map((file, index) => (
                    <Pressable
                      key={`${file.url}-${index}`}
                      style={[styles.fileRow, own && styles.ownFileRow]}
                      onPress={() => Linking.openURL(file.url)}
                    >
                      <Ionicons
                        name="document-attach-outline"
                        size={18}
                        color={own ? "#FFFFFF" : COLORS.primary}
                      />
                      <View style={styles.fileInfo}>
                        <Text
                          style={[
                            styles.fileName,
                            own && styles.ownMessageText,
                          ]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>
                        <Text
                          style={[styles.fileSize, own && styles.ownFileSize]}
                        >
                          {formatFileSize(file.size)}
                        </Text>
                      </View>
                      <Ionicons
                        name="download-outline"
                        size={17}
                        color={own ? "#FFFFFF" : COLORS.muted}
                      />
                    </Pressable>
                  ))}

                  <Text style={[styles.messageTime, own && styles.ownFileSize]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.mutedText}>Começa a conversa.</Text>
            </View>
          }
        />

        {selectedFiles.length > 0 && (
          <View style={styles.selectedFiles}>
            {selectedFiles.map((file, index) => (
              <View style={styles.selectedFile} key={`${file.uri}-${index}`}>
                <Ionicons
                  name="attach-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.selectedFileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable
                  onPress={() =>
                    setSelectedFiles((files) =>
                      files.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.danger}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.composer}>
          <Pressable
            style={styles.attachButton}
            onPress={chooseFiles}
            disabled={sending}
          >
            <Ionicons name="attach-outline" size={23} color={COLORS.primary} />
          </Pressable>
          <TextInput
            style={styles.messageInput}
            placeholder="Escreve uma mensagem..."
            placeholderTextColor={COLORS.muted}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <Pressable
            style={[styles.sendButton, sending && styles.disabled]}
            onPress={sendMessage}
            disabled={sending}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  headerInfo: { flex: 1, marginLeft: 10 },
  onlineText: { color: COLORS.primary, fontSize: 11, marginTop: 2 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: COLORS.pale,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.pale,
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.pale,
  },
  avatarText: { color: COLORS.primaryDark, fontSize: 17, fontWeight: "800" },
  list: { padding: 14 },
  emptyList: { flexGrow: 1, justifyContent: "center", padding: 24 },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  conversationInfo: { flex: 1, marginLeft: 12 },
  conversationTopRow: { flexDirection: "row", alignItems: "center" },
  conversationTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  time: { color: COLORS.muted, fontSize: 10, marginLeft: 8 },
  lastMessage: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 14,
  },
  messagesList: { padding: 14, paddingTop: 10, paddingBottom: 12 },
  messageLine: { alignItems: "flex-start", marginBottom: 8 },
  messageLineOwn: { alignItems: "flex-end" },
  bubble: { maxWidth: "84%", borderRadius: 17, padding: 12 },
  ownBubble: { backgroundColor: COLORS.primary, borderTopRightRadius: 4 },
  otherBubble: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopLeftRadius: 4,
  },
  messageText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  ownMessageText: { color: "#FFFFFF" },
  messageTime: {
    color: COLORS.muted,
    fontSize: 9,
    alignSelf: "flex-end",
    marginTop: 5,
  },
  ownFileSize: { color: "rgba(255,255,255,0.7)" },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    padding: 8,
    borderRadius: 10,
    backgroundColor: COLORS.pale,
  },
  ownFileRow: { backgroundColor: "rgba(255,255,255,0.14)" },
  fileInfo: { flex: 1, marginHorizontal: 8 },
  fileName: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  fileSize: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  selectedFiles: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedFile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 7,
    marginBottom: 5,
    borderRadius: 8,
    backgroundColor: COLORS.pale,
  },
  selectedFileName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    marginHorizontal: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachButton: {
    width: 42,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  messageInput: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 14,
    backgroundColor: COLORS.background,
  },
  sendButton: {
    width: 46,
    height: 46,
    marginLeft: 8,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  disabled: { opacity: 0.6 },
});
