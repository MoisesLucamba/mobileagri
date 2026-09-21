import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  Bell,
  Heart,
  MessageCircle,
  Package,
  Settings,
  Volume2,
  VolumeX,
  X,
  Zap,
  ArrowLeft,
} from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { T } from '../constants/theme';

/* ============================================================
   TIPOS
============================================================ */

interface NotificationItem {
  id: string;
  type: 'interest' | 'message' | 'product' | 'system';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
  user_id: string;
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: NotificationItem['type'];
}

/* ============================================================
   HELPERS
============================================================ */

const getTypeColor = (type: string) => {
  switch (type) {
    case 'interest':
      return T.g700;

    case 'message':
      return T.g900;

    case 'product':
      return T.g600;

    case 'system':
      return T.gold;

    default:
      return T.muted;
  }
};

const getTypeIcon = (
  type: string,
  size: number = 20,
  color?: string
) => {
  const iconColor = color || getTypeColor(type);

  switch (type) {
    case 'interest':
      return (
        <Heart
          size={size}
          color={iconColor}
        />
      );

    case 'message':
      return (
        <MessageCircle
          size={size}
          color={iconColor}
        />
      );

    case 'product':
      return (
        <Package
          size={size}
          color={iconColor}
        />
      );

    case 'system':
      return (
        <Zap
          size={size}
          color={iconColor}
        />
      );

    default:
      return (
        <Bell
          size={size}
          color={iconColor}
        />
      );
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const minutes = Math.floor(
    difference / 60000
  );

  const hours = Math.floor(
    difference / 3600000
  );

  const days = Math.floor(
    difference / 86400000
  );

  if (minutes < 1) {
    return 'Agora';
  }

  if (minutes < 60) {
    return String(minutes) + 'm';
  }

  if (hours < 24) {
    return String(hours) + 'h';
  }

  if (days < 7) {
    return String(days) + 'd';
  }

  return date.toLocaleDateString('pt-PT');
};

/* ============================================================
   TOAST
============================================================ */

const Toast: React.FC<{
  toast: ToastItem;
  onClose: (id: string) => void;
}> = ({
  toast,
  onClose,
}) => {
  const translateY = useRef(
    new Animated.Value(-80)
  ).current;

  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(
          Easing.cubic
        ),
        useNativeDriver: true,
      }),

      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onClose(toast.id);
      });
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [
    onClose,
    opacity,
    translateY,
    toast.id,
  ]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor:
            getTypeColor(toast.type),
          transform: [
            {
              translateY,
            },
          ],
          opacity,
        },
      ]}
    >
      <View style={styles.toastIcon}>
        {getTypeIcon(
          toast.type,
          20,
          T.white
        )}
      </View>

      <View style={styles.toastContent}>
        <Text style={styles.toastTitle}>
          {toast.title}
        </Text>

        <Text style={styles.toastMessage}>
          {toast.message}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() =>
          onClose(toast.id)
        }
        style={styles.toastClose}
      >
        <X
          size={16}
          color={T.white}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ============================================================
   NOTIFICATION ROW
============================================================ */

const NotificationRow: React.FC<{
  item: NotificationItem;
  onPress: () => void;
  onDelete: () => void;
}> = ({
  item,
  onPress,
  onDelete,
}) => {
  const unread = !item.read;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: unread
            ? T.g50
            : T.white,
          borderColor: T.rule,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: unread
              ? T.white
              : T.canvas,
          },
        ]}
      >
        {getTypeIcon(item.type)}
      </View>

      <View
        style={styles.notificationContent}
      >
        <View
          style={styles.rowBetween}
        >
          <Text
            style={[
              styles.cardTitle,
              {
                color: unread
                  ? T.ink
                  : T.mid,
              },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>

          <Text
            style={styles.cardDate}
          >
            {formatDate(
              item.created_at
            )}
          </Text>
        </View>

        <Text
          style={styles.cardMessage}
          numberOfLines={3}
        >
          {item.message}
        </Text>

        {unread && (
          <View
            style={
              styles.newBadgeRow
            }
          >
            <View
              style={styles.newDot}
            />

            <Text
              style={styles.newLabel}
            >
              Nova
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={onDelete}
        hitSlop={8}
        style={styles.deleteButton}
      >
        <X
          size={16}
          color={T.faint}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

/* ============================================================
   TELA PRINCIPAL
============================================================ */

export default function NotificationsScreen() {
  const router = useRouter();

  const [user, setUser] =
    useState<any>(null);

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItem[]>(
    []
  );

  const [toasts, setToasts] =
    useState<ToastItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    hapticsEnabled,
    setHapticsEnabled,
  ] = useState(true);

  /* ==========================================================
     AUTENTICAÇÃO
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getUser();

        if (error) {
          console.error(
            'Erro ao obter utilizador:',
            error
          );

          if (mounted) {
            setUser(null);
          }

          return;
        }

        if (mounted) {
          setUser(
            data.user || null
          );
        }
      } catch (error) {
        console.error(
          'Erro de autenticação:',
          error
        );

        if (mounted) {
          setUser(null);
        }
      }
    };

    getUser();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (mounted) {
            setUser(
              session?.user || null
            );
          }
        }
      );

    return () => {
      mounted = false;

      authListener.subscription.unsubscribe();
    };
  }, []);

  /* ==========================================================
     BUSCAR NOTIFICAÇÕES
  ========================================================== */

  const fetchNotifications =
    useCallback(async () => {
      if (!user) {
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const {
          data,
          error,
        } =
          await supabase
            .from('notifications')
            .select('*')
            .eq(
              'user_id',
              user.id
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            );

        if (error) {
          throw error;
        }

        setNotifications(
          (data || []) as NotificationItem[]
        );
      } catch (error) {
        console.error(
          'Erro ao buscar notificações:',
          error
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [user]);

  /* ==========================================================
     TOAST
  ========================================================== */

  const showToast =
    useCallback(
      (
        notification: NotificationItem
      ) => {
        const id =
          String(notification.id) +
          '-' +
          String(Date.now());

        setToasts(
          (previous) => [
            ...previous,
            {
              id,
              title:
                notification.title,
              message:
                notification.message,
              type:
                notification.type,
            },
          ]
        );

        if (hapticsEnabled) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        }
      },
      [hapticsEnabled]
    );

  const removeToast =
    useCallback(
      (id: string) => {
        setToasts(
          (previous) =>
            previous.filter(
              (toast) =>
                toast.id !== id
            )
        );
      },
      []
    );

  /* ==========================================================
     CARREGAR + REALTIME
  ========================================================== */

  useEffect(() => {
    fetchNotifications();

    if (!user) {
      return;
    }

    const channel =
      supabase
        .channel(
          'user-notifications-' +
            user.id
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter:
              'user_id=eq.' +
              user.id,
          },
          (payload) => {
            const newNotification =
              payload.new as NotificationItem;

            setNotifications(
              (previous) => [
                newNotification,
                ...previous,
              ]
            );

            showToast(
              newNotification
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    user,
    fetchNotifications,
    showToast,
  ]);

  /* ==========================================================
     REFRESH
  ========================================================== */

  const onRefresh =
    useCallback(() => {
      setRefreshing(true);
      fetchNotifications();
    }, [fetchNotifications]);

  /* ==========================================================
     MARCAR COMO LIDA
  ========================================================== */

  const markAsRead = async (
    id: string
  ) => {
    setNotifications(
      (previous) =>
        previous.map(
          (notification) =>
            notification.id === id
              ? {
                  ...notification,
                  read: true,
                }
              : notification
        )
    );

    try {
      const { error } =
        await supabase
          .from('notifications')
          .update({
            read: true,
          })
          .eq('id', id);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(
        'Erro ao marcar como lida:',
        error
      );
    }
  };

  /* ==========================================================
     MARCAR TODAS COMO LIDAS
  ========================================================== */

  const markAllAsRead =
    async () => {
      if (!user) {
        return;
      }

      setNotifications(
        (previous) =>
          previous.map(
            (notification) => ({
              ...notification,
              read: true,
            })
          )
      );

      try {
        const { error } =
          await supabase
            .from('notifications')
            .update({
              read: true,
            })
            .eq(
              'user_id',
              user.id
            )
            .eq(
              'read',
              false
            );

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error(
          'Erro ao marcar todas como lidas:',
          error
        );
      }
    };

  /* ==========================================================
     APAGAR NOTIFICAÇÃO
  ========================================================== */

  const deleteNotification =
    async (id: string) => {
      setNotifications(
        (previous) =>
          previous.filter(
            (notification) =>
              notification.id !== id
          )
      );

      try {
        const { error } =
          await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error(
          'Erro ao eliminar notificação:',
          error
        );
      }
    };

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          styles.center,
        ]}
        edges={['top']}
      >
        <ActivityIndicator
          size="large"
          color={T.g900}
        />

        <Text
          style={{
            color: T.muted,
            marginTop: 12,
          }}
        >
          Carregando notificações...
        </Text>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     SEM UTILIZADOR
  ========================================================== */

  if (!user) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          styles.center,
        ]}
        edges={['top']}
      >
        <Bell
          size={42}
          color={T.faint}
        />

        <Text
          style={styles.emptyTitle}
        >
          Sessão não encontrada
        </Text>

        <Text
          style={styles.emptySubtitle}
        >
          Inicia sessão para veres as
          tuas notificações.
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      {/* TOASTS */}

      <View
        style={styles.toastContainer}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={removeToast}
          />
        ))}
      </View>

      {/* HEADER */}

      <View style={styles.header}>
        <View
          style={styles.headerLeft}
        >
          <TouchableOpacity
            onPress={() =>
              router.back()
            }
            hitSlop={8}
            style={styles.iconBtn}
          >
            <ArrowLeft
              size={22}
              color={T.mid}
            />
          </TouchableOpacity>

          <Text
            style={styles.headerTitle}
          >
            Notificações
          </Text>

          {unreadCount > 0 && (
            <View
              style={styles.countBadge}
            >
              <Text
                style={
                  styles.countBadgeText
                }
              >
                {unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View
          style={styles.headerRight}
        >
          <TouchableOpacity
            onPress={() =>
              setHapticsEnabled(
                (value) => !value
              )
            }
            hitSlop={8}
            style={styles.iconBtn}
          >
            {hapticsEnabled ? (
              <Volume2
                size={20}
                color={T.g900}
              />
            ) : (
              <VolumeX
                size={20}
                color={T.faint}
              />
            )}
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={
                markAllAsRead
              }
              style={
                styles.markAllBtn
              }
            >
              <Text
                style={
                  styles.markAllText
                }
              >
                Marcar todas
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Settings
              size={20}
              color={T.mid}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* LISTA */}

      <FlatList
        data={notifications}
        keyExtractor={(item) =>
          item.id
        }
        contentContainerStyle={
          styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={T.g900}
          />
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={() =>
              markAsRead(item.id)
            }
            onDelete={() =>
              deleteNotification(
                item.id
              )
            }
          />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 12,
            }}
          />
        )}
        ListEmptyComponent={
          <View
            style={styles.emptyState}
          >
            <View
              style={
                styles.emptyIconWrap
              }
            >
              <Bell
                size={36}
                color={T.faint}
              />
            </View>

            <Text
              style={styles.emptyTitle}
            >
              Tudo em dia!
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              Não tens notificações novas.
              Avisaremos-te assim que
              houver novidades sobre os
              teus produtos ou mensagens.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

/* ============================================================
   ESTILOS
============================================================ */

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: T.canvas,
    },

    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: T.white,
      borderBottomWidth: 1,
      borderBottomColor: T.rule,
    },

    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },

    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: T.ink,
    },

    iconBtn: {
      padding: 6,
    },

    countBadge: {
      backgroundColor: T.g900,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 2,
    },

    countBadgeText: {
      color: T.white,
      fontSize: 12,
      fontWeight: '700',
    },

    markAllBtn: {
      paddingHorizontal: 6,
      paddingVertical: 6,
    },

    markAllText: {
      color: T.g900,
      fontSize: 12,
      fontWeight: '600',
    },

    listContent: {
      padding: 16,
      paddingBottom: 40,
      flexGrow: 1,
    },

    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
    },

    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },

    notificationContent: {
      flex: 1,
    },

    rowBetween: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },

    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
    },

    cardDate: {
      fontSize: 10,
      color: T.faint,
      fontWeight: '600',
      textTransform:
        'uppercase',
    },

    cardMessage: {
      fontSize: 13,
      color: T.muted,
      marginTop: 4,
      lineHeight: 18,
    },

    newBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },

    newDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: T.g900,
    },

    newLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: T.g900,
      textTransform:
        'uppercase',
    },

    deleteButton: {
      padding: 4,
    },

    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 24,
    },

    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: T.white,
      borderWidth: 1,
      borderColor: T.rule,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: T.ink,
    },

    emptySubtitle: {
      fontSize: 13,
      color: T.muted,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 280,
      lineHeight: 19,
    },

    backButton: {
      marginTop: 20,
      backgroundColor: T.g900,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },

    backButtonText: {
      color: T.white,
      fontSize: 14,
      fontWeight: '700',
    },

    toastContainer: {
      position: 'absolute',
      top: Platform.select({
        ios: 50,
        android: 24,
        default: 24,
      }),
      left: 16,
      right: 16,
      zIndex: 100,
      gap: 8,
    },

    toast: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowRadius: 12,
      elevation: 6,
    },

    toastIcon: {
      marginTop: 2,
    },

    toastContent: {
      flex: 1,
    },

    toastTitle: {
      color: T.white,
      fontWeight: '700',
      fontSize: 13,
    },

    toastMessage: {
      color:
        'rgba(255,255,255,0.9)',
      fontSize: 12,
      marginTop: 2,
    },

    toastClose: {
      padding: 2,
    },
  });