import { Stack } from 'expo-router';
import { RoleProvider } from '../context/RoleContext';
import '../../global.css';

export default function RootLayout() {
  return (
    <RoleProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="register" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="home" />
        <Stack.Screen name="search" />
        <Stack.Screen name="entregas" />
        <Stack.Screen name="publicar-produto" />
        <Stack.Screen name="fichas-recebimento" />
        <Stack.Screen name="mapa" />
        <Stack.Screen name="conversations" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="historicopagamentos" />
      </Stack>
    </RoleProvider>
  );
}