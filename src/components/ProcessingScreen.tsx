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

const LOGO = require('../../assets/images/Agrilink_AppIcon.png');

// Mesma paleta do ProductCard
const COLORS = {
  primary: '#2E8B4F',
  text: '#16231C',
  muted: '#78877D',
  line: '#E8ECE6',
  background: '#FFFFFF',
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
        <Image source={LOGO} resizeMode="contain" style={styles.logo} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loaderRing: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 75,
  },
  ringArc: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary,
    borderRadius: 75,
  },
  logo: { width: 118, height: 118 },
});