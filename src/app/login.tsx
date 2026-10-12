import { type Href, useRouter } from 'expo-router';
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

import Icon, { IconName } from '../components/Icon';
import GoogleLogo from '../components/GoogleLogo';
import { normalizeAngolaAuthPhone } from '../lib/authPhone';
import { signInWithGoogle } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../context/RoleContext';

// Mesma paleta do ProductCard
const COLORS = {
  primary: '#218B4A',
  primaryDark: '#218B4A',
  tint: '#EAF5ED',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  line: '#E8ECE6',
  background: '#F3F6F2',
  white: '#FFFEFC',
};

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);
const LOGO = require('../../assets/images/Agrilink_Logo.png');

// ================================
// COMPONENTES
// ================================

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
  const { enterGuest } = useUserRole();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const busy = loading || googleLoading || guestLoading;

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
  const handleEnterGuest = async () => {
    try {
      setGuestLoading(true);
      await enterGuest();
      router.replace('/home');
    } catch (error) {
      console.error('Não foi possível iniciar o modo visitante:', error);
      Alert.alert(t('login.errorTitle'), t('login.unexpectedError'));
    } finally {
      setGuestLoading(false);
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
            <TouchableOpacity onPress={() => router.push('/forgot-password' as Href)} disabled={busy} hitSlop={8}>
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

          <Animated.View entering={enter(850)} style={styles.guestCard}>
            <View style={styles.guestCopy}>
              <Icon name="eye" size={18} color={COLORS.primary} />
              <Text style={styles.guestDescription}>{t('guest.description')}</Text>
            </View>
            <TouchableOpacity
              onPress={handleEnterGuest}
              disabled={busy}
              style={[styles.guestButton, busy && styles.disabled]}
            >
              <Text style={styles.guestButtonText}>
                {guestLoading ? 'A abrir…' : t('guest.continue')}
              </Text>
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
  logo: { width: 150, height: 106 },
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
  guestCard: {
    marginTop: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  guestCopy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guestDescription: { flex: 1, color: COLORS.muted, fontSize: 11.5, lineHeight: 16 },
  guestButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
  },
  guestButtonText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },

  legalText: { fontSize: 11.5, lineHeight: 17, color: COLORS.muted, textAlign: 'center' },
  legalLink: { color: COLORS.primaryDark, fontWeight: '700' },

  footerText: { fontSize: 11, color: COLORS.faint, textAlign: 'center', marginTop: 12 },
  footerBrand: { fontWeight: '800', color: COLORS.text },
});