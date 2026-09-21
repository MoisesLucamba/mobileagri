import { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type UserRole =
  | "agricultor"
  | "agente"
  | "comprador"
  | "motorista";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface RoleAction {
  route: string;
  label: string;
  icon: IconName;
  color: string;
}

export const ROLE_ACTIONS: Record<UserRole, RoleAction> = {
  agricultor: {
    route: "/publicar-produto",
    label: "Publicar",
    icon: "add-circle-outline",
    color: "#1F6B3A",
  },

  agente: {
    route: "/sourcing",
    label: "Sourcing",
    icon: "search-outline",
    color: "#C17A20",
  },

  comprador: {
    route: "/encomendas",
    label: "Comprar",
    icon: "cart-outline",
    color: "#2563EB",
  },

  motorista: {
    route: "/entregas",
    label: "Entregas",
    icon: "car-outline",
    color: "#7C3AED",
  },
};

export const FALLBACK_ACTION: RoleAction = {
  route: "/profile",
  label: "Perfil",
  icon: "person-outline",
  color: "#6B7280",
};

export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.toLowerCase().trim();

  const aliases: Record<string, UserRole> = {
    agricultor: "agricultor",
    agricultora: "agricultor",
    farmer: "agricultor",

    agente: "agente",
    agent: "agente",

    comprador: "comprador",
    compradora: "comprador",
    buyer: "comprador",

    motorista: "motorista",
    driver: "motorista",
    transportador: "motorista",
  };

  return aliases[role] ?? null;
}