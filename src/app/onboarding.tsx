import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Leaf,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Ficheiros em: agrilink/assets/images/
const LOGO = require('../../assets/images/Agrilink_SD.png');
const IMG_INFORMAL = require('../../assets/images/agricultor.jpg');
const IMG_FORMAL = require('../../assets/images/agrilink-community-conference.jpg');

const SLIDE_INTERVAL = 5000;
const FADE_DURATION = 1000;

const COLORS = {
  primary: '#1F6B3A',
  accent: '#9BE07F',
  ink: '#08200F',
};

const HEROES = [
  { key: 'informal', source: IMG_INFORMAL, label: 'Mercado informal', Icon: Store },
  { key: 'formal', source: IMG_FORMAL, label: 'Mercado formal', Icon: Building2 },
] as const;

const USER_TYPES = [
  { Icon: Leaf, label: 'Produtores' },
  { Icon: Briefcase, label: 'Agentes' },
  { Icon: ShoppingCart, label: 'Compradores' },
  { Icon: Truck, label: 'Motoristas' },
] as const;

// ---------- Slide com fade + zoom lento ----------
function Slide({ source, isActive }: { source: any; isActive: boolean }) {
  const opacity = useSharedValue(isActive ? 1 : 0);
  const scale = useSharedValue(1.12);

  useEffect(() => {
    opacity.value = withTiming(isActive ? 1 : 0, { duration: FADE_DURATION });
    if (isActive) {
      scale.value = 1.12;
      scale.value = withTiming(1, {
        duration: SLIDE_INTERVAL + FADE_DURATION,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Image
      source={source}
      resizeMode="cover"
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

// ---------- Indicador (pílula que se expande) ----------
function Dot({ active }: { active: boolean }) {
  const w = useSharedValue(active ? 28 : 8);
  const o = useSharedValue(active ? 1 : 0.4);

  useEffect(() => {
    w.value = withTiming(active ? 28 : 8, { duration: 350 });
    o.value = withTiming(active ? 1 : 0.4, { duration: 350 });
  }, [active]);

  const style = useAnimatedStyle(() => ({ width: w.value, opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setActive((p) => (p + 1) % HEROES.length),
      SLIDE_INTERVAL,
    );
    return () => clearInterval(timer);
  }, []);

  const current = HEROES[active];
  const top = Math.max(insets.top, 24) + 8;
  const bottom = Math.max(insets.bottom, 16) + 12;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Imagens */}
      {HEROES.map((h, i) => (
        <Slide key={h.key} source={h.source} isActive={i === active} />
      ))}

      {/* Gradientes: topo suave + base forte para o texto */}
      <LinearGradient
        colors={['rgba(8,32,15,0.55)', 'rgba(8,32,15,0)']}
        style={[styles.topGradient, { height: top + 120 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(8,32,15,0)', 'rgba(8,32,15,0.82)', 'rgba(8,32,15,0.97)']}
        locations={[0, 0.45, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Barra superior */}
      <Animated.View
        entering={FadeIn.duration(700)}
        style={[styles.topBar, { top }]}
      >
        <View style={styles.logoPill}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>AgriLink</Text>
        </View>

        <Animated.View
          key={current.key}
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(300)}
          style={styles.glassPill}
        >
          <current.Icon size={14} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.glassPillText}>{current.label}</Text>
        </Animated.View>
      </Animated.View>

      {/* Conteúdo */}
      <View style={[styles.content, { paddingBottom: bottom }]}>
        <Animated.View entering={FadeInDown.delay(150).duration(700)} style={styles.dots}>
          {HEROES.map((h, i) => (
            <Dot key={h.key} active={i === active} />
          ))}
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(250).duration(700)} style={styles.title}>
          Do campo{'\n'}
          <Text style={{ color: COLORS.accent }}>à sua mesa.</Text>
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(350).duration(700)} style={styles.subtitle}>
          A AgriLink liga quem produz a quem compra, transporta e negoceia, tudo num só lugar.
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(450).duration(700)} style={styles.chips}>
          {USER_TYPES.map(({ Icon, label }) => (
            <View key={label} style={styles.chip}>
              <Icon size={14} color={COLORS.accent} strokeWidth={2.2} />
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(550).duration(700)} style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.9}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.primaryBtnText}>Começar</Text>
            <View style={styles.arrowCircle}>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.secondaryText}>
              Ainda não tem conta? <Text style={styles.secondaryLink}>Criar conta</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '68%' },

  topBar: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
  },
  logo: { width: 26, height: 26 },
  brand: { fontSize: 14, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.2 },

  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  glassPillText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  dot: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },

  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 15.5,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.78)',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  actions: { marginTop: 30 },
  primaryBtn: {
    height: 60,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 28,
    paddingRight: 8,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryBtn: { alignItems: 'center', paddingVertical: 16 },
  secondaryText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  secondaryLink: { color: '#FFFFFF', fontWeight: '800' },
});