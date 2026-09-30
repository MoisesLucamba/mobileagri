import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon, { IconName } from '../components/Icon';

// Ficheiros em: agrilink/assets/images/
const LOGO = require('../../assets/images/Agrilink_SD.png');
const IMG_INFORMAL = require('../../assets/images/agricultor.jpg');
const IMG_FORMAL = require('../../assets/images/agrilink-community-conference.jpg');

const SLIDE_INTERVAL = 5500;
const FADE_DURATION = 1000;

const COLORS = {
  primary: '#1F6B3A',
  accent: '#9BE07F',
  ink: '#08200F',
  cream: '#FBFAF6',
};

const HEROES: {
  key: string;
  source: any;
  label: string;
  icon: IconName;
  line1: string;
  line2: string;
  subtitle: string;
}[] = [
  {
    key: 'informal',
    source: IMG_INFORMAL,
    label: 'Mercado informal',
    icon: 'pin',
    line1: 'Conecta-te',
    line2: 'ao mercado.',
    subtitle: 'Venda a colheita e encontre compradores perto de si, sem intermediários a mais.',
  },
  {
    key: 'formal',
    source: IMG_FORMAL,
    label: 'Mercado formal',
    icon: 'file',
    line1: 'Negócios',
    line2: 'com confiança.',
    subtitle: 'Contratos, volumes e entregas combinados com empresas, num só lugar.',
  },
];

// A jornada do produto: quem participa na cadeia
const JOURNEY: { icon: IconName; label: string }[] = [
  { icon: 'leaf', label: 'Produtor' },
  { icon: 'users', label: 'Agente' },
  { icon: 'truck', label: 'Motorista' },
  { icon: 'cart', label: 'Comprador' },
];

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

  return <Animated.Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, style]} />;
}

// ---------- Barra de progresso estilo "stories" ----------
function StoryBar({ status }: { status: 'done' | 'active' | 'idle' }) {
  const w = useSharedValue(status === 'done' ? 100 : 0);

  useEffect(() => {
    if (status === 'active') {
      w.value = 0;
      w.value = withTiming(100, { duration: SLIDE_INTERVAL, easing: Easing.linear });
    } else {
      w.value = withTiming(status === 'done' ? 100 : 0, { duration: 250 });
    }
  }, [status]);

  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View style={styles.storyTrack}>
      <Animated.View style={[styles.storyFill, fill]} />
    </View>
  );
}

// ---------- Nó da jornada ----------
function JourneyNode({ icon, label, lit, current }: { icon: IconName; label: string; lit: boolean; current: boolean }) {
  const s = useSharedValue(1);

  useEffect(() => {
    s.value = current
      ? withSequence(withTiming(1.18, { duration: 220 }), withTiming(1, { duration: 260 }))
      : 1;
  }, [current]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <View style={styles.node}>
      <Animated.View style={[styles.nodeCircle, lit && styles.nodeCircleLit, style]}>
        <Icon name={icon} size={19} color={lit ? COLORS.ink : 'rgba(255,255,255,0.75)'} />
      </Animated.View>
      <Text style={[styles.nodeLabel, lit && styles.nodeLabelLit]}>{label}</Text>
    </View>
  );
}

// ---------- Cartão de vidro com a rota animada ----------
function JourneyCard() {
  const [step, setStep] = useState(0);
  const line = useSharedValue(0);
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    const t = setInterval(() => setStep((p) => (p + 1) % JOURNEY.length), 1300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    line.value = withTiming(step / (JOURNEY.length - 1), {
      duration: step === 0 ? 350 : 900,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [step]);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.5, { duration: 900 })), -1);
  }, []);

  const lineStyle = useAnimatedStyle(() => ({ width: `${line.value * 100}%` }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.journeyCard}>
      <View style={styles.journeyHead}>
        <Animated.View style={[styles.liveDot, glowStyle]} />
        <Text style={styles.journeyTitle}>A cadeia, ligada em tempo real</Text>
      </View>

      <View style={styles.journeyRow}>
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, lineStyle]} />
          </View>
        </View>
        {JOURNEY.map((j, i) => (
          <JourneyNode key={j.label} icon={j.icon} label={j.label} lit={i <= step} current={i === step} />
        ))}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % HEROES.length), SLIDE_INTERVAL);
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

      {/* Gradientes */}
      <LinearGradient
        colors={['rgba(8,32,15,0.6)', 'rgba(8,32,15,0)']}
        style={[styles.topGradient, { height: top + 130 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(8,32,15,0)', 'rgba(8,32,15,0.86)', 'rgba(8,32,15,0.98)']}
        locations={[0, 0.42, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Barra superior */}
      <Animated.View entering={FadeIn.duration(700)} style={[styles.topBlock, { top }]}>
        <View style={styles.storyRow}>
          {HEROES.map((h, i) => (
            <StoryBar key={h.key} status={i < active ? 'done' : i === active ? 'active' : 'idle'} />
          ))}
        </View>

        <View style={styles.topBar}>
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
            <Icon name={current.icon} size={14} color="#FFFFFF" />
            <Text style={styles.glassPillText}>{current.label}</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Conteúdo */}
      <View style={[styles.content, { paddingBottom: bottom }]}>
        <Animated.View key={current.key} entering={FadeInDown.duration(600)} exiting={FadeOut.duration(200)}>
          <Text style={styles.title}>
            {current.line1}
            {'\n'}
            <Text style={{ color: COLORS.accent }}>{current.line2}</Text>
          </Text>
          <Text style={styles.subtitle}>{current.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(700)}>
          <JourneyCard />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(550).duration(700)} style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.9}
            onPress={() => router.replace('/login')}
            accessibilityRole="button"
            accessibilityLabel="Começar"
          >
            <Text style={styles.primaryBtnText}>Começar</Text>
            <View style={styles.arrowCircle}>
              <Icon name="arrow-right" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={() => router.push('/register')}>
            <Text style={styles.secondaryText}>
              Ainda não tem conta? <Text style={styles.secondaryLink}>Criar conta</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            Ao continuar, aceita os{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/termos')}>
              Termos
            </Text>{' '}
            e a{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/privacidade')}>
              Política de Privacidade
            </Text>
            .
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%' },

  topBlock: { position: 'absolute', left: 22, right: 22, gap: 14 },
  storyRow: { flexDirection: 'row', gap: 6 },
  storyTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  storyFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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

  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24 },

  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 12,
    minHeight: 46,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
  },

  journeyCard: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  journeyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  journeyTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },

  journeyRow: { flexDirection: 'row', position: 'relative' },
  trackWrap: { position: 'absolute', left: '12.5%', right: '12.5%', top: 21 },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },

  node: { flex: 1, alignItems: 'center', gap: 8 },
  nodeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCircleLit: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  nodeLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  nodeLabelLit: { color: '#FFFFFF' },

  actions: { marginTop: 22 },
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

  secondaryBtn: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  secondaryLink: { color: '#FFFFFF', fontWeight: '800' },

  legal: { fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  legalLink: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', textDecorationLine: 'underline' },
});