import { useEffect } from 'react';
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

const LOGO = require('../../assets/images/Agrilink_SD.png');

// Mesma paleta do ProductCard
const COLORS = {
  primary: '#2E8B4F',
  text: '#16231C',
  muted: '#78877D',
  line: '#E8ECE6',
  background: '#F9FAF8',
  white: '#FFFFFF',
};

export default function ProcessingScreen() {
  const rotation = useSharedValue(0);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(220)}
      style={styles.overlay}
      accessibilityRole="progressbar"
      accessibilityLabel="A carregar a página"
      accessibilityState={{ busy: true }}
    >
      <View style={styles.loaderRing}>
        <View style={styles.ringTrack} />
        <Animated.View style={[styles.ringArc, ringStyle]} />
        <View style={styles.logoBadge}>
          <Image source={LOGO} resizeMode="contain" style={styles.logo} />
        </View>
      </View>

      <Text style={styles.title}>A carregar…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loaderRing: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 56,
  },
  ringArc: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary,
    borderRadius: 56,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 60, height: 60, borderRadius: 30 },
  title: {
    marginTop: 22,
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.muted,
  },
});