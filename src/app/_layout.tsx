import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../../global.css';
import ProcessingScreen from '../components/ProcessingScreen';
import GuestModeCard from '../components/GuestModeCard';
import { changeAppLanguage, isAppLanguage, i18nReady, LANGUAGE_STORAGE_KEY } from '../constants/i18n';
import { RoleProvider, useUserRole } from '../context/RoleContext';

function RootNavigator() {
  const pathname = usePathname();
  const { isGuest, guestReady } = useUserRole();
  const guestCanBrowse =
    pathname === '/home' ||
    pathname === '/search' ||
    pathname === '/green-points' ||
    /^\/product\/[^/]+$/.test(pathname);
  const guestCanAuthenticate = [
    '/login',
    '/register',
    '/verify-otp',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ].includes(pathname);

  if (!guestReady) return <ProcessingScreen />;
  if (isGuest && !guestCanBrowse && !guestCanAuthenticate) {
    return <Redirect href="/home" />;
  }

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="green-points" />
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
      {isGuest && guestCanBrowse ? <GuestModeCard /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([i18nReady, AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)])
      .then(async ([, savedLanguage]) => {
        if (isAppLanguage(savedLanguage)) await changeAppLanguage(savedLanguage);
      })
      .catch((error) => {
        console.warn('[i18n] Não foi possível carregar o idioma guardado:', error);
      })
      .finally(() => {
        if (mounted) setLanguageReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <RoleProvider>
      {languageReady ? <RootNavigator /> : <ProcessingScreen />}
    </RoleProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});