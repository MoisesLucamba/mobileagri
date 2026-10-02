import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import Icon, { IconName } from '../components/Icon';
import { signInWithGoogle } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';

const LOGO = require('../../assets/images/Agrilink_SD.png');

// Mesma palette da página de Segurança
const COLORS = {
  primary: '#1F6B3A',
  secondary: '#79C267',
  dark: '#465044',
  text: '#3D403A',
  muted: '#77796F',
  faint: '#A3A398',
  border: '#E8E5DC',
  field: '#F5F3EC',
  background: '#FBFAF6',
  soft: '#EEF0E9',
};

const SHADOW_SOFT = {
  shadowColor: COLORS.dark,
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 6,
};

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

// ================================
// COMPONENTES
// ================================

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}

// Botão que encolhe ao toque
function PressScale({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 240 }))}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// Campo com borda que anima a cor ao focar
function Field({
  icon,
  focused,
  children,
}: {
  icon: IconName;
  focused: boolean;
  children: React.ReactNode;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused]);

  const anim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [COLORS.border, COLORS.primary]),
    backgroundColor: interpolateColor(p.value, [0, 1], [COLORS.field, '#FFFFFF']),
    transform: [{ scale: 1 + p.value * 0.008 }],
  }));

  return (
    <Animated.View style={[styles.inputWrapper, anim]}>
      <View style={styles.inputIcon}>
        <Icon name={icon} size={19} color={focused ? COLORS.primary : COLORS.muted} />
      </View>
      {children}
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const busy = loading || googleLoading;

  // Logo: entra com mola e depois flutua suavemente
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const logoFloat = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSpring(1, { damping: 10, stiffness: 110 });
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { translateY: logoFloat.value }],
  }));

  // ================================
  // GOOGLE
  // ================================
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      const session = await signInWithGoogle();
      if (session) router.replace('/home');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top, 24) + 4,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <View style={styles.content}>
          {/* Voltar */}
          <Animated.View entering={FadeIn.duration(500)}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              disabled={busy}
              activeOpacity={0.5}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Icon name="chevron-left" size={22} color={COLORS.text} />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Logo */}
          <View style={styles.header}>
            <Animated.Image source={LOGO} style={[styles.logo, logoStyle]} resizeMode="contain" />
            <Animated.Text entering={enter(250)} style={styles.title}>
              Bem-vindo de volta
            </Animated.Text>
            <Animated.Text entering={enter(330)} style={styles.subtitle}>
              Entre na sua conta para continuar
            </Animated.Text>
          </View>

          {/* EMAIL */}
          <Animated.View entering={enter(420)} style={styles.inputContainer}>
            <Text style={styles.label}>E-mail</Text>
            <Field icon="mail" focused={focused === 'email'}>
              <TextInput
                style={styles.input}
                placeholder="Digite o seu e-mail"
                placeholderTextColor={COLORS.faint}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </Field>
          </Animated.View>

          {/* PASSWORD */}
          <Animated.View entering={enter(500)} style={styles.inputContainer}>
            <Text style={styles.label}>Palavra-passe</Text>
            <Field icon="lock" focused={focused === 'password'}>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Digite a sua palavra-passe"
                placeholderTextColor={COLORS.faint}
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
                accessibilityLabel={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={19} color={COLORS.muted} />
              </TouchableOpacity>
            </Field>
          </Animated.View>

          <Animated.View entering={enter(560)} style={styles.forgotWrap}>
            <TouchableOpacity onPress={handleForgotPassword} disabled={busy} hitSlop={8}>
              <Text style={styles.forgotText}>Esqueci a minha palavra-passe</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ENTRAR */}
          <Animated.View entering={enter(620)}>
            <PressScale
              onPress={handleSubmit}
              disabled={busy}
              style={[styles.loginButton, busy && styles.disabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Entrar</Text>
                  <Icon name="arrow-right" size={18} color="#FFFFFF" />
                </>
              )}
            </PressScale>
          </Animated.View>

          {/* DIVISOR */}
          <Animated.View entering={enter(680)} style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </Animated.View>

          {/* GOOGLE */}
          <Animated.View entering={enter(740)}>
            <PressScale
              onPress={handleGoogleLogin}
              disabled={busy}
              style={[styles.googleButton, busy && styles.disabled]}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={COLORS.dark} />
              ) : (
                <>
                  <GoogleLogo size={19} />
                  <Text style={styles.googleButtonText}>Continuar com o Google</Text>
                </>
              )}
            </PressScale>
          </Animated.View>

          {/* REGISTO */}
          <Animated.View entering={enter(800)} style={styles.registerContainer}>
            <Text style={styles.registerText}>Ainda não tem uma conta?</Text>
            <TouchableOpacity onPress={handleRegister} disabled={busy} hitSlop={8}>
              <Text style={styles.registerLink}>Criar conta</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ flex: 1, minHeight: 24 }} />

          {/* TERMOS E FOOTER */}
          <Animated.View entering={FadeIn.delay(900).duration(600)}>
            <View style={styles.legalCard}>
              <Icon name="shield" size={16} color={COLORS.primary} />
              <Text style={styles.legalText}>
                Ao continuar, aceita os nossos{' '}
                <Text style={styles.legalLink} onPress={() => router.push('/termos')}>
                  Termos de Utilização
                </Text>{' '}
                e a{' '}
                <Text style={styles.legalLink} onPress={() => router.push('/privacidade')}>
                  Política de Privacidade
                </Text>
                .
              </Text>
            </View>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} AgriLink · Desenvolvida pela{' '}
              <Text style={styles.footerBrand}>THE TEAM</Text>
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =====================================================
// ESTILOS
// =====================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: -4,
    paddingVertical: 8,
    paddingRight: 12,
    gap: 2,
  },
  backText: { fontSize: 15.5, fontWeight: '600', color: COLORS.text },

  header: { alignItems: 'center', marginTop: 8, marginBottom: 30 },
  logo: { width: 112, height: 112 },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: { marginTop: 6, fontSize: 14.5, color: COLORS.muted, textAlign: 'center' },

  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  inputWrapper: {
    height: 54,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: { marginLeft: 16 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15.5,
    color: COLORS.text,
    paddingHorizontal: 12,
  },
  eyeButton: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 22 },
  forgotText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },

  loginButton: {
    height: 54,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOW_SOFT,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
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
  googleButtonText: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },

  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 24,
  },
  registerText: { fontSize: 14, color: COLORS.muted },
  registerLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginLeft: 6 },

  legalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.field,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  legalText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.muted },
  legalLink: { color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },

  footerText: { fontSize: 11.5, color: '#8A968C', textAlign: 'center', marginTop: 14 },
  footerBrand: { fontWeight: '800', color: COLORS.dark, letterSpacing: 0.5 },
});