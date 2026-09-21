// app/onboarding.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  StatusBar,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import Logo from '../assets/images/logo.jpeg';

const { width } = Dimensions.get('window');
const BRAND_PRIMARY = '#1F6B3A';
const BRAND_SECONDARY = '#79C267';

interface Slide {
  key: string;
  icon: string;
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  colors: [string, string];
}

const SLIDES: Slide[] = [
  {
    key: 'intro',
    icon: 'leaf',
    badge: 'Bem-vindo',
    title: 'Do campo à sua mesa,\nsem intermediários',
    description:
      'A AgriLink liga quem produz a quem compra, transporta e negoceia — tudo num só lugar.',
    bullets: [
      'Marketplace agrícola 100% angolano',
      'Preços justos e negociação directa',
      'Feito para quatro tipos de utilizador',
    ],
    colors: ['#1F6B3A', '#79C267'],
  },
  {
    key: 'agricultor',
    icon: 'flower-outline',
    badge: 'Para agricultores',
    title: 'Venda a sua colheita\nao preço certo',
    description:
      'Publique produtos, defina preços e receba pedidos diretamente de compradores e agentes.',
    bullets: [
      'Publicação de produtos com fotos e localização',
      'Acompanhe pedidos em tempo real',
      'Escolha como quer entregar a mercadoria',
    ],
    colors: ['#1F6B3A', '#3E9C55'],
  },
  {
    key: 'agente',
    icon: 'search-outline',
    badge: 'Para agentes',
    title: 'Encontre e negoceie\nem nome de quem representa',
    description:
      'Faça sourcing de produtos para os seus clientes e feche negócios com produtores verificados.',
    bullets: [
      'Pesquisa avançada por região e produto',
      'Ferramentas de negociação e follow-up',
      'Comissões transparentes por negócio fechado',
    ],
    colors: ['#B5670F', '#E0A23D'],
  },
  {
    key: 'comprador',
    icon: 'cart-outline',
    badge: 'Para compradores',
    title: 'Compre com garantia\nde qualidade',
    description:
      'Crie fichas técnicas de recebimento e receba apenas produtos que cumprem os seus critérios.',
    bullets: [
      'Fichas técnicas personalizadas por produto',
      'Verificação automática antes da entrega',
      'Histórico de fornecedores de confiança',
    ],
    colors: ['#1D4ED8', '#60A5FA'],
  },
  {
    key: 'motorista',
    icon: 'truck-outline',
    badge: 'Para motoristas',
    title: 'Transporte cargas\ne rentabilize a sua viagem',
    description:
      'Veja oportunidades de frete compatíveis com a sua capacidade e aceite com um toque.',
    bullets: [
      'Cargas filtradas pela sua capacidade',
      'Rota de origem e destino sempre visível',
      'Actualize o estado da entrega em tempo real',
    ],
    colors: ['#6D28D9', '#A78BFA'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<Animated.FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const finish = () => router.replace('/login');
  const goToIndex = (i: number) => listRef.current?.scrollToIndex({ index: i, animated: true });

  const onMomentumScrollEnd = (event: any) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        renderItem={({ item }) => <Slide slide={item} />}
      />

      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={finish} activeOpacity={0.7}>
          <Text style={styles.skipText}>Saltar</Text>
          <Ionicons name="play-skip-forward" size={13} color="#607064" />
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />;
          })}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: BRAND_PRIMARY }]}
          activeOpacity={0.85}
          onPress={() => (isLast ? finish() : goToIndex(index + 1))}
        >
          <Text style={styles.nextBtnText}>{isLast ? 'Começar' : 'Seguinte'}</Text>
          <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Slide({ slide }: { slide: Slide }) {
  const SlideIcon = slide.key === 'motorista' ? MaterialCommunityIcons : Ionicons;
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, friction: 7, tension: 45, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    return () => {
      loop.stop();
      pulseLoop.stop();
    };
  }, [entrance, float, pulse]);

  const contentAnimatedStyle = {
    opacity: entrance,
    transform: [
      { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  return (
    <View style={styles.slide}>
      <Animated.View
        style={[
          styles.decorBlob,
          styles.decorBlobTop,
          { backgroundColor: BRAND_SECONDARY, transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.decorBlob,
          styles.decorBlobBottom,
          { backgroundColor: BRAND_PRIMARY, transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] },
        ]}
      />

      <Animated.View style={[styles.content, contentAnimatedStyle]}>
        <View style={styles.header}>
          <Image source={Logo} style={styles.logo} resizeMode="contain" />
          <View style={[styles.brandPill, { borderColor: `${BRAND_PRIMARY}25` }]}>
            <View style={[styles.brandDot, { backgroundColor: BRAND_PRIMARY }]} />
            <Text style={[styles.brandPillText, { color: BRAND_PRIMARY }]}>AGRITECH</Text>
          </View>
        </View>

        <Animated.View style={[styles.imageCard, { borderColor: `${BRAND_PRIMARY}20`, transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }, { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }] }]}>
          <View style={[styles.imageArea, { backgroundColor: `${BRAND_SECONDARY}18` }]}>
            <View style={[styles.imageGlow, { backgroundColor: `${BRAND_SECONDARY}28` }]} />
            <View style={[styles.imagePlaceholder, { borderColor: `${BRAND_PRIMARY}30` }]}>
              <SlideIcon name={slide.icon as any} size={62} color={BRAND_PRIMARY} />
            </View>
            <Text style={[styles.imageHint, { color: BRAND_PRIMARY }]}>A SUA REDE AGRÍCOLA</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.iconRing, { backgroundColor: `${BRAND_PRIMARY}12`, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: BRAND_PRIMARY }]}>
            <SlideIcon name={slide.icon as any} size={42} color="#FFFFFF" />
          </View>
        </Animated.View>

        <View style={[styles.badge, { backgroundColor: `${BRAND_PRIMARY}12` }]}>
          <Text style={[styles.badgeText, { color: BRAND_PRIMARY }]}>{slide.badge}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>

        <View style={styles.bulletList}>
          {slide.bullets.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: BRAND_PRIMARY }]}> 
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  slide: { width, flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  decorBlob: { position: 'absolute', borderRadius: 999, opacity: 0.09 },
  decorBlobTop: { width: 220, height: 220, top: -115, right: -80 },
  decorBlobBottom: { width: 180, height: 180, bottom: 95, left: -105 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30, paddingTop: 54, paddingBottom: 142 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  logo: { width: 105, height: 58 },
  brandPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  brandDot: { width: 7, height: 7, borderRadius: 4 },
  brandPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  imageCard: { height: 198, borderRadius: 28, overflow: 'hidden', marginBottom: 20, borderWidth: 1, backgroundColor: '#FFFFFF', shadowColor: '#173D24', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  imageArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  imagePlaceholder: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFFFFF', borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#173D24', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  imageHint: { position: 'absolute', bottom: 14, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  iconRing: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  iconCircle: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', shadowColor: '#173D24', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 12 },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: '800', color: '#173D24', lineHeight: 34, marginBottom: 12 },
  description: { fontSize: 15, color: '#627264', lineHeight: 22, marginBottom: 22 },
  bulletList: { gap: 11 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bulletText: { color: '#34503B', fontSize: 13.5, fontWeight: '600', flex: 1 },
  skipBtn: { position: 'absolute', top: 55, right: 20, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F5F8F5' },
  skipText: { color: '#607064', fontSize: 13, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 38, paddingTop: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#1F6B3A' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999, shadowColor: '#173D24', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  nextBtnText: { fontWeight: '800', fontSize: 14, color: '#FFFFFF' },
});
