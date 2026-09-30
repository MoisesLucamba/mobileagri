import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { normalizeRole, UserRole } from "../constants/roleActions";

interface RoleContextValue {
  role: UserRole | null;
  isAuthenticated: boolean;
  /** true só enquanto o PRIMEIRO papel de um utilizador está a ser resolvido */
  loading: boolean;
  /** volta a ler o papel sem mostrar o estado de loading */
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  isAuthenticated: false,
  loading: true,
  refresh: async () => {},
});

// Colunas onde o papel pode estar guardado
const pickRole = (source?: Record<string, any> | null) =>
  source?.user_type ??
  source?.role ??
  source?.user_role ??
  source?.type ??
  source?.account_type ??
  null;

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

    // Utilizador diferente: descarta o papel anterior já, para o botão
    // não mostrar a ação de outra conta.
    if (currentUserId.current !== user.id) {
      currentUserId.current = user.id;
      setRole(null);
      setLoading(true);
    }

    try {
      let profile: Record<string, any> | null = null;

      const byId = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      profile = byId.data;

      if (!profile) {
        const byUserId = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        profile = byUserId.data;
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

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) resolveRole(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;

      // Não chamar o Supabase diretamente aqui dentro: pode bloquear o cliente.
      setTimeout(() => {
        if (mounted) resolveRole(session?.user ?? null);
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

  const value = useMemo(
    () => ({ role, isAuthenticated, loading, refresh }),
    [role, isAuthenticated, loading, refresh]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useUserRole() {
  return useContext(RoleContext);
}