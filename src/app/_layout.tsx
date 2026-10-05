import { Stack, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import '../../global.css';
import ProcessingScreen from '../components/ProcessingScreen';
import { RoleProvider } from '../context/RoleContext';

function RootNavigator() {
  const pathname = usePathname();
  const [isProcessing, setIsProcessing] = useState(true);
  const hasLoadedFirstRoute = useRef(false);

  useEffect(() => {
    const isFirstRoute = !hasLoadedFirstRoute.current;
    hasLoadedFirstRoute.current = true;
    setIsProcessing(true);

    const timer = setTimeout(() => setIsProcessing(false), isFirstRoute ? 850 : 360);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="agrilink-ads" />
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
      {isProcessing && <ProcessingScreen />}
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
});