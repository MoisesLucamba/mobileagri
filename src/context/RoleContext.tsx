import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { normalizeRole, UserRole } from "../constants/roleActions";

interface RoleContextValue {
  role: UserRole | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  guestReady: boolean;
  enterGuest: () => Promise<void>;
  leaveGuest: () => Promise<void>;
  /** true só enquanto o PRIMEIRO papel de um utilizador está a ser resolvido */
  loading: boolean;
  /** volta a ler o papel sem mostrar o estado de loading */
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  isAuthenticated: false,
  isGuest: false,
  guestReady: false,
  enterGuest: async () => {},
  leaveGuest: async () => {},
  loading: true,
  refresh: async () => {},
});

export const GUEST_MODE_STORAGE_KEY = "agrilink_guest_mode";

// Colunas onde o papel pode estar guardado
const pickRole = (source?: Record<string, any> | null) => {
  if (!source) return null;

  for (const key of ["user_type", "role", "user_role", "type", "account_type"]) {
    const value = source[key];
    if (normalizeRole(value)) return value;
  }

  return null;
};

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Só a resposta do pedido mais recente é aplicada
  const requestId = useRef(0);
  // Utilizador cujo papel está atualmente em estado
  const currentUserId = useRef<string | null>(null);

  const resolveRole = useCallback(async (user: User | null) => {
    const req = ++requestId.current;

    if (!user) {
      currentUserId.current = null;
      setRole(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    setIsAuthenticated(true);
    setIsGuest(false);
    void AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY).catch((error) => {
      console.warn("[RoleContext] Não foi possível limpar o modo visitante:", error);
    });

    // Utilizador diferente: descarta o papel anterior já, para o botão
    // não mostrar a ação de outra conta.
    if (currentUserId.current !== user.id) {
      currentUserId.current = user.id;
      setRole(null);
      setLoading(true);
    }

    try {
      let profile: Record<string, any> | null = null;

      for (const table of ["users", "profiles"] as const) {
        const byId = await supabase
          .from(table)
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        profile = byId.data;

        if (!profile) {
          const byUserId = await supabase
            .from(table)
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
          profile = byUserId.data;
        }

        if (pickRole(profile)) break;
        profile = null;
      }

      if (req !== requestId.current) return; // resposta antiga

      const raw = pickRole(profile) ?? pickRole(user.user_metadata);
      setRole(normalizeRole(raw));
    } catch (error) {
      // Erro passageiro (rede): mantém o papel atual em vez de o apagar
      console.warn("[RoleContext] Falha ao resolver o papel:", error);
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([AsyncStorage.getItem(GUEST_MODE_STORAGE_KEY), supabase.auth.getSession()])
      .then(([guestValue, { data }]) => {
        if (!mounted) return;
        const user = data.session?.user ?? null;
        setIsGuest(!user && guestValue === "true");
        setGuestReady(true);
        void resolveRole(user);
      })
      .catch((error) => {
        console.warn("[RoleContext] Não foi possível restaurar a sessão:", error);
        if (mounted) {
          setIsGuest(false);
          setGuestReady(true);
          void resolveRole(null);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;

      // Não chamar o Supabase diretamente aqui dentro: pode bloquear o cliente.
      setTimeout(() => {
        if (mounted) {
          if (session?.user) {
            setIsGuest(false);
            void AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY).catch((error) => {
              console.warn("[RoleContext] Não foi possível limpar o modo visitante:", error);
            });
          } else if (event === "SIGNED_OUT") {
            setIsGuest(false);
            void AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY).catch((error) => {
              console.warn("[RoleContext] Não foi possível limpar o modo visitante:", error);
            });
          }
          resolveRole(session?.user ?? null);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveRole]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await resolveRole(data.session?.user ?? null);
  }, [resolveRole]);

  const enterGuest = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (data.session) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    await AsyncStorage.setItem(GUEST_MODE_STORAGE_KEY, "true");
    setRole(null);
    setIsAuthenticated(false);
    setIsGuest(true);
  }, []);

  const leaveGuest = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    setIsGuest(false);
  }, []);

  const value = useMemo(
    () => ({ role, isAuthenticated, isGuest, guestReady, enterGuest, leaveGuest, loading, refresh }),
    [role, isAuthenticated, isGuest, guestReady, enterGuest, leaveGuest, loading, refresh]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useUserRole() {
  return useContext(RoleContext);
}