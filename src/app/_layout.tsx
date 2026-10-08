import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../../global.css';
import ProcessingScreen from '../components/ProcessingScreen';
import i18n, { isAppLanguage, LANGUAGE_STORAGE_KEY } from '../constants/i18n';
import { RoleProvider } from '../context/RoleContext';

function RootNavigator() {
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
        <Stack.Screen name="product/[id]" />
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
    </View>
  );
}

export default function RootLayout() {
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then(async (savedLanguage) => {
        if (isAppLanguage(savedLanguage)) await i18n.changeLanguage(savedLanguage);
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