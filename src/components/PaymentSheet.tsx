import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon, { IconName } from "./Icon";
import MapPicker, { Coords, PickedLocation } from "./MapPicker";
import {
  PAYMENT_PROVIDERS,
  STATUS_MESSAGES,
  createOrderPayment,
  effectiveStatus,
  formatDateTime,
  formatKz,
  loadProviderAvailability,
  newIdempotencyKey,
  normalizeAoPhone,
  previewPayment,
  watchPayment,
} from "../lib/payments";

const COLORS = {
  primary: "#1F6B3A",
  primaryDark: "#154D29",
  primarySoft: "#EAF3EA",
  accent: "#E2932F",
  accentSoft: "#FBF1E1",
  text: "#16231C",
  muted: "#78877D",
  faint: "#AEB8AC",
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  border: "#EAE4D6",
  red: "#DD5138",
  redSoft: "#FBECE9",
};

const MAX_SHEET_WIDTH = 560;
const STEP_LABELS = ["Dados", "Pagar", "Pronto"];
const PROCESS_STEPS = ["A validar os dados", "A contactar o operador", "A gerar a referência"];

// Ícone do método de pagamento, escolhido pelo id do provedor.
const providerIcon = (p: any): IconName =>
  /unitel|money|mobile|phone|afri/i.test(String(p?.id)) ? "smartphone" : "card";

/**
 * Props:
 * - product: linha de public.products (id, product_type, price, quantity, farmer_name)
 * - visible: controla se o sheet está aberto (sobe/desce como um elevador)
 * - onClose(): pedido para fechar (botão, fundo escuro ou arrastar para baixo)
 * - onPaid({ payment, order }): pagamento confirmado
 * - onViewHistory({ intentId, orderId }): abre o ecrã de Histórico
 */
type Props = {
  product: any;
  visible: boolean;
  onClose?: () => void;
  onPaid?: (data: { payment: any; order: any }) => void;
  onViewHistory?: (data: { intentId?: string; orderId?: string }) => void;
};

/* ============================ micro-componentes ============================ */

function PressableScale({ children, style, onPress, disabled, ...rest }: any) {
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(1)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale: sc }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function FadeSlide({ children, delay = 0, style }: any) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Field(props: any) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholderTextColor={COLORS.faint}
      style={[styles.input, focused && styles.inputFocus]}
    />
  );
}

// Valor em Kz que "conta" até ao novo total.
function AnimatedAmount({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text style={style} adjustsFontSizeToFit numberOfLines={1}>
      {formatKz(shown)}
    </Text>
  );
}

function Segment({ active }: { active: boolean }) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: active ? 1 : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active]);
  return (
    <View style={styles.segment}>
      <Animated.View
        style={[styles.segmentFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
      />
    </View>
  );
}

function StepIndicator({ index }: { index: number }) {
  return (
    <View style={styles.stepWrap}>
      <View style={styles.segRow}>
        {STEP_LABELS.map((_, i) => (
          <Segment key={i} active={i <= index} />
        ))}
      </View>
      <View style={styles.segRow}>
        {STEP_LABELS.map((label, i) => (
          <Text key={label} style={[styles.stepLabel, i === index && styles.stepLabelActive]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function MethodCard({ p, active, available, onPress }: any) {
  const check = useRef(new Animated.Value(active ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(check, { toValue: active ? 1 : 0, friction: 4, tension: 140, useNativeDriver: true }),
      Animated.spring(lift, { toValue: active ? 1 : 0, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [active]);
  return (
    <PressableScale
      disabled={!available}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled: !available }}
      style={[styles.method, active && styles.methodActive, !available && styles.methodOff]}
    >
      <Animated.View
        style={[
          styles.methodIcon,
          active && { backgroundColor: COLORS.primary },
          { transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
        ]}
      >
        <Icon name={providerIcon(p)} size={19} color={active ? "#FFFFFF" : COLORS.primary} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={styles.methodTitle}>{p.label}</Text>
        <Text style={styles.methodSub}>{available ? p.description : "Em breve"}</Text>
      </View>
      <Animated.View style={{ transform: [{ scale: check }], opacity: check }}>
        <Icon name="check-circle" size={22} color={COLORS.primary} />
      </Animated.View>
    </PressableScale>
  );
}

/* ---------------------- processamento: cena animada ---------------------- */

function ProcessingRing({ delay = 0, size = 160 }: { delay?: number; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.processingRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }],
        },
      ]}
    />
  );
}

function SpinningArc({ size = 84 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.spinningArc, { width: size, height: size, borderRadius: size / 2, transform: [{ rotate }] }]}
    />
  );
}

function Orbit({
  size,
  duration,
  count,
  dotSize,
  color,
  reverse = false,
}: {
  size: number;
  duration: number;
  count: number;
  dotSize: number;
  color: string;
  reverse?: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ["360deg", "0deg"] : ["0deg", "360deg"],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", width: size, height: size, transform: [{ rotate }] }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: size,
            height: size,
            alignItems: "center",
            transform: [{ rotate: `${(360 / count) * i}deg` }],
          }}
        >
          <View
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              opacity: 1 - i * 0.18,
            }}
          />
        </View>
      ))}
    </Animated.View>
  );
}

function ProcessingScene() {
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    bobLoop.start();
    breatheLoop.start();
    return () => {
      bobLoop.stop();
      breatheLoop.stop();
    };
  }, []);

  return (
    <Animated.View
      style={{
        alignItems: "center",
        justifyContent: "center",
        transform: [
          { scale: pop },
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
        ],
      }}
    >
      <View style={styles.processingWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
              transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }],
            },
          ]}
        />
        <ProcessingRing />
        <ProcessingRing delay={800} />
        <ProcessingRing delay={1600} />
        <Orbit size={142} duration={5200} count={3} dotSize={8} color={COLORS.accent} />
        <Orbit size={106} duration={3200} count={2} dotSize={6} color={COLORS.primary} reverse />
        <SpinningArc size={84} />
        <Animated.View
          style={[
            styles.processingCore,
            { transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) }] },
          ]}
        >
          <Icon name="shield" size={26} color="#FFFFFF" strokeWidth={2.2} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function ProcessStepRow({ label, state }: { label: string; state: "done" | "active" | "pending" }) {
  const pop = useRef(new Animated.Value(state === "done" ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.spring(pop, { toValue: state === "done" ? 1 : 0, friction: 4, tension: 150, useNativeDriver: true }).start();
  }, [state]);

  useEffect(() => {
    if (state !== "active") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  return (
    <Animated.View style={[styles.pRow, { opacity: appear }]}>
      <View style={styles.pIconBox}>
        {state === "done" ? (
          <Animated.View style={[styles.pDone, { transform: [{ scale: pop }] }]}>
            <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3.4} />
          </Animated.View>
        ) : state === "active" ? (
          <Animated.View
            style={[
              styles.pActive,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
              },
            ]}
          />
        ) : (
          <View style={styles.pPending} />
        )}
      </View>
      <Text style={[styles.pText, state === "active" && styles.pTextActive, state === "done" && styles.pTextDone]}>
        {label}
      </Text>
    </Animated.View>
  );
}

function ShimmerBar() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.shimmerTrack}>
      <Animated.View
        style={[
          styles.shimmerBar,
          { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-80, 210] }) }] },
        ]}
      />
    </View>
  );
}

function ProcessingScreen() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, PROCESS_STEPS.length - 1)), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.processingScreen}>
      <FadeSlide style={{ alignItems: "center" }}>
        <ProcessingScene />
        <Text style={styles.processingTitle}>A preparar o pagamento</Text>
        <View style={styles.pList}>
          {PROCESS_STEPS.map((label, i) => (
            <ProcessStepRow key={label} label={label} state={i < idx ? "done" : i === idx ? "active" : "pending"} />
          ))}
        </View>
        <ShimmerBar />
        <View style={styles.lockRow}>
          <Icon name="lock" size={12} color={COLORS.faint} />
          <Text style={styles.processingBody}>Ligação segura · não feches esta janela</Text>
        </View>
      </FadeSlide>
    </View>
  );
}

/* ------------------------------ resultados ------------------------------ */

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = i % 2 ? 70 : 54;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, color: i % 2 ? COLORS.accent : COLORS.primary };
});

function SuccessBurst() {
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <View style={styles.burstWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.successRing,
          {
            opacity: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] }),
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
          },
        ]}
      />
      {PARTICLES.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              opacity: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
              ],
            },
          ]}
        />
      ))}
      <Animated.View style={[styles.resultIcon, { backgroundColor: COLORS.primary, transform: [{ scale: pop }] }]}>
        <Icon name="check" size={40} color="#FFFFFF" strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

function FailIcon() {
  const pop = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start(() => {
      Animated.sequence(
        [10, -10, 8, -8, 0].map((toValue) => Animated.timing(x, { toValue, duration: 60, useNativeDriver: true })),
      ).start();
    });
  }, []);
  return (
    <Animated.View
      style={[styles.resultIcon, { backgroundColor: COLORS.redSoft, transform: [{ scale: pop }, { translateX: x }] }]}
    >
      <Icon name="close" size={40} color={COLORS.red} strokeWidth={3} />
    </Animated.View>
  );
}

function WaitingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={styles.dotsRow}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waitDot,
            {
              opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const calc = () => Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = String(Math.floor(left / 60000)).padStart(2, "0");
  const s = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  return (
    <View style={styles.countdown}>
      <Icon name="clock" size={14} color={COLORS.accent} />
      <Text style={styles.countdownText}>Expira em {m}:{s}</Text>
    </View>
  );
}

function hasAnyAvailable(availability: any, hasData: boolean) {
  if (!hasData) return true;
  return PAYMENT_PROVIDERS.some((p) => availability[p.id]?.enabled === true);
}

/* ================================ componente ================================ */

export default function PaymentSheet({ product, visible, onClose, onPaid, onViewHistory }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 360;
  const sheetWidth = Math.min(width, MAX_SHEET_WIDTH);
  const pad = compact ? 16 : 20;

  const maxQty = Math.max(1, Math.floor(Number(product?.quantity) || 1));
  const unitPrice = Number(product?.price) || 0;

  const [mounted, setMounted] = useState(visible);
  const [step, setStep] = useState("form"); // form | creating | awaiting | success | failed
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<any>({});
  const [payment, setPayment] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [isPreview, setIsPreview] = useState(false);

  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;

  const stopWatch = useRef<null | (() => void)>(null);
  const idemKey = useRef(newIdempotencyKey());
  const orderRef = useRef<any>(null);
  const closeRef = useRef<() => void>(() => {});
  const autoLoc = useRef(""); // último endereço preenchido automaticamente pelo mapa

  const provider = PAYMENT_PROVIDERS.find((p) => p.id === providerId) ?? null;
  const estimate = useMemo(() => quantity * unitPrice, [quantity, unitPrice]);
  const hasAvailabilityData = Object.keys(availability).length > 0;
  const anyAvailable = hasAnyAvailable(availability, hasAvailabilityData);
  const isAvailable = (id: string) => (hasAvailabilityData ? availability[id]?.enabled === true : true);
  const stepIndex = step === "awaiting" ? 1 : step === "success" || step === "failed" ? 2 : 0;
  const isProcessing = step === "creating";

  /* ---------- abrir / fechar (elevador) ---------- */
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setStep("form");
      setQuantity(1);
      setLocation("");
      setCoords(null);
      setPickerOpen(false);
      autoLoc.current = "";
      setProviderId(null);
      setPhone("");
      setError("");
      setPayment(null);
      setOrder(null);
      setIsPreview(false);
      orderRef.current = null;
      idemKey.current = newIdempotencyKey();

      translateY.setValue(height);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, bounciness: 6, speed: 11, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      let alive = true;
      loadProviderAvailability().then((map: any) => alive && setAvailability(map));
      return () => {
        alive = false;
      };
    }
    stopWatch.current?.();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(({ finished }) => finished && setMounted(false));
  }, [visible]);

  useEffect(() => () => stopWatch.current?.(), []);

  // Dados diferentes = pedido novo = chave de idempotência nova
  useEffect(() => {
    idemKey.current = newIdempotencyKey();
  }, [quantity, location, coords?.lat, coords?.lng, providerId, phone]);

  // Pequeno "pulso" quando o total muda
  useEffect(() => {
    Animated.sequence([
      Animated.timing(bump, { toValue: 1.08, duration: 100, useNativeDriver: true }),
      Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [estimate]);

  /* ---------- lógica ---------- */
  const changeQty = (delta: number) => setQuantity((q) => Math.min(maxQty, Math.max(1, q + delta)));

  const openPicker = () => {
    Keyboard.dismiss();
    setPickerOpen(true);
  };

  const handlePicked = ({ lat, lng, address }: PickedLocation) => {
    setCoords({ lat, lng });
    // Só preenche o texto se estiver vazio ou se o texto atual veio do mapa.
    if (address && (!location.trim() || location === autoLoc.current)) {
      setLocation(address);
      autoLoc.current = address;
    }
    setError("");
    setPickerOpen(false);
  };

  const startWatching = (intentId: string, fetcher?: any) => {
    stopWatch.current?.();
    stopWatch.current = watchPayment(intentId, {
      fetcher,
      onUpdate: (next: any) => {
        setPayment((prev: any) => ({ ...(prev ?? {}), ...next }));
        const status = effectiveStatus(next);
        if (status === "succeeded") {
          setStep("success");
          onPaid?.({ payment: next, order: orderRef.current });
        } else if (["failed", "cancelled", "expired", "refunded"].includes(status)) {
          setError(STATUS_MESSAGES[status] ?? STATUS_MESSAGES.failed);
          setStep("failed");
        }
      },
    });
  };

  const handleCreated = ({ payment: created, order: createdOrder }: any, fetcher?: any) => {
    setPayment(created);
    setOrder(createdOrder);
    orderRef.current = createdOrder;
    const status = effectiveStatus(created);
    if (status === "succeeded") {
      setStep("success");
      onPaid?.({ payment: created, order: createdOrder });
      return;
    }
    if (["failed", "cancelled", "expired"].includes(status)) {
      setError(STATUS_MESSAGES[status]);
      setStep("failed");
      return;
    }
    setStep("awaiting");
    startWatching(created.id, fetcher);
  };

  const validate = () => {
    if (location.trim().length < 3) return "Indica o local de entrega.";
    if (!coords) return "Marca o local de entrega no mapa.";
    if (!provider) return "Escolhe um método de pagamento.";
    if (provider.needsPhone && !normalizeAoPhone(phone)) {
      return "Número inválido. Usa 9 dígitos, por exemplo 923 456 789.";
    }
    return "";
  };

  const submit = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setError("");
    setStep("creating");
    try {
      const result = await createOrderPayment({
        productId: product.id,
        quantity,
        location: location.trim(),
        deliveryLat: coords!.lat,
        deliveryLng: coords!.lng,
        providerId: provider!.id,
        payerPhone: provider!.needsPhone ? normalizeAoPhone(phone) : null,
        idempotencyKey: idemKey.current,
      });
      setIsPreview(false);
      handleCreated(result);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível iniciar o pagamento.");
      setStep("form");
    }
  };

  const submitPreview = () => {
    const problem = validate();
    if (problem) return setError(problem);
    setError("");
    setIsPreview(true);
    setStep("creating");
    // Mostra a animação de processamento por instantes antes do resultado simulado.
    setTimeout(() => {
      const sim = previewPayment({ providerId: provider!.id, quantity, unitPrice });
      handleCreated({ payment: sim.payment, order: sim.order }, sim.fetcher);
    }, 3800);
  };

  const retry = () => {
    stopWatch.current?.();
    idemKey.current = newIdempotencyKey();
    setPayment(null);
    setError("");
    setStep("form");
  };

  const close = () => {
    if (step === "creating") return;
    onClose?.();
  };
  closeRef.current = close;

  const shareReference = async () => {
    const ref = payment?.reference;
    if (!ref) return;
    try {
      await Share.share({
        message: `Pagamento AgriLink\nEntidade: ${ref.entity}\nReferência: ${ref.reference}\nMontante: ${formatKz(ref.amount ?? payment.amount)}`,
      });
    } catch {
      /* cancelado */
    }
  };

  const openHistory = () => {
    onViewHistory?.({ intentId: payment?.id, orderId: order?.id });
    onClose?.();
  };

  /* ---------- arrastar para baixo (desativado durante o processamento) ---------- */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !isProcessing && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) closeRef.current();
          else Animated.spring(translateY, { toValue: 0, bounciness: 7, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [isProcessing],
  );

  if (!product) return null;

  /* ------------------------------ blocos ------------------------------ */

  const chips = [1, 5, 10, 25, 50].filter((n) => n < maxQty);
  if (maxQty > 1) chips.push(maxQty);

  const renderForm = () => (
    <>
      <FadeSlide>
        <View style={styles.productRow}>
          <View style={styles.productIcon}>
            <Icon name="leaf" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={1}>{product.product_type}</Text>
            <Text style={styles.productSub} numberOfLines={1}>
              {product.farmer_name} · {formatKz(unitPrice)}/kg
            </Text>
          </View>
        </View>
      </FadeSlide>

      <FadeSlide delay={60}>
        <Text style={styles.label}>Quantidade (kg)</Text>
        <View style={styles.qtyRow}>
          <PressableScale style={styles.qtyBtn} onPress={() => changeQty(-1)} accessibilityLabel="Diminuir">
            <Icon name="minus" size={20} color={COLORS.text} />
          </PressableScale>
          <Animated.Text style={[styles.qtyValue, { transform: [{ scale: bump }] }]}>{quantity}</Animated.Text>
          <PressableScale style={styles.qtyBtn} onPress={() => changeQty(1)} accessibilityLabel="Aumentar">
            <Icon name="plus" size={20} color={COLORS.text} />
          </PressableScale>
          <Text style={styles.qtyHint}>máx. {maxQty.toLocaleString("pt-AO")}</Text>
        </View>
        {chips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {chips.map((n) => {
              const on = quantity === n;
              return (
                <PressableScale key={n} onPress={() => setQuantity(n)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{n === maxQty ? "Máx" : `${n} kg`}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        ) : null}
      </FadeSlide>

      <FadeSlide delay={120}>
        <Text style={styles.label}>Local de entrega</Text>
        <Field
          value={location}
          onChangeText={setLocation}
          placeholder="Bairro, município, província"
          returnKeyType="search"
          onSubmitEditing={openPicker}
        />
        <PressableScale style={[styles.mapBtn, coords && styles.mapBtnOn]} onPress={openPicker}>
          <View style={[styles.mapBtnIcon, coords && styles.mapBtnIconOn]}>
            <Icon name={coords ? "check" : "pin"} size={18} color={coords ? "#FFFFFF" : COLORS.primary} strokeWidth={coords ? 3 : 2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapBtnTitle}>{coords ? "Local marcado no mapa" : "Escolher no mapa"}</Text>
            <Text style={styles.mapBtnSub} numberOfLines={1}>
              {coords
                ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} · toca para alterar`
                : "Marca ou pesquisa o local exato da entrega"}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={COLORS.faint} />
        </PressableScale>
      </FadeSlide>

      <FadeSlide delay={180}>
        <Text style={styles.label}>Como queres pagar?</Text>
        {PAYMENT_PROVIDERS.map((p) => (
          <MethodCard
            key={p.id}
            p={p}
            active={providerId === p.id}
            available={isAvailable(p.id)}
            onPress={() => setProviderId(p.id)}
          />
        ))}
      </FadeSlide>

      {provider?.needsPhone ? (
        <FadeSlide>
          <Text style={styles.label}>Telemóvel Unitel Money</Text>
          <Field
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="9__ ___ ___"
            maxLength={16}
          />
        </FadeSlide>
      ) : null}

      <FadeSlide delay={240}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total estimado</Text>
          <Animated.View style={{ transform: [{ scale: bump }] }}>
            <AnimatedAmount value={estimate} style={styles.totalValue} />
          </Animated.View>
          <View style={styles.hintRow}>
            <Icon name="shield" size={13} color={COLORS.faint} />
            <Text style={styles.totalHint}>O valor final, com transporte, é confirmado antes de pagares.</Text>
          </View>
        </View>
      </FadeSlide>

      {error ? (
        <FadeSlide key={error}>
          <Text style={styles.error}>{error}</Text>
        </FadeSlide>
      ) : null}

      <PressableScale
        style={[styles.primaryBtn, !anyAvailable && styles.btnDisabled]}
        onPress={submit}
        disabled={!anyAvailable}
      >
        <Text style={styles.primaryBtnText}>Continuar para pagamento</Text>
        <Icon name="arrow-right" size={18} color="#FFFFFF" />
      </PressableScale>

      <Pressable style={styles.linkBtn} onPress={close}>
        <Text style={[styles.linkText, { textAlign: "center" }]}>Cancelar</Text>
      </Pressable>

      {__DEV__ ? (
        <Pressable style={styles.previewBtn} onPress={submitPreview}>
          <Icon name="flask" size={14} color={COLORS.accent} />
          <Text style={styles.previewText}>Pré-visualizar fluxo (só desenvolvimento)</Text>
        </Pressable>
      ) : null}
    </>
  );

  const renderAwaiting = () => {
    const ref = payment?.reference;
    const amount = ref?.amount ?? payment?.amount ?? order?.total_price;
    return (
      <FadeSlide>
        {isPreview ? <Text style={styles.previewTag}>PRÉ-VISUALIZAÇÃO · nenhum valor real</Text> : null}
        <Text style={styles.centerTitle}>Total a pagar</Text>
        <Text style={styles.bigAmount} adjustsFontSizeToFit numberOfLines={1}>{formatKz(amount)}</Text>
        {payment?.expires_at ? <Countdown expiresAt={payment.expires_at} /> : null}

        {ref ? (
          <View style={styles.refBox}>
            <Text style={styles.refIntro}>Paga no ATM ou no Multicaixa Express com estes dados:</Text>
            <View style={styles.refLine}>
              <Text style={styles.refKey}>Entidade</Text>
              <Text style={styles.refVal}>{ref.entity}</Text>
            </View>
            <View style={styles.refLine}>
              <Text style={styles.refKey}>Referência</Text>
              <Text style={styles.refVal}>{ref.reference}</Text>
            </View>
            <View style={styles.refLine}>
              <Text style={styles.refKey}>Montante</Text>
              <Text style={styles.refVal}>{formatKz(amount)}</Text>
            </View>
            <PressableScale style={styles.secondaryBtn} onPress={shareReference}>
              <Icon name="share" size={16} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Partilhar referência</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.refBox}>
            <Text style={styles.refIntro}>
              Enviámos um pedido para o teu Unitel Money. Abre a notificação no telemóvel e confirma com o teu PIN.
            </Text>
          </View>
        )}

        <View style={styles.waitRow}>
          <WaitingDots />
        </View>
        <Text style={styles.waitText}>A aguardar confirmação…</Text>

        <PressableScale style={styles.secondaryBtn} onPress={openHistory}>
          <Text style={styles.secondaryBtnText}>Acompanhar no Histórico</Text>
        </PressableScale>
        <Pressable style={styles.linkBtn} onPress={close}>
          <Text style={[styles.linkText, { textAlign: "center" }]}>Fechar</Text>
        </Pressable>
      </FadeSlide>
    );
  };

  const renderSuccess = () => (
    <View style={styles.center}>
      <SuccessBurst />
      <FadeSlide delay={250} style={styles.centerInner}>
        <Text style={styles.centerTitle}>Pagamento confirmado</Text>
        <Text style={styles.bigAmount} adjustsFontSizeToFit numberOfLines={1}>
          {formatKz(payment?.amount ?? order?.total_price)}
        </Text>
        <Text style={styles.centerBody}>
          {isPreview ? "Simulação: nada foi cobrado." : "A tua encomenda já está registada."}
        </Text>
        <PressableScale style={styles.primaryBtn} onPress={openHistory}>
          <Text style={styles.primaryBtnText}>Ver no Histórico</Text>
        </PressableScale>
        <Pressable style={styles.linkBtn} onPress={close}>
          <Text style={[styles.linkText, { textAlign: "center" }]}>Fechar</Text>
        </Pressable>
      </FadeSlide>
    </View>
  );

  const renderFailed = () => (
    <View style={styles.center}>
      <FailIcon />
      <FadeSlide delay={200} style={styles.centerInner}>
        <Text style={styles.centerTitle}>Pagamento não concluído</Text>
        <Text style={styles.centerBody}>{error || STATUS_MESSAGES.failed}</Text>
        <PressableScale style={styles.primaryBtn} onPress={retry}>
          <Text style={styles.primaryBtnText}>Tentar novamente</Text>
        </PressableScale>
        <Pressable style={styles.linkBtn} onPress={close}>
          <Text style={[styles.linkText, { textAlign: "center" }]}>Fechar</Text>
        </Pressable>
      </FadeSlide>
    </View>
  );

  // Altura do sheet: maior e centrada durante o processamento, natural nos outros passos.
  const sheetSizeStyle = isProcessing
    ? { height: Math.min(height * 0.72, 520) }
    : { maxHeight: height * 0.92 };

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              width: sheetWidth,
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY }],
            },
            sheetSizeStyle,
          ]}
        >
          {isProcessing ? (
            <ProcessingScreen />
          ) : (
            <>
              <View {...pan.panHandlers}>
                <View style={styles.grabber} />
                <View style={[styles.header, { paddingHorizontal: pad }]}>
                  <Text style={styles.title}>Pagamento</Text>
                  <Pressable onPress={close} hitSlop={12} accessibilityLabel="Fechar" style={styles.closeBtn}>
                    <Icon name="close" size={18} color={COLORS.muted} />
                  </Pressable>
                </View>
                <View style={{ paddingHorizontal: pad }}>
                  <StepIndicator index={stepIndex} />
                </View>
              </View>

              <ScrollView
                contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {step === "form" && renderForm()}
                {step === "awaiting" && renderAwaiting()}
                {step === "success" && renderSuccess()}
                {step === "failed" && renderFailed()}
              </ScrollView>
            </>
          )}
        </Animated.View>

        <MapPicker
          visible={pickerOpen}
          initialCoords={coords}
          initialQuery={location}
          onClose={() => setPickerOpen(false)}
          onConfirm={handlePicked}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22,35,28,0.55)" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  grabber: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 },
  title: { fontSize: 19, fontWeight: "800", color: COLORS.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.canvas },

  stepWrap: { paddingBottom: 12 },
  segRow: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  segmentFill: { height: "100%", borderRadius: 2, backgroundColor: COLORS.primary },
  stepLabel: { flex: 1, marginTop: 6, fontSize: 10.5, fontWeight: "700", color: COLORS.faint },
  stepLabelActive: { color: COLORS.primary },

  productRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.border },
  productIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySoft },
  productName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  productSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  label: { fontSize: 12, fontWeight: "700", color: COLORS.muted, marginTop: 18, marginBottom: 8 },
  input: { height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, fontSize: 14.5, color: COLORS.text, backgroundColor: COLORS.surface },
  inputFocus: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },

  mapBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.canvas, marginTop: 10 },
  mapBtnOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  mapBtnIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySoft },
  mapBtnIconOn: { backgroundColor: COLORS.primary },
  mapBtnTitle: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  mapBtnSub: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  qtyBtn: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.border },
  qtyValue: { minWidth: 52, textAlign: "center", fontSize: 22, fontWeight: "900", color: COLORS.text },
  qtyHint: { fontSize: 11.5, color: COLORS.faint, marginLeft: "auto" },
  chipRow: { gap: 8, paddingTop: 12 },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.border },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12.5, fontWeight: "700", color: COLORS.text },
  chipTextOn: { color: "#FFFFFF" },

  method: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 10, backgroundColor: COLORS.surface },
  methodActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  methodOff: { opacity: 0.45 },
  methodIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySoft },
  methodTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  methodSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  totalBox: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.border },
  totalLabel: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
  totalValue: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginTop: 2 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  totalHint: { flex: 1, fontSize: 11.5, color: COLORS.faint },

  error: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: COLORS.redSoft, color: COLORS.red, fontSize: 12.5, lineHeight: 18, overflow: "hidden" },

  primaryBtn: { height: 54, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, marginTop: 18, alignSelf: "stretch", shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  btnDisabled: { opacity: 0.45 },
  secondaryBtn: { height: 46, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: COLORS.primary, marginTop: 14, alignSelf: "stretch" },
  secondaryBtnText: { color: COLORS.primary, fontSize: 13.5, fontWeight: "800" },
  linkBtn: { paddingVertical: 14, alignSelf: "stretch" },
  linkText: { color: COLORS.muted, fontSize: 13.5, fontWeight: "700" },

  previewBtn: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 12, backgroundColor: COLORS.accentSoft },
  previewText: { color: COLORS.accent, fontSize: 11.5, fontWeight: "700" },
  previewTag: { alignSelf: "center", color: COLORS.accent, fontSize: 10.5, fontWeight: "800", backgroundColor: COLORS.accentSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8, overflow: "hidden" },

  center: { alignItems: "center", paddingTop: 12 },
  centerInner: { alignItems: "center", alignSelf: "stretch" },
  centerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text, textAlign: "center", marginTop: 10 },
  centerBody: { fontSize: 13, color: COLORS.muted, textAlign: "center", lineHeight: 19, marginTop: 6 },
  bigAmount: { fontSize: 32, fontWeight: "900", color: COLORS.text, textAlign: "center", marginTop: 4 },
  resultIcon: { width: 76, height: 76, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  burstWrap: { width: 160, height: 140, alignItems: "center", justifyContent: "center" },
  particle: { position: "absolute", width: 9, height: 9, borderRadius: 5 },
  successRing: { position: "absolute", width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.primary },

  countdown: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.accentSoft },
  countdownText: { fontSize: 12, fontWeight: "800", color: COLORS.accent },

  refBox: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.border },
  refIntro: { fontSize: 13, color: COLORS.muted, lineHeight: 19, marginBottom: 6 },
  refLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  refKey: { fontSize: 12.5, color: COLORS.muted },
  refVal: { fontSize: 16, fontWeight: "900", color: COLORS.text, letterSpacing: 0.5 },

  waitRow: { alignItems: "center", marginTop: 26, marginBottom: 8 },
  waitText: { fontSize: 13, fontWeight: "700", color: COLORS.primary, textAlign: "center", marginBottom: 14 },
  dotsRow: { flexDirection: "row", gap: 7, height: 18, alignItems: "flex-end" },
  waitDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary },

  // Processamento
  processingScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  processingWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center" },
  processingRing: { position: "absolute", borderWidth: 2, borderColor: COLORS.primary },
  glow: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primarySoft },
  spinningArc: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: COLORS.primary,
    borderRightColor: COLORS.accent,
  },
  processingCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  processingTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, textAlign: "center", marginTop: 18 },
  processingBody: { fontSize: 12, color: COLORS.faint, textAlign: "center" },
  pList: { alignSelf: "stretch", marginTop: 16, gap: 10, paddingHorizontal: 24 },
  pRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pIconBox: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  pDone: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  pActive: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.accent },
  pPending: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.border },
  pText: { fontSize: 13.5, fontWeight: "600", color: COLORS.faint },
  pTextActive: { color: COLORS.text, fontWeight: "800" },
  pTextDone: { color: COLORS.muted },
  shimmerTrack: { width: 200, height: 4, borderRadius: 2, backgroundColor: COLORS.primarySoft, overflow: "hidden", marginTop: 20 },
  shimmerBar: { width: 80, height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
});