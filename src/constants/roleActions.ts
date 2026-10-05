// constants/roleActions.ts
// Cor uniforme para o botão central, independentemente do papel do utilizador.
import type { IconName } from "../components/Icon";

export type UserRole = "agricultor" | "agente" | "comprador" | "motorista";

export type RoleAction = {
  route: string;
  icon: IconName;
  color: string;
  label: string;
};

const ACTION_COLOR = "#1F6B3A";

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

// As rotas e os rótulos continuam específicos de cada papel; a cor é uniforme.
export const ROLE_ACTIONS: Record<UserRole, RoleAction> = {
  agricultor: { route: "/publicar-produto", icon: "plus", color: ACTION_COLOR, label: "Publicar produto" },
  agente: { route: "/publicar-produto", icon: "plus", color: ACTION_COLOR, label: "Registar produto" },
  comprador: { route: "/fichas-recebimento", icon: "file", color: ACTION_COLOR, label: "Fichas técnicas" },
  motorista: { route: "/entregas", icon: "truck", color: ACTION_COLOR, label: "Cargas" },
};

export const FALLBACK_ACTION: RoleAction = {
  route: "/home",
  icon: "plus",
  color: ACTION_COLOR,
  label: "Início",
};
