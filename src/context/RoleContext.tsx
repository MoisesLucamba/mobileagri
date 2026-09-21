import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { supabase } from "../lib/supabase";
import {
  normalizeRole,
  UserRole,
} from "../constants/roleActions";

interface RoleContextValue {
  role: UserRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  loading: true,
  refresh: async () => {},
});

export function RoleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveRole = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.log(
          "[RoleContext] Erro no Auth:",
          authError.message
        );
      }

      if (!user) {
        console.log(
          "[RoleContext] Nenhum utilizador autenticado."
        );

        setRole(null);
        return;
      }

      console.log(
        "[RoleContext] ID do utilizador:",
        user.id
      );

      console.log(
        "[RoleContext] Metadata:",
        user.user_metadata
      );

      let profile: Record<string, any> | null = null;

      // PRIMEIRA TENTATIVA: procurar através da coluna id
      const profileById = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileById.error) {
        console.log(
          "[RoleContext] Erro ao procurar por id:",
          profileById.error.message
        );
      }

      profile = profileById.data;

      // SEGUNDA TENTATIVA: procurar através da coluna user_id
      if (!profile) {
        const profileByUserId = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileByUserId.error) {
          console.log(
            "[RoleContext] Erro ao procurar por user_id:",
            profileByUserId.error.message
          );
        }

        profile = profileByUserId.data;
      }

      console.log(
        "[RoleContext] Perfil encontrado:",
        profile
      );

      // Procura vários nomes possíveis de coluna
      const profileRole =
        profile?.user_type ??
        profile?.role ??
        profile?.user_role ??
        profile?.type ??
        profile?.account_type ??
        null;

      // Fallback: metadados do utilizador autenticado
      const metadataRole =
        user.user_metadata?.user_type ??
        user.user_metadata?.role ??
        user.user_metadata?.user_role ??
        user.user_metadata?.type ??
        null;

      const rawRole = profileRole ?? metadataRole;

      console.log(
        "[RoleContext] Tipo original encontrado:",
        rawRole
      );

      const normalizedRole = normalizeRole(rawRole);

      console.log(
        "[RoleContext] Tipo normalizado:",
        normalizedRole
      );

      setRole(normalizedRole);
    } catch (error) {
      console.warn(
        "[RoleContext] Falha ao resolver o tipo:",
        error
      );

      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        resolveRole();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [resolveRole]);

  return (
    <RoleContext.Provider
      value={{
        role,
        loading,
        refresh: resolveRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(RoleContext);
}