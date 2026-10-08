import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import Icon, { IconName } from '../components/Icon';
import { normalizeAngolaAuthPhone } from '../lib/authPhone';
import { signInWithGoogle } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';

// Mesma paleta do ProductCard
const COLORS = {
  primary: '#2E8B4F',
  primaryDark: '#25703F',
  tint: '#E9F5EC',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  line: '#E8ECE6',
  background: '#F9FAF8',
  white: '#FFFFFF',
};

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);
const LOGO = require('../../assets/images/Agrilink_SD.png');

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
    p.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused]);

  const anim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [COLORS.line, COLORS.primary]),
  }));

  return (
    <Animated.View style={[styles.inputWrapper, anim]}>
      <View style={styles.inputIcon}>
        <Icon name={icon} size={18} color={focused ? COLORS.primary : COLORS.muted} />
      </View>
      {children}
    </Animated.View>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
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
        t('login.googleErrorTitle'),
        error?.message || t('login.googleError')
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
      Alert.alert(t('login.attention'), t('login.enterEmailOrPhone'));
      return;
    }

    if (!password) {
      Alert.alert(t('login.attention'), t('login.enterPasswordError'));
      return;
    }

    try {
      setLoading(true);

      const identifier = email.trim();
      const phoneCredential = identifier.includes('@') ? null : normalizeAngolaAuthPhone(identifier);
      if (!identifier.includes('@') && !phoneCredential) {
        Alert.alert(t('login.invalidPhone'), t('login.invalidPhoneHint'));
        return;
      }

      const result = identifier.includes('@')
        ? await supabase.auth.signInWithPassword({ email: identifier.toLowerCase(), password })
        : await supabase.auth.signInWithPassword({ phone: phoneCredential!, password });
      const { data, error } = result;

      if (error) {
        console.log('Erro de login:', error);

        if (error.message === 'Invalid login credentials') {
          Alert.alert(t('login.errorTitle'), t('login.invalidCredentials'));
        } else {
          Alert.alert(t('login.errorTitle'), error.message);
        }
        return;
      }

      if (data.session) {
        router.replace('/home');
      } else {
        Alert.alert(t('login.errorTitle'), t('login.sessionError'));
      }
    } catch (error) {
      console.log('Erro inesperado:', error);
      Alert.alert(t('login.errorTitle'), t('login.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // RECUPERAR PASSWORD
  // ================================
  const handleForgotPassword = async () => {
    const recoveryEmail = email.trim().toLowerCase();
    if (!recoveryEmail.includes('@')) {
      Alert.alert(t('login.recoverPassword'), t('login.enterEmailFirst'));
      return;
    }

    try {
      setLoading(true);

      const redirectTo = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, { redirectTo });

      if (error) {
        Alert.alert(t('login.errorTitle'), error.message);
        return;
      }

      Alert.alert(
        t('login.emailSent'),
        t('login.recoveryLinkSent')
      );
    } catch (error) {
      console.log('Erro ao recuperar password:', error);
      Alert.alert(t('login.errorTitle'), t('login.recoveryError'));
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
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('login.back')}
            >
              <Icon name="chevron-left" size={19} color={COLORS.text} />
            </TouchableOpacity>
          </Animated.View>

          {/* Logo */}
          <View style={styles.header}>
            <Image source={LOGO} resizeMode="contain" style={styles.logo} accessibilityLabel="AgriLink" />
            <Animated.Text entering={enter(250)} style={styles.title}>
              {t('login.welcome')}
            </Animated.Text>
            <Animated.Text entering={enter(330)} style={styles.subtitle}>
              {t('login.subtitle')}
            </Animated.Text>
          </View>

          {/* EMAIL */}
          <Animated.View entering={enter(420)} style={styles.inputContainer}>
            <Text style={styles.label}>E-mail</Text>
            <Field icon="mail" focused={focused === 'email'}>
              <TextInput
                style={styles.input}
                placeholder={t('login.emailOrPhone')}
                placeholderTextColor={COLORS.faint}
                value={email}
                onChangeText={setEmail}
                keyboardType="default"
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
            <Text style={styles.label}>{t('login.password')}</Text>
            <Field icon="lock" focused={focused === 'password'}>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder={t('login.enterPassword')}
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
                accessibilityLabel={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </Field>
          </Animated.View>

          <Animated.View entering={enter(560)} style={styles.forgotWrap}>
            <TouchableOpacity onPress={handleForgotPassword} disabled={busy} hitSlop={8}>
              <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ENTRAR */}
          <Animated.View entering={enter(620)}>
            <PressScale
              onPress={handleSubmit}
              disabled={busy}
              style={[styles.loginButton, busy && styles.disabled]}
            >
              <>
                <Text style={styles.loginButtonText}>{loading ? 'A entrar…' : t('login.enter')}</Text>
                <Icon name="arrow-right" size={17} color="#FFFFFF" />
              </>
            </PressScale>
          </Animated.View>

          {/* DIVISOR */}
          <Animated.View entering={enter(680)} style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t('login.or')}</Text>
            <View style={styles.divider} />
          </Animated.View>

          {/* GOOGLE */}
          <Animated.View entering={enter(740)}>
            <PressScale
              onPress={handleGoogleLogin}
              disabled={busy}
              style={[styles.googleButton, busy && styles.disabled]}
            >
              <GoogleLogo size={18} />
              <Text style={styles.googleButtonText}>{googleLoading ? 'A ligar ao Google…' : t('login.continueGoogle')}</Text>
            </PressScale>
          </Animated.View>

          {/* REGISTO */}
          <Animated.View entering={enter(800)} style={styles.registerContainer}>
            <Text style={styles.registerText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={handleRegister} disabled={busy} hitSlop={8}>
              <Text style={styles.registerLink}>{t('login.createAccount')}</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ flex: 1, minHeight: 24 }} />

          {/* TERMOS E FOOTER */}
          <Animated.View entering={FadeIn.delay(900).duration(600)}>
            <Text style={styles.legalText}>
              Ao continuar, aceita os nossos{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/termos')}>
                {t('login.terms')}
              </Text>{' '}
              e a{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/privacidade')}>
                {t('login.privacy')}
              </Text>
              .
            </Text>
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
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  // Mesmo botão do ícone de mapa do ProductCard
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.tint,
  },

  header: { alignItems: 'center', marginTop: 12, marginBottom: 28 },
  logo: { width: 88, height: 88, borderRadius: 12, backgroundColor: COLORS.white },
  title: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 4, fontSize: 13.5, color: COLORS.muted, textAlign: 'center' },

  inputContainer: { marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  inputWrapper: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14.5,
    color: COLORS.text,
    paddingHorizontal: 10,
  },
  eyeButton: {
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  forgotWrap: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 18 },
  forgotText: { fontSize: 12.5, fontWeight: '800', color: COLORS.primaryDark },

  // Botão igual ao "Comprar" do ProductCard
  loginButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.line },
  dividerText: { fontSize: 12.5, color: COLORS.muted, marginHorizontal: 12 },

  googleButton: {
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
  },
  googleButtonText: { fontSize: 14, fontWeight: '800', color: COLORS.text },

  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  registerText: { fontSize: 13.5, color: COLORS.muted },
  registerLink: { fontSize: 13.5, fontWeight: '800', color: COLORS.primaryDark, marginLeft: 6 },

  legalText: { fontSize: 11.5, lineHeight: 17, color: COLORS.muted, textAlign: 'center' },
  legalLink: { color: COLORS.primaryDark, fontWeight: '700' },

  footerText: { fontSize: 11, color: COLORS.faint, textAlign: 'center', marginTop: 12 },
  footerBrand: { fontWeight: '800', color: COLORS.text },
});