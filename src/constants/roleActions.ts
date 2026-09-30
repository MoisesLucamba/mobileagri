// constants/roleActions.ts
// REFERÊNCIA: compara com o teu ficheiro. O essencial é o normalizeRole
// cobrir todos os papéis e sinónimos, incluindo "motorista".
import type { IconName } from "../components/Icon";

export type UserRole = "agricultor" | "agente" | "comprador" | "motorista";

export type RoleAction = {
  route: string;
  icon: IconName;
  color: string;
  label: string;
};

// Sinónimos possíveis na base de dados / metadados
const ROLE_ALIASES: Record<string, UserRole> = {
  agricultor: "agricultor",
  fornecedor: "agricultor",
  produtor: "agricultor",
  farmer: "agricultor",
  supplier: "agricultor",

  agente: "agente",
  agent: "agente",
  field_agent: "agente",

  comprador: "comprador",
  buyer: "comprador",
  cliente: "comprador",

  motorista: "motorista",
  driver: "motorista",
  transportador: "motorista",
  transportadora: "motorista",
};

export function normalizeRole(raw: unknown): UserRole | null {
  if (raw == null) return null;
  const key = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
  return ROLE_ALIASES[key] ?? null;
}

// AJUSTA as rotas às que já existem na tua app
export const ROLE_ACTIONS: Record<UserRole, RoleAction> = {
  agricultor: { route: "/publicar-produto", icon: "plus", color: "#1F6B3A", label: "Publicar produto" },
  agente: { route: "/publicar-produto", icon: "plus", color: "#B7833D", label: "Registar produto" },
  comprador: { route: "/carrinho", icon: "cart", color: "#2F6DB5", label: "Carrinho" },
  motorista: { route: "/cargas", icon: "truck", color: "#1F6B3A", label: "Cargas" },
};

export const FALLBACK_ACTION: RoleAction = {
  route: "/home",
  icon: "plus",
  color: "#A3A398",
  label: "Início",
};