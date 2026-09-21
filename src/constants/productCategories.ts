export type ProductCategory = {
  id: string;
  label: string;
  color: string;
  icon: string;
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: "cereais",
    label: "Cereais",
    color: "#D97706",
    icon: "leaf-outline",
  },
  {
    id: "leguminosas",
    label: "Leguminosas",
    color: "#15803D",
    icon: "nutrition-outline",
  },
  {
    id: "horticolas",
    label: "Hortícolas",
    color: "#16A34A",
    icon: "flower-outline",
  },
  {
    id: "frutas",
    label: "Frutas",
    color: "#EA580C",
    icon: "sunny-outline",
  },
  {
    id: "tuberculos",
    label: "Tubérculos",
    color: "#92400E",
    icon: "ellipse-outline",
  },
  {
    id: "carne",
    label: "Carne",
    color: "#B91C1C",
    icon: "restaurant-outline",
  },
  {
    id: "pescado",
    label: "Pescado",
    color: "#0369A1",
    icon: "fish-outline",
  },
  {
    id: "aves",
    label: "Aves",
    color: "#7C3AED",
    icon: "paw-outline",
  },
  {
    id: "lacteos",
    label: "Lácteos",
    color: "#2563EB",
    icon: "water-outline",
  },
  {
    id: "outros",
    label: "Outros",
    color: "#6B7280",
    icon: "ellipsis-horizontal-circle-outline",
  },
];

export default PRODUCT_CATEGORIES;

// Todos os valores de `icon` são nomes válidos do Ionicons.
