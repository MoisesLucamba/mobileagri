import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

import { supabase } from '../lib/supabase';

const LOGO = require('../../assets/images/Agrilink_SD.png');

// Substitui pelos links reais da plataforma
const TERMS_URL = 'https://agrilink.ao/termos';
const PRIVACY_URL = 'https://agrilink.ao/privacidade';

const PRIMARY = '#1F6B3A';
const MUTED = '#627264';

WebBrowser.maybeCompleteAuthSession();

// ================================
// OAUTH
// ================================
const parseUrlParams = (url: string) => {
  const out: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';

  [query, hash].forEach((part) =>
    new URLSearchParams(part).forEach((value, key) => {
      out[key] = value;
    })
  );

  return out;
};

const createSessionFromUrl = async (url: string) => {
  const p = parseUrlParams(url);

  if (p.error || p.error_description) {
    throw new Error(p.error_description || p.error);
  }

  if (p.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(p.code);
    if (error) throw error;
    return data.session;
  }

  if (p.access_token && p.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: p.access_token,
      refresh_token: p.refresh_token,
    });
    if (error) throw error;
    return data.session;
  }

  return null;
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const busy = loading || googleLoading;

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o link.')
    );
  };

  // ================================
  // GOOGLE
  // ================================
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);

      const redirectTo = makeRedirectUri({
        scheme: 'agrilink',
        path: 'auth/callback',
      });
      console.log('redirectTo =', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Não foi possível iniciar o Google.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success') return;

      const session = await createSessionFromUrl(result.url);

      if (session) {
        router.replace('/home');
      } else {
        Alert.alert('Erro', 'Não foi possível concluir a sessão com o Google.');
      }
    } catch (error: any) {
      console.log('Erro Google:', error);
      Alert.alert(
        'Erro ao entrar com o Google',
        error?.message || 'Tente novamente dentro de instantes.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // ================================
  // LOGIN
  // ================================
  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Atenção', 'Por favor, introduza o seu e-mail.');
      return;
    }

    if (!password) {
      Alert.alert('Atenção', 'Por favor, introduza a sua palavra-passe.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.log('Erro de login:', error);

        if (error.message === 'Invalid login credentials') {
          Alert.alert('Erro ao entrar', 'E-mail ou palavra-passe incorretos.');
        } else {
          Alert.alert('Erro ao entrar', error.message);
        }
        return;
      }

      console.log('Login realizado:', data.session);

      if (data.session) {
        router.replace('/home');
      } else {
        Alert.alert('Erro', 'Não foi possível iniciar a sessão.');
      }
    } catch (error) {
      console.log('Erro inesperado:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // RECUPERAR PASSWORD
  // ================================
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Recuperar palavra-passe', 'Introduza primeiro o seu e-mail.');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        Alert.alert('Erro', error.message);
        return;
      }

      Alert.alert(
        'E-mail enviado',
        'Enviámos um link para redefinir a sua palavra-passe. Verifique o seu e-mail.'
      );
    } catch (error) {
      console.log('Erro ao recuperar password:', error);
      Alert.alert('Erro', 'Não foi possível enviar o e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => router.push('/register');
  const handleBack = () => router.replace('/');

  const fieldClass = (name: 'email' | 'password') =>
    `h-14 flex-row items-center rounded-2xl border-[1.5px] ${
      focused === name
        ? 'border-[#1F6B3A] bg-white'
        : 'border-[#E3EAE4] bg-[#F5F8F5]'
    }`;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Detalhes decorativos suaves */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <View className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#79C267]/20" />
        <View className="absolute -left-16 top-40 h-40 w-40 rounded-full bg-[#1F6B3A]/[0.06]" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top, 24) + 8,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <View className="flex-1 px-7">
          {/* Topo */}
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full border border-[#E3EAE4] bg-white"
            onPress={handleBack}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#173D24" />
          </TouchableOpacity>

          {/* Cabeçalho */}
          <Animated.View entering={FadeIn.duration(600)} className="mb-9 mt-8">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl border border-[#E3EAE4] bg-white shadow-md shadow-[#1F6B3A]/20">
              <Image source={LOGO} className="h-11 w-11" resizeMode="contain" />
            </View>
            <Text className="text-[34px] font-extrabold leading-[40px] tracking-tight text-[#173D24]">
              Bem-vindo{'\n'}de volta
              <Text className="text-[#79C267]">.</Text>
            </Text>
            <Text className="mt-3 text-[15px] leading-[22px] text-[#627264]">
              Entre na sua conta para continuar.
            </Text>
          </Animated.View>

          {/* EMAIL */}
          <Animated.View entering={FadeInDown.delay(120).duration(500)}>
            <View className="mb-4">
              <Text className="mb-2 text-[13.5px] font-bold text-[#173D24]">E-mail</Text>
              <View className={fieldClass('email')}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focused === 'email' ? PRIMARY : MUTED}
                  style={{ marginLeft: 16 }}
                />
                <TextInput
                  className="h-full flex-1 px-3 text-[15.5px] text-[#173D24]"
                  placeholder="nome@exemplo.com"
                  placeholderTextColor="#9AA79C"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  returnKeyType="next"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>
          </Animated.View>

          {/* PASSWORD */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <View className="mb-6">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-[13.5px] font-bold text-[#173D24]">Palavra-passe</Text>
                <TouchableOpacity onPress={handleForgotPassword} disabled={busy} hitSlop={8}>
                  <Text className="text-[13px] font-bold text-[#1F6B3A]">Esqueci-me</Text>
                </TouchableOpacity>
              </View>
              <View className={fieldClass('password')}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focused === 'password' ? PRIMARY : MUTED}
                  style={{ marginLeft: 16 }}
                />
                <TextInput
                  className="h-full flex-1 px-3 text-[15.5px] text-[#173D24]"
                  placeholder="A sua palavra-passe"
                  placeholderTextColor="#9AA79C"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity
                  className="h-full items-center justify-center px-4"
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={busy}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={MUTED}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* ENTRAR */}
          <Animated.View entering={FadeInDown.delay(280).duration(500)}>
            <TouchableOpacity
              className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#1F6B3A] shadow-lg shadow-[#1F6B3A]/40 ${
                busy ? 'opacity-60' : ''
              }`}
              onPress={handleSubmit}
              disabled={busy}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-base font-extrabold text-white">Entrar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* DIVISOR */}
          <Animated.View
            entering={FadeInDown.delay(340).duration(500)}
            className="my-6 flex-row items-center"
          >
            <View className="h-px flex-1 bg-[#E3EAE4]" />
            <Text className="mx-3 text-[12.5px] text-[#627264]">ou continue com</Text>
            <View className="h-px flex-1 bg-[#E3EAE4]" />
          </Animated.View>

          {/* GOOGLE */}
          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <TouchableOpacity
              className={`h-14 flex-row items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-[#E3EAE4] bg-white ${
                busy ? 'opacity-60' : ''
              }`}
              onPress={handleGoogleLogin}
              disabled={busy}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#173D24" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={19} color="#EA4335" />
                  <Text className="text-[15.5px] font-bold text-[#173D24]">Google</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* REGISTO */}
          <Animated.View
            entering={FadeInDown.delay(460).duration(500)}
            className="mt-7 flex-row flex-wrap items-center justify-center"
          >
            <Text className="text-sm text-[#627264]">Ainda não tem uma conta?</Text>
            <TouchableOpacity onPress={handleRegister} disabled={busy} hitSlop={8}>
              <Text className="ml-1.5 text-sm font-extrabold text-[#1F6B3A]">Criar conta</Text>
            </TouchableOpacity>
          </Animated.View>

          <View className="min-h-[28px] flex-1" />

          {/* TERMOS E FOOTER */}
          <Text className="px-2 text-center text-xs leading-[18px] text-[#627264]">
            Ao continuar, aceita os nossos{' '}
            <Text
              className="font-bold text-[#1F6B3A] underline"
              onPress={() => openLink(TERMS_URL)}
            >
              Termos de Utilização
            </Text>{' '}
            e a{' '}
            <Text
              className="font-bold text-[#1F6B3A] underline"
              onPress={() => openLink(PRIVACY_URL)}
            >
              Política de Privacidade
            </Text>
            .
          </Text>

          <Text className="mt-4 text-center text-[11.5px] text-[#8A968C]">
            © {new Date().getFullYear()} AgriLink · Desenvolvida pela{' '}
            <Text className="font-extrabold tracking-wide text-[#173D24]">THE TEAM</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}