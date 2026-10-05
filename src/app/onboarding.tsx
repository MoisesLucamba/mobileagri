import React, { useEffect } from 'react';
import { View, Text, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import Icon from '../components/Icon';

const COLORS = {
  primary: '#1F6B3A',
  accent: '#9BE07F',
  ink: '#08200F',
};

const SPLASH_DURATION = 2000; // 2 segundos

export default function OnboardingScreen() {
  const router = useRouter();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.86);
  const textOpacity = useSharedValue(0);
  const textShift = useSharedValue(10);
  const lineWidth = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    logoOpacity.value = withTiming(1, { duration: 500, easing: ease });
    logoScale.value = withTiming(1, { duration: 650, easing: ease });

    textOpacity.value = withDelay(250, withTiming(1, { duration: 500, easing: ease }));
    textShift.value = withDelay(250, withTiming(0, { duration: 500, easing: ease }));

    lineWidth.value = withDelay(400, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));

    // fade-out suave antes de navegar
    screenOpacity.value = withDelay(SPLASH_DURATION - 300, withTiming(0, { duration: 300 }));

    const timer = setTimeout(() => router.replace('/login'), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textShift.value }],
  }));
  const lineStyle = useAnimatedStyle(() => ({ width: `${lineWidth.value * 100}%` }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.center}>
        <Animated.View style={[styles.logoMark, logoStyle]}>
          <Icon name="leaf" size={34} color="#FFFFFF" />
        </Animated.View>

        <Animated.View style={textStyle}>
          <Text style={styles.brand}>
            Agri<Text style={styles.brandAccent}>Link</Text>
          </Text>
        </Animated.View>
      </View>

      {/* Linha de progresso minimalista */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, lineStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', gap: 18 },

  logoMark: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  brand: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: COLORS.ink,
  },
  brandAccent: { color: COLORS.primary },

  progressTrack: {
    position: 'absolute',
    bottom: 64,
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(8,32,15,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});