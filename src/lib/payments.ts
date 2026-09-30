import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";

export const PAYMENT_PROVIDERS = [
  {
    id: "multicaixa_reference", // tem de existir em public.payment_providers
    label: "Referência Multicaixa",
    description: "Paga no ATM ou no Multicaixa Express",
    needsPhone: false,
  },
  {
    id: "unitel_money",
    label: "Unitel Money",
    description: "Confirma com o PIN no telemóvel",
    needsPhone: true,
  },
];

export const STATUS_MESSAGES: Record<string, string> = {
  failed: "O pagamento falhou. Tenta novamente.",
  cancelled: "O pagamento foi cancelado.",
  expired: "O tempo para pagar expirou.",
  refunded: "Este pagamento foi reembolsado.",
};

export const newIdempotencyKey = () => Crypto.randomUUID();

export const formatKz = (v: any) =>
  `${Number(v ?? 0).toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });

export function normalizeAoPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^244/, "");
  return /^9\d{8}$/.test(digits) ? digits : null;
}

export function effectiveStatus(p: any): string {
  if (!p) return "created";
  if (["pending", "processing", "created"].includes(p.status) &&
      p.expires_at && new Date(p.expires_at) < new Date()) return "expired";
  return p.status;
}

export async function loadProviderAvailability() {
  const { data } = await supabase.from("payment_providers").select("id, enabled");
  return Object.fromEntries((data ?? []).map((r) => [r.id, { enabled: r.enabled }]));
}

export async function createOrderPayment(args: {
  productId: string;
  quantity: number;
  location: string;
  deliveryLat: number;
  deliveryLng: number;
  providerId: string;
  payerPhone: string | null;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.functions.invoke("create-order-payment", {
    body: {
      product_id: args.productId,
      quantity: args.quantity,
      location: args.location,
      delivery_lat: args.deliveryLat,
      delivery_lng: args.deliveryLng,
      provider_id: args.providerId,
      payer_phone: args.payerPhone,
      idempotency_key: args.idempotencyKey,
    },
  });
  if (error) throw new Error("Não foi possível iniciar o pagamento. Tenta novamente.");
  return { payment: data.payment, order: data.order };
}

const fetchIntent = async (id: string) => {
  const { data } = await supabase.from("payment_intents").select("*").eq("id", id).single();
  return data;
};

export function watchPayment(
  intentId: string,
  { fetcher = fetchIntent, onUpdate, intervalMs = 3000 }: any,
) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const next = await fetcher(intentId);
      if (next && !stopped) {
        onUpdate(next);
        const s = effectiveStatus(next);
        if (["succeeded", "failed", "cancelled", "expired", "refunded"].includes(s)) return;
      }
    } catch {}
    setTimeout(tick, intervalMs);
  };
  tick();
  return () => { stopped = true; };
}

// Só para __DEV__
export function previewPayment({ providerId, quantity, unitPrice }: any) {
  const amount = quantity * unitPrice;
  const id = "preview-" + Date.now();
  const payment = {
    id, status: "pending", amount,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    reference: providerId === "unitel_money" ? null
      : { entity: "00000", reference: "123 456 789", amount },
  };
  const t0 = Date.now();
  const fetcher = async () => ({
    ...payment, status: Date.now() - t0 > 6000 ? "succeeded" : "pending",
  });
  return { payment, order: { id: "preview-order", total_price: amount }, fetcher };
}