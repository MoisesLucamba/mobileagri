import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

import { supabase } from '../lib/supabase';

const Logo = require('../assets/images/logo.jpeg');

const COLORS = {
  primary: '#2E7D32',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#D9DDE3',
  background: '#FFFFFF',
};

// Necessário para fechar o browser automaticamente depois do OAuth
WebBrowser.maybeCompleteAuthSession();

// ================================
// OAUTH — ler parâmetros do url de retorno
// (junta o que vem em ?query e o que vem em #fragmento)
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

// ================================
// OAUTH — troca o url de retorno por uma sessão Supabase
// ================================
const createSessionFromUrl = async (url: string) => {
  const p = parseUrlParams(url);

  if (p.error || p.error_description) {
    throw new Error(p.error_description || p.error);
  }

  // Fluxo PKCE: vem um "code"
  if (p.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      p.code
    );
    if (error) throw error;
    return data.session;
  }

  // Fluxo implícito: vêm os tokens
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ================================
  // GOOGLE
  // ================================
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);

      // Em build:    agrilink://auth/callback
      // No Expo Go:  exp://IP:8081/--/auth/callback
      // Este valor TEM de estar na lista "Redirect URLs" do Supabase.
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

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type !== 'success') return; // utilizador cancelou

      const session = await createSessionFromUrl(result.url);

      if (session) {
        router.replace('/home');
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível concluir a sessão com o Google.'
        );
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
      Alert.alert(
        'Atenção',
        'Por favor, introduza o seu e-mail.'
      );
      return;
    }

    if (!password) {
      Alert.alert(
        'Atenção',
        'Por favor, introduza a sua palavra-passe.'
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        console.log('Erro de login:', error);

        if (
          error.message === 'Invalid login credentials'
        ) {
          Alert.alert(
            'Erro ao entrar',
            'E-mail ou palavra-passe incorretos.'
          );
        } else {
          Alert.alert(
            'Erro ao entrar',
            error.message
          );
        }

        return;
      }

      console.log('Login realizado:', data.session);

      // ==========================================
      // LOGIN CORRETO → HOME
      // ==========================================
      if (data.session) {
        router.replace('/home');
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível iniciar a sessão.'
        );
      }
    } catch (error) {
      console.log('Erro inesperado:', error);

      Alert.alert(
        'Erro',
        'Ocorreu um erro inesperado. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // RECUPERAR PASSWORD
  // ================================
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Recuperar palavra-passe',
        'Introduza primeiro o seu e-mail.'
      );
      return;
    }

    try {
      setLoading(true);

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim()
        );

      if (error) {
        Alert.alert(
          'Erro',
          error.message
        );
        return;
      }

      Alert.alert(
        'E-mail enviado',
        'Enviámos um link para redefinir a sua palavra-passe. Verifique o seu e-mail.'
      );
    } catch (error) {
      console.log(
        'Erro ao recuperar password:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível enviar o e-mail de recuperação.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // REGISTAR
  // ================================
  const handleRegister = () => {
    router.push('/register');
  };

  // ================================
  // VOLTAR
  // ================================
  const handleBack = () => {
    router.replace('/');
  };

  const busy = loading || googleLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>

            {/* =========================
                LOGO
            ========================== */}
            <View style={styles.logoContainer}>
              <Image
                source={Logo}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* =========================
                TÍTULO
            ========================== */}
            <Text style={styles.title}>
              Bem-vindo de volta
            </Text>

            <Text style={styles.subtitle}>
              Entre na sua conta para continuar
            </Text>

            {/* =========================
                FORMULÁRIO
            ========================== */}
            <View style={styles.form}>

              {/* =========================
                  BOTÃO GOOGLE
              ========================== */}
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  busy && styles.loginButtonDisabled,
                ]}
                onPress={handleGoogleLogin}
                disabled={busy}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.text}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="logo-google"
                      size={20}
                      color="#EA4335"
                    />
                    <Text style={styles.googleButtonText}>
                      Continuar com o Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* DIVISOR */}
              <View
                style={
                  styles.dividerContainer
                }
              >
                <View
                  style={styles.divider}
                />

                <Text
                  style={styles.dividerText}
                >
                  ou
                </Text>

                <View
                  style={styles.divider}
                />
              </View>

              {/* EMAIL */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  E-mail
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={21}
                    color={COLORS.muted}
                    style={styles.inputIcon}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Digite o seu e-mail"
                    placeholderTextColor={
                      COLORS.muted
                    }
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* PASSWORD */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Palavra-passe
                </Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={21}
                    color={COLORS.muted}
                    style={styles.inputIcon}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Digite a sua palavra-passe"
                    placeholderTextColor={
                      COLORS.muted
                    }
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={
                      !showPassword
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    returnKeyType="done"
                    onSubmitEditing={
                      handleSubmit
                    }
                  />

                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    disabled={busy}
                  >
                    <Ionicons
                      name={
                        showPassword
                          ? 'eye-off-outline'
                          : 'eye-outline'
                      }
                      size={22}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ESQUECI PASSWORD */}
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={
                  handleForgotPassword
                }
                disabled={busy}
              >
                <Text style={styles.forgotText}>
                  Esqueci a minha palavra-passe
                </Text>
              </TouchableOpacity>

              {/* =========================
                  BOTÃO ENTRAR
              ========================== */}
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  busy &&
                    styles.loginButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={busy}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Text
                      style={
                        styles.loginButtonText
                      }
                    >
                      Entrar
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </TouchableOpacity>

              {/* =========================
                  REGISTRO
              ========================== */}
              <View
                style={
                  styles.registerContainer
                }
              >
                <Text
                  style={styles.registerText}
                >
                  Ainda não tem uma conta?
                </Text>

                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={busy}
                >
                  <Text
                    style={styles.registerLink}
                  >
                    Criar conta
                  </Text>
                </TouchableOpacity>
              </View>

              {/* VOLTAR */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                disabled={busy}
              >
                <Ionicons
                  name="arrow-back-outline"
                  size={18}
                  color={COLORS.primary}
                />

                <Text
                  style={styles.backText}
                >
                  Voltar
                </Text>
              </TouchableOpacity>

            </View>

            {/* FOOTER */}
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} AgriLink
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 30,
  },

  // LOGO

  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logo: {
    width: 230,
    height: 100,
  },

  // TÍTULO

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 8,
  },

  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 30,
  },

  // FORM

  form: {
    width: '100%',
  },

  // GOOGLE

  googleButton: {
    height: 54,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },

  googleButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  inputContainer: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },

  inputWrapper: {
    height: 54,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  inputIcon: {
    marginLeft: 15,
  },

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

  // FORGOT PASSWORD

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 22,
  },

  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // LOGIN

  loginButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },

  loginButtonDisabled: {
    opacity: 0.65,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // DIVISOR

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  dividerText: {
    fontSize: 13,
    color: COLORS.muted,
    marginHorizontal: 12,
  },

  // REGISTRO

  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },

  registerText: {
    fontSize: 14,
    color: COLORS.muted,
  },

  registerLink: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 5,
  },

  // VOLTAR

  backButton: {
    marginTop: 25,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },

  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // FOOTER

  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 25,
  },
});