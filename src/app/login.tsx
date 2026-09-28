import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

import { supabase } from '../lib/supabase';

const LOGO = require('../../assets/images/Agrilink_SD.png');
const HERO = require('../../assets/images/agricultor.jpg');

// Substitui pelos links reais da plataforma
const TERMS_URL = 'https://agrilink.ao/termos';
const PRIVACY_URL = 'https://agrilink.ao/privacidade';

const { height } = Dimensions.get('window');
const HERO_HEIGHT = Math.max(160, height * 0.21);
const LOGO_SIZE = 88;

const COLORS = {
  primary: '#1F6B3A',
  secondary: '#79C267',
  dark: '#173D24',
  text: '#173D24',
  muted: '#627264',
  border: '#DCE5DD',
  field: '#F6F9F6',
  background: '#FFFFFF',
};

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Imagem no topo */}
      <View style={styles.hero}>
        <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroOverlay} />
      </View>

      <TouchableOpacity
        style={[styles.backBtn, { top: Math.max(insets.top, 24) + 8 }]}
        onPress={handleBack}
        disabled={busy}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Painel */}
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logoWrap}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>Entre na sua conta para continuar</Text>

          {/* EMAIL */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.inputWrapper, focused === 'email' && styles.inputFocused]}>
              <Ionicons name="mail-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite o seu e-mail"
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

          {/* PASSWORD */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Palavra-passe</Text>
            <View style={[styles.inputWrapper, focused === 'password' && styles.inputFocused]}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite a sua palavra-passe"
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
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={busy}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                  color={COLORS.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={handleForgotPassword}
            disabled={busy}
          >
            <Text style={styles.forgotText}>Esqueci a minha palavra-passe</Text>
          </TouchableOpacity>

          {/* ENTRAR */}
          <TouchableOpacity
            style={[styles.loginButton, busy && styles.disabled]}
            onPress={handleSubmit}
            disabled={busy}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Entrar</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* DIVISOR */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </View>

          {/* GOOGLE */}
          <TouchableOpacity
            style={[styles.googleButton, busy && styles.disabled]}
            onPress={handleGoogleLogin}
            disabled={busy}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={19} color="#EA4335" />
                <Text style={styles.googleButtonText}>Continuar com o Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* REGISTO */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Ainda não tem uma conta?</Text>
            <TouchableOpacity onPress={handleRegister} disabled={busy}>
              <Text style={styles.registerLink}>Criar conta</Text>
            </TouchableOpacity>
          </View>

          {/* TERMOS E POLÍTICAS */}
          <Text style={styles.legalText}>
            Ao continuar, aceita os nossos{' '}
            <Text style={styles.legalLink} onPress={() => openLink(TERMS_URL)}>
              Termos de Utilização
            </Text>{' '}
            e a{' '}
            <Text style={styles.legalLink} onPress={() => openLink(PRIVACY_URL)}>
              Política de Privacidade
            </Text>
            .
          </Text>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} AgriLink
            </Text>
            <Text style={styles.footerText}>
              Desenvolvida pela <Text style={styles.footerBrand}>THE TEAM</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT + 40,
    overflow: 'hidden',
    backgroundColor: '#0A2814',
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 40, 20, 0.28)' },

  backBtn: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 40, 20, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 10,
  },

  sheet: {
    position: 'absolute',
    top: HERO_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#0A2814',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },

  logoWrap: {
    position: 'absolute',
    top: -LOGO_SIZE / 2,
    alignSelf: 'center',
    zIndex: 5,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: `${COLORS.secondary}55`,
    shadowColor: '#0A2814',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logo: { width: LOGO_SIZE - 24, height: LOGO_SIZE - 24 },

  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: LOGO_SIZE / 2 + 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },

  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, marginBottom: 7 },
  inputWrapper: {
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.field,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: '#FFFFFF' },
  inputIcon: { marginLeft: 15 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: COLORS.text,
    paddingHorizontal: 12,
  },
  eyeButton: {
    paddingHorizontal: 15,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  forgotButton: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 20 },
  forgotText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },

  loginButton: {
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#173D24',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.65 },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.muted, marginHorizontal: 12 },

  googleButton: {
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  googleButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  registerText: { fontSize: 14, color: COLORS.muted },
  registerLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginLeft: 5 },

  legalText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 8,
  },
  legalLink: { color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },

  footer: { alignItems: 'center', marginTop: 22, gap: 3 },
  footerText: { fontSize: 11.5, color: '#8A968C' },
  footerBrand: { fontWeight: '800', color: COLORS.dark, letterSpacing: 0.5 },
});