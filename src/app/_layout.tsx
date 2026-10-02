import { Stack, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { RoleProvider, useUserRole } from '../context/RoleContext';
import Icon from '../components/Icon';
import '../../global.css';

const LOADING_DURATION = 680;
const INITIAL_LOADING_DURATION = 1050;
const LOGO = require('../../assets/images/Agrilink_SD.png');

function ProcessingSplash() {
  const rotation = useSharedValue(0);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(220)}
      style={styles.splash}
      accessibilityRole="progressbar"
      accessibilityLabel="A carregar a página"
      accessibilityState={{ busy: true }}
    >
      <LinearGradient
        colors={['#103B2B', '#15583A', '#0D3023']}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.splashContent}>
        <View style={styles.loaderRing}>
          <View style={styles.ringTrack} />
          <Animated.View style={[styles.ringArc, ringStyle]} />
          <View style={styles.logoBadge}>
            <Image source={LOGO} resizeMode="contain" style={styles.logo} />
          </View>
        </View>

        <View style={styles.loadingCopy}>
          <View style={styles.statusLine}>
            <Icon name="leaf" size={15} color="#C7F16B" />
            <Text style={styles.statusEyebrow}>AGRILINK</Text>
          </View>
          <Text style={styles.statusTitle}>A preparar a sua experiência</Text>
          <Text style={styles.statusCaption}>Só um momento</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function RootNavigator() {
  const pathname = usePathname();
  const { loading: roleLoading } = useUserRole();
  const [isProcessing, setIsProcessing] = useState(true);
  const hasLoadedFirstRoute = useRef(false);

  useEffect(() => {
    const isFirstRoute = !hasLoadedFirstRoute.current;
    hasLoadedFirstRoute.current = true;
    setIsProcessing(true);

    const timer = setTimeout(
      () => setIsProcessing(false),
      isFirstRoute ? INITIAL_LOADING_DURATION : LOADING_DURATION,
    );

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="home" />
        <Stack.Screen name="search" />
        <Stack.Screen name="entregas" />
        <Stack.Screen name="publicar-produto" />
        <Stack.Screen name="fichas-recebimento" />
        <Stack.Screen name="mapa" />
        <Stack.Screen name="conversations" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="seguranca" />
        <Stack.Screen name="historicopagamentos" />
      </Stack>
      {(isProcessing || roleLoading) && <ProcessingSplash />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <RoleProvider>
      <RootNavigator />
    </RoleProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splashContent: { alignItems: 'center', paddingHorizontal: 28 },
  loaderRing: {
    width: 154,
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 77,
  },
  ringArc: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#C7F16B',
    borderRightColor: '#79C267',
    borderRadius: 77,
  },
  logoBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  logo: { width: 88, height: 88, borderRadius: 44 },
  loadingCopy: { alignItems: 'center', marginTop: 34 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 11 },
  statusEyebrow: {
    color: '#C7F16B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  statusTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  statusCaption: { color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 8 },
});