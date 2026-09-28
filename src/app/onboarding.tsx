import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  StatusBar,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Ficheiros em: agrilink/assets/images/
const LOGO = require('../../assets/images/Agrilink_SD.png');
const IMG_INFORMAL = require('../../assets/images/agricultor.jpg');
const IMG_FORMAL = require('../../assets/images/agrilink-community-conference.jpg');

const { height } = Dimensions.get('window');
const BRAND_PRIMARY = '#1F6B3A';
const BRAND_SECONDARY = '#79C267';
const HERO_HEIGHT = height * 0.44;
const SLIDE_INTERVAL = 4500;
const FADE_DURATION = 900;

const HEROES = [
  {
    key: 'informal',
    source: IMG_INFORMAL,
    label: 'Mercado informal',
    icon: 'storefront-outline',
  },
  {
    key: 'formal',
    source: IMG_FORMAL,
    label: 'Mercado formal',
    icon: 'business-outline',
  },
] as const;

const USER_TYPES = [
  { icon: 'leaf-outline', label: 'Produtores' },
  { icon: 'briefcase-outline', label: 'Agentes' },
  { icon: 'cart-outline', label: 'Compradores' },
  { icon: 'car-outline', label: 'Motoristas' },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(1.08)).current;
  const fades = useRef(HEROES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const [active, setActive] = useState(0);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % HEROES.length), SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    zoom.setValue(1.08);
    Animated.parallel([
      ...fades.map((v, i) =>
        Animated.timing(v, {
          toValue: i === active ? 1 : 0,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }),
      ),
      Animated.timing(zoom, {
        toValue: 1,
        duration: SLIDE_INTERVAL + FADE_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, fades, zoom]);

  const sheetStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  };

  const topOffset = Math.max(insets.top, 24) + 10;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Carrossel de imagens */}
      <View style={styles.hero}>
        {HEROES.map((h, i) => (
          <Animated.View key={h.key} style={[StyleSheet.absoluteFill, { opacity: fades[i] }]}>
            <Animated.Image
              source={h.source}
              style={[styles.heroImage, { transform: [{ scale: zoom }] }]}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
            <View style={[styles.heroTag, { top: topOffset }]}>
              <Ionicons name={h.icon} size={15} color="#FFFFFF" />
              <Text style={styles.heroTagText}>{h.label}</Text>
            </View>
          </Animated.View>
        ))}

        <View style={[styles.heroDots, { top: topOffset + 6 }]}>
          {HEROES.map((h, i) => (
            <View key={h.key} style={[styles.heroDot, i === active && styles.heroDotActive]} />
          ))}
        </View>
      </View>

      {/* Painel inferior */}
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          { paddingBottom: Math.max(insets.bottom, 16) + 20 },
        ]}
      >
        <View style={styles.logoWrap}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>Do campo à sua mesa</Text>
        <Text style={styles.subtitle}>
          A AgriLink liga quem produz a quem compra, transporta e negoceia, tudo num só lugar.
        </Text>

        <View style={styles.chipsWrap}>
          {USER_TYPES.map((u) => (
            <View key={u.label} style={styles.chip}>
              <Ionicons name={u.icon} size={16} color={BRAND_PRIMARY} />
              <Text style={styles.chipText}>{u.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.ctaText}>Começar</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const LOGO_SIZE = 92;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT + 40,
    overflow: 'hidden',
    backgroundColor: '#0A2814',
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 40, 20, 0.22)' },
  heroTag: {
    position: 'absolute',
    left: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 40, 20, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroTagText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },
  heroDots: { position: 'absolute', right: 22, flexDirection: 'row', gap: 6 },
  heroDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  heroDotActive: { width: 22, backgroundColor: '#FFFFFF' },

  sheet: {
    position: 'absolute',
    top: HERO_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: LOGO_SIZE / 2 + 14,
    alignItems: 'center',
    shadowColor: '#0A2814',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },

  logoWrap: {
    position: 'absolute',
    top: -LOGO_SIZE / 2,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: `${BRAND_SECONDARY}55`,
    shadowColor: '#0A2814',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logo: { width: LOGO_SIZE - 26, height: LOGO_SIZE - 26 },

  title: { fontSize: 27, fontWeight: '800', color: '#173D24', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#627264', textAlign: 'center', marginBottom: 22 },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 'auto',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: `${BRAND_SECONDARY}25`,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#34503B' },

  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_PRIMARY,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: '#173D24',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});