import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PROCESSING_LOGO = require('../../assets/images/Agrilink_Logo.png');

const ProcessingContext = createContext<(() => () => void) | null>(null);

// Mesma paleta do ProductCard
const COLORS = {
  primary: '#218B4A',
  line: '#E8ECE6',
  background: '#FFFFFF',
  white: '#FFFEFC',
};

export function ProcessingScreenProvider({ children }: { children: ReactNode }) {
  const [activeScreens, setActiveScreens] = useState(0);
  const registerProcessingScreen = useCallback(() => {
    setActiveScreens((count) => count + 1);
    return () => setActiveScreens((count) => Math.max(0, count - 1));
  }, []);

  return (
    <ProcessingContext.Provider value={registerProcessingScreen}>
      <View style={styles.root}>
        {children}
        {activeScreens > 0 ? <ProcessingIndicator /> : null}
      </View>
    </ProcessingContext.Provider>
  );
}

function ProcessingIndicator() {
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
        <Image source={PROCESSING_LOGO} resizeMode="contain" style={styles.logo} />
      </View>
    </Animated.View>
  );
}

export default function ProcessingScreen() {
  const registerProcessingScreen = useContext(ProcessingContext);

  if (!registerProcessingScreen) {
    throw new Error('ProcessingScreen must be used within ProcessingScreenProvider.');
  }

  useEffect(() => registerProcessingScreen(), [registerProcessingScreen]);
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loaderRing: {
    width: 230,
    height: 230,
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
  logo: { width: 200, height: 142 },
});