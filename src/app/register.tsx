// src/app/register.tsx
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
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
  ViewStyle
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from '../components/Icon';
import { getMunicipalityLabel, getProvinceLabel, getProvincesForCountry } from '../data/country-locations';
import { normalizeAngolaAuthPhone } from '../lib/authPhone';
import { signInWithGoogle } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../context/RoleContext';

// Mesma paleta do ProductCard
const COLORS = {
  primary: '#2E8B4F',
  primaryDark: '#25703F',
  tint: '#E9F5EC',
  text: '#16231C',
  mid: '#5B7A66',
  muted: '#78877D',
  faint: '#AEB8AC',
  line: '#E8ECE6',
  field: '#F4F6F2',
  background: '#F9FAF8',
  white: '#FFFFFF',
  gold: '#B9741A',
  goldSoft: '#FBEBD3',
  danger: '#DD5138',
  dangerSoft: '#FBEAE6',
};

const MIN_PASSWORD = 8;
type VerificationChannel = 'email' | 'phone' | 'both';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);
const LOGO = require('../../assets/images/Agrilink_SD.png');

// Gera um NIF aleatório (13 dígitos, nunca começa por 0)
// para quem não preencher o campo no registo.
const generateRandomNif = () => {
  let nif = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < 13; i++) nif += Math.floor(Math.random() * 10);
  return nif;
};

const userTypeOptions: { id: string; label: string; icon: IconName }[] = [
  { id: 'agricultor', label: 'Fornecedor', icon: 'leaf' },
  { id: 'agente', label: 'Agente', icon: 'users' },
  { id: 'comprador', label: 'Comprador', icon: 'cart' },
  { id: 'motorista', label: 'Motorista', icon: 'truck' },
];

// ================================
// COMPONENTES ANIMADOS
// ================================

// Toque que encolhe com mola
function PressScale({
  onPress,
  disabled,
  style,
  containerStyle,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[anim, containerStyle]}>
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

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enterGuest } = useUserRole();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [verificationChannel, setVerificationChannel] = useState<VerificationChannel>('email');
  const [errorMessage, setErrorMessage] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const [userType, setUserType] = useState('');
  const [fullName, setFullName] = useState('');
  const [identityDocument, setIdentityDocument] = useState('');
  const [loadCapacity, setLoadCapacity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [wasReferred, setWasReferred] = useState<'nao' | 'sim'>('nao');
  const [agentCode, setAgentCode] = useState('');
  const [agentCodeValid, setAgentCodeValid] = useState<boolean | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);

  const steps = useMemo(() => [
    { title: t('register.profileStep'), hint: t('register.profileHint'), icon: 'user' as IconName },
    { title: t('register.contactStep'), hint: t('register.contactHint'), icon: 'phone' as IconName },
    { title: t('register.securityStep'), hint: t('register.securityHint'), icon: 'lock' as IconName },
  ], [t]);
  const countryCode = 'AO';
  const availableProvinces = getProvincesForCountry(countryCode);
  const provinceLabel = getProvinceLabel(countryCode);
  const municipalityLabel = getMunicipalityLabel(countryCode);
  const availableMunicipalities =
    availableProvinces.find((p) => p.id === selectedProvince)?.municipalities || [];
  const busy = loading || googleLoading || guestLoading;

  const handleEnterGuest = async () => {
    try {
      setGuestLoading(true);
      await enterGuest();
      router.replace('/home');
    } catch (error) {
      console.error('Não foi possível iniciar o modo visitante:', error);
      setErrorMessage(t('register.unexpectedError'));
    } finally {
      setGuestLoading(false);
    }
  };

  // Barra de progresso animada
  const progressPercent = ((currentStep + 1) / steps.length) * 100;
  const progress = useSharedValue(progressPercent);

  useEffect(() => {
    progress.value = withTiming(progressPercent, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [progressPercent]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  const validateAgentCode = async (code: string) => {
    if (code.length !== 6) {
      setAgentCodeValid(null);
      return;
    }
    setValidatingCode(true);
    try {
      const { data, error } = await supabase.rpc('validate_agent_code', { p_code: code });
      if (error) throw error;
      setAgentCodeValid(data === true);
    } catch {
      setAgentCodeValid(false);
    } finally {
      setValidatingCode(false);
    }
  };

  const validateCurrentStep = () => {
    if (currentStep === 0 && (!userType || !fullName.trim())) {
      setErrorMessage(t('register.validationProfile'));
      return false;
    }
    if (currentStep === 0 && userType === 'motorista' && (!loadCapacity || Number(loadCapacity) <= 0)) {
      setErrorMessage(t('register.validationCapacity'));
      return false;
    }
    if (currentStep === 1 && (!email.trim() || !phone.trim() || !selectedProvince || !selectedMunicipality)) {
      setErrorMessage(t('register.validationContact'));
      return false;
    }
    if (currentStep === 2) {
      if (password.length < MIN_PASSWORD) {
        setErrorMessage(t('register.validationPassword', { length: MIN_PASSWORD }));
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage(t('register.validationPasswordMatch'));
        return false;
      }
      if (wasReferred === 'sim' && !agentCodeValid) {
        setErrorMessage(t('register.validationAgent'));
        return false;
      }
    }
    setErrorMessage('');
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (currentStep < steps.length - 1) {
      goNext();
      return;
    }
    if (!validateCurrentStep()) return;

    setVerificationModalVisible(true);
  };

  const startVerification = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const authPhone = normalizeAngolaAuthPhone(phone);

    if (verificationChannel !== 'email' && !authPhone) {
      setVerificationModalVisible(false);
      setErrorMessage(t('register.validationPhone'));
      setCurrentStep(1);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setVerificationModalVisible(false);
    try {
      const cleanName = fullName.trim();
      const userMetadata = {
        full_name: cleanName,
        phone: phone.trim(),
        phone_e164: authPhone,
        contact_email: cleanEmail,
        identity_document: identityDocument.trim() || generateRandomNif(),
        user_type: userType,
        load_capacity_kg: userType === 'motorista' && loadCapacity ? Number(loadCapacity) : null,
        province_id: selectedProvince,
        municipality_id: selectedMunicipality,
        referred_by_agent_id: wasReferred === 'sim' && agentCode ? agentCode.toUpperCase() : null,
        verification_method: verificationChannel,
      };

      const credentials = verificationChannel === 'email'
        ? { email: cleanEmail, password }
        : { phone: authPhone!, password };
      const { error } = await supabase.auth.signUp({
        ...credentials,
        options: {
          data: userMetadata,
        },
      });

      if (error) {
        setErrorMessage(
          error.message?.includes('already registered')
            ? t('register.accountExists')
            : error.message || t('register.signupError')
        );
        return;
      }

      router.push({
        pathname: '/verify-otp',
        params: {
          channel: verificationChannel,
          email: cleanEmail,
          phone: authPhone ?? '',
        },
      } as any);
    } catch (err: any) {
      setErrorMessage(err?.message || t('register.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const goPrev = () => {
    setErrorMessage('');
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleGoogleRegister = async () => {
    if (!userType) {
      setErrorMessage(t('register.validationGoogle'));
      return;
    }

    try {
      setGoogleLoading(true);
      setErrorMessage('');
      const session = await signInWithGoogle(userType);
      if (session) router.replace('/home');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível criar a conta com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleTopBack = () => {
    if (currentStep > 0) goPrev();
    else router.replace('/login');
  };

  const focusProps = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  });

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
              onPress={handleTopBack}
              disabled={loading}
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
              {t('register.title')}
            </Animated.Text>
            <Animated.Text entering={enter(330)} style={styles.subtitle}>
              {t('register.subtitle')}
            </Animated.Text>
          </View>

          {errorMessage ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Animated.View>
          ) : null}

          {/* PROGRESSO */}
          <Animated.View entering={enter(400)} style={styles.progressBlock}>
            <View style={styles.stepper}>
              {steps.map((s, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <View key={s.title} style={styles.stepperItem}>
                    <View
                      style={[
                        styles.stepDot,
                        (done || active) && styles.stepDotOn,
                      ]}
                    >
                      <Icon
                        name={done ? 'check' : s.icon}
                        size={16}
                        color={done || active ? '#FFFFFF' : COLORS.faint}
                      />
                    </View>
                    <Text style={[styles.stepDotLabel, (done || active) && { color: COLORS.primaryDark }]}>
                      {s.title}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepHint}>{steps[currentStep].hint}</Text>
              <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>
                        {t('register.stepCount', { current: currentStep + 1, total: steps.length })}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* PASSO 1 */}
          {currentStep === 0 && (
            <Animated.View key="step-0" entering={FadeInRight.duration(350)} style={styles.stepBody}>
              <View>
                <Text style={styles.label}>{t('register.accountType')}</Text>
                <View style={styles.userTypeRow}>
                  {userTypeOptions.map((opt) => {
                    const active = userType === opt.id;
                    return (
                      <PressScale
                        key={opt.id}
                        onPress={() => setUserType(opt.id)}
                        containerStyle={styles.userTypeCell}
                        style={[styles.userTypeBtn, active && styles.userTypeBtnActive]}
                      >
                        <View style={[styles.userTypeIcon, active && styles.userTypeIconActive]}>
                          <Icon name={opt.icon} size={19} color={active ? '#FFFFFF' : COLORS.primary} />
                        </View>
                        <Text style={[styles.userTypeLabel, active && styles.userTypeLabelActive]}>
                          {t(`register.${opt.id === 'agricultor' ? 'supplier' : opt.id === 'agente' ? 'agent' : opt.id === 'comprador' ? 'buyer' : 'driver'}`)}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleGoogleRegister}
                disabled={busy}
                style={[styles.googleButton, busy && styles.disabled]}
              >
                <Text style={styles.googleMark}>G</Text>
                <Text style={styles.googleButtonText}>{googleLoading ? 'A ligar ao Google…' : t('register.continueGoogle')}</Text>
              </TouchableOpacity>

              <View>
                <Text style={styles.label}>{t('register.fullName')}</Text>
                <Field icon="user" focused={focused === 'name'}>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={t('register.fullName')}
                    placeholderTextColor={COLORS.faint}
                    style={styles.input}
                    {...focusProps('name')}
                  />
                </Field>
              </View>

              <View>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>{t('register.identityDocument')}</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>{t('register.optional')}</Text>
                  </View>
                </View>
                <Field icon="card" focused={focused === 'nif'}>
                  <TextInput
                    value={identityDocument}
                    onChangeText={setIdentityDocument}
                    placeholder="000000000AA000"
                    placeholderTextColor={COLORS.faint}
                    autoCapitalize="characters"
                    style={styles.input}
                    {...focusProps('nif')}
                  />
                </Field>
                <View style={styles.hintBox}>
                  <Icon name="info" size={15} color={COLORS.gold} />
                  <Text style={styles.hintText}>
                    {t('register.nifHint')}
                  </Text>
                </View>
              </View>

              {userType === 'motorista' && (
                <Animated.View entering={FadeInDown.duration(350)}>
                  <Text style={styles.label}>{t('register.loadCapacity')}</Text>
                  <Field icon="truck" focused={focused === 'load'}>
                    <TextInput
                      value={loadCapacity}
                      onChangeText={setLoadCapacity}
                      placeholder="Ex.: 8000"
                      placeholderTextColor={COLORS.faint}
                      keyboardType="numeric"
                      style={styles.input}
                      {...focusProps('load')}
                    />
                  </Field>
                  <View style={styles.hintBox}>
                    <Icon name="info" size={15} color={COLORS.gold} />
                    <Text style={styles.hintText}>
                      {t('register.capacityHint')}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* PASSO 2 */}
          {currentStep === 1 && (
            <Animated.View key="step-1" entering={FadeInRight.duration(350)} style={styles.stepBody}>
              <View>
                <Text style={styles.label}>{t('register.email')}</Text>
                <Field icon="mail" focused={focused === 'email'}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor={COLORS.faint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    {...focusProps('email')}
                  />
                </Field>
              </View>

              <View>
                <Text style={styles.label}>{t('register.phone')}</Text>
                <Field icon="phone" focused={focused === 'phone'}>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={COLORS.faint}
                    keyboardType="phone-pad"
                    style={styles.input}
                    {...focusProps('phone')}
                  />
                </Field>
              </View>

              <View>
                <Text style={styles.label}>{provinceLabel || 'Província'}</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedProvince}
                    onValueChange={(v) => {
                      setSelectedProvince(v);
                      setSelectedMunicipality('');
                    }}
                  >
                    <Picker.Item label={t('register.selectProvince')} value="" />
                    {availableProvinces.map((p) => (
                      <Picker.Item key={p.id} label={p.name} value={p.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View>
                <Text style={styles.label}>{municipalityLabel || 'Município'}</Text>
                <View style={[styles.pickerWrap, !selectedProvince && { opacity: 0.6 }]}>
                  <Picker
                    enabled={!!selectedProvince}
                    selectedValue={selectedMunicipality}
                    onValueChange={setSelectedMunicipality}
                  >
                    <Picker.Item label={t('register.selectMunicipality')} value="" />
                    {availableMunicipalities.map((m) => (
                      <Picker.Item key={m.id} label={m.name} value={m.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </Animated.View>
          )}

          {/* PASSO 3 */}
          {currentStep === 2 && (
            <Animated.View key="step-2" entering={FadeInRight.duration(350)} style={styles.stepBody}>
              <View>
                <Text style={styles.label}>{t('register.password')}</Text>
                <Field icon="lock" focused={focused === 'pass'}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('register.passwordMinimum', { length: MIN_PASSWORD })}
                    placeholderTextColor={COLORS.faint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    {...focusProps('pass')}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                </Field>
              </View>

              <View>
                <Text style={styles.label}>{t('register.confirmPassword')}</Text>
                <Field icon="lock" focused={focused === 'confirm'}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t('register.repeatPassword')}
                    placeholderTextColor={COLORS.faint}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    {...focusProps('confirm')}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                </Field>
              </View>

              <View>
                <Text style={styles.label}>{t('register.referred')}</Text>
                <View style={styles.radioGroup}>
                  {(['nao', 'sim'] as const).map((v) => {
                    const active = wasReferred === v;
                    return (
                      <PressScale
                        key={v}
                        onPress={() => setWasReferred(v)}
                        containerStyle={{ flex: 1 }}
                        style={[styles.radioChip, active && styles.radioChipActive]}
                      >
                        <View style={[styles.radioOuter, active && { borderColor: COLORS.primary }]}>
                          {active && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.radioLabel, active && { color: COLORS.primaryDark }]}>
                          {v === 'nao' ? t('register.no') : t('register.yes')}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>

                {wasReferred === 'sim' && (
                  <Animated.View entering={FadeInDown.duration(350)} style={{ marginTop: 12 }}>
                    <Field icon="key" focused={focused === 'agent'}>
                      <TextInput
                        placeholder={t('register.agentCodePlaceholder')}
                        placeholderTextColor={COLORS.faint}
                        value={agentCode}
                        onChangeText={(v) => {
                          const val = v.toUpperCase().slice(0, 6);
                          setAgentCode(val);
                          if (val.length === 6) validateAgentCode(val);
                          else setAgentCodeValid(null);
                        }}
                        autoCapitalize="characters"
                        style={styles.input}
                        {...focusProps('agent')}
                      />
                    </Field>
                    {validatingCode && <Text style={styles.validatingCode}>A validar o código…</Text>}
                    {agentCodeValid === false && (
                      <View style={styles.codeRow}>
                        <Icon name="close-circle" size={15} color={COLORS.danger} />
                        <Text style={styles.invalidCode}>{t('register.invalidAgent')}</Text>
                      </View>
                    )}
                    {agentCodeValid === true && (
                      <View style={styles.codeRow}>
                        <Icon name="check-circle" size={15} color={COLORS.primary} />
                        <Text style={styles.validCode}>{t('register.validAgent')}</Text>
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          )}

          {/* ACÇÕES */}
          <View style={styles.actionsRow}>
            {currentStep > 0 && (
              <PressScale onPress={goPrev} style={styles.prevBtn}>
                <Icon name="arrow-left" size={18} color={COLORS.text} />
              </PressScale>
            )}
            <PressScale
              onPress={handleSubmit}
              disabled={loading}
              containerStyle={{ flex: 1 }}
              style={[styles.submitBtn, loading && styles.disabled]}
            >
              <>
                <Text style={styles.submitText}>
                  {loading ? 'A processar…' : currentStep === steps.length - 1 ? t('register.finish') : t('register.next')}
                </Text>
                <Icon name="arrow-right" size={17} color="#FFFFFF" />
              </>
            </PressScale>
          </View>

          {/* LOGIN */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('register.alreadyAccount')}</Text>
            <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading} hitSlop={8}>
              <Text style={styles.loginLink}>{t('register.login')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.guestButton, busy && styles.disabled]}
            onPress={() => void handleEnterGuest()}
            disabled={busy}
            accessibilityRole="button"
          >
            <Icon name="eye" size={17} color={COLORS.primary} />
            <Text style={styles.guestButtonText}>
              {guestLoading ? 'A abrir…' : t('guest.continue')}
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1, minHeight: 24 }} />

          {/* TERMOS E FOOTER */}
          <Text style={styles.legalText}>
            {t('register.legalIntro')}{' '}
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
        </View>
      </ScrollView>
      <Modal
        visible={verificationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVerificationModalVisible(false)} />
          <View style={styles.verificationModal}>
            <View style={styles.modalIcon}>
              <Icon name="shield" size={19} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>{t('register.verifyTitle')}</Text>
            <Text style={styles.modalDescription}>
              {t('register.verifyDescription')}
            </Text>

            {([
              { id: 'email', label: t('register.emailRecommended'), detail: email.trim().toLowerCase(), icon: 'mail' as IconName },
              { id: 'phone', label: t('register.phoneChannel'), detail: phone.trim(), icon: 'phone' as IconName },
              { id: 'both', label: t('register.bothChannels'), detail: t('register.phoneFirst'), icon: 'check-circle' as IconName },
            ] as const).map((option) => {
              const selected = verificationChannel === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setVerificationChannel(option.id)}
                  style={[styles.verificationOption, selected && styles.verificationOptionActive]}
                >
                  <Icon name={option.icon} size={18} color={selected ? COLORS.primary : COLORS.muted} />
                  <View style={styles.verificationOptionCopy}>
                    <Text style={styles.verificationOptionTitle}>{option.label}</Text>
                    <Text style={styles.verificationOptionDetail} numberOfLines={1}>{option.detail}</Text>
                  </View>
                  <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}

            <PressScale
              onPress={startVerification}
              disabled={loading}
              style={[styles.modalContinue, loading && styles.disabled]}
            >
              <Text style={styles.modalContinueText}>{loading ? 'A enviar…' : t('register.sendCode')}</Text>
            </PressScale>
            <TouchableOpacity onPress={() => setVerificationModalVisible(false)} disabled={loading} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>{t('register.notNow')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  header: { alignItems: 'center', marginTop: 8, marginBottom: 22 },
  logo: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.white },
  title: {
    marginTop: 12,
    fontSize: 23,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 13.5, color: COLORS.muted, textAlign: 'center', marginTop: 4 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: COLORS.danger, fontSize: 12.5, fontWeight: '700', flex: 1 },

  progressBlock: { marginBottom: 20 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stepperItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotLabel: { fontSize: 11.5, fontWeight: '800', color: COLORS.faint },

  progressTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.line, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.primary },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  stepHint: { flex: 1, fontSize: 12.5, color: COLORS.muted },
  stepBadge: { backgroundColor: COLORS.tint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  stepBadgeText: { fontSize: 10.5, fontWeight: '800', color: COLORS.primaryDark },

  stepBody: { gap: 14 },

  label: { fontSize: 12.5, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  optionalBadge: { backgroundColor: COLORS.goldSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  optionalText: { fontSize: 10, fontWeight: '800', color: COLORS.gold },

  inputWrapper: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, height: '100%', fontSize: 14.5, color: COLORS.text, paddingHorizontal: 10 },
  eyeButton: { paddingHorizontal: 14, height: '100%', justifyContent: 'center', alignItems: 'center' },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.goldSoft,
  },
  hintText: { flex: 1, fontSize: 11.5, color: COLORS.mid, lineHeight: 17 },

  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },

  userTypeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  userTypeCell: { width: '48%' },
  userTypeBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    gap: 8,
  },
  userTypeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.tint },
  userTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTypeIconActive: { backgroundColor: COLORS.primary },
  userTypeLabel: { fontSize: 12.5, fontWeight: '800', color: COLORS.mid },
  userTypeLabelActive: { color: COLORS.primaryDark },

  googleButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleMark: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleButtonText: { fontSize: 14, fontWeight: '800', color: COLORS.text },

  radioGroup: { flexDirection: 'row', gap: 10, marginTop: 2 },
  radioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
  },
  radioChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.tint },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  radioLabel: { fontSize: 13.5, fontWeight: '800', color: COLORS.mid },

  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  validatingCode: { marginTop: 8, fontSize: 12, fontWeight: '600', color: COLORS.muted },
  invalidCode: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  validCode: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },

  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(22,35,28,0.42)', padding: 18 },
  verificationModal: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
  },
  modalIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.tint },
  modalTitle: { marginTop: 12, color: COLORS.text, fontSize: 17, fontWeight: '900' },
  modalDescription: { marginTop: 4, marginBottom: 14, color: COLORS.muted, fontSize: 12.5, lineHeight: 18 },
  verificationOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  verificationOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.tint },
  verificationOptionCopy: { flex: 1 },
  verificationOptionTitle: { color: COLORS.text, fontSize: 13.5, fontWeight: '800' },
  verificationOptionDetail: { marginTop: 2, color: COLORS.muted, fontSize: 11.5 },
  radioOuterActive: { borderColor: COLORS.primary },
  modalContinue: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 16, borderRadius: 10, backgroundColor: COLORS.primary },
  modalContinueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  prevBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Botão igual ao "Comprar" do ProductCard
  submitBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 20,
  },
  loginText: { fontSize: 13.5, color: COLORS.muted },
  loginLink: { fontSize: 13.5, fontWeight: '800', color: COLORS.primaryDark, marginLeft: 6 },
  guestButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  guestButtonText: { color: COLORS.primaryDark, fontSize: 12.5, fontWeight: '800' },

  legalText: { fontSize: 11.5, lineHeight: 17, color: COLORS.muted, textAlign: 'center' },
  legalLink: { color: COLORS.primaryDark, fontWeight: '700' },

  footerText: { fontSize: 11, color: COLORS.faint, textAlign: 'center', marginTop: 12 },
  footerBrand: { fontWeight: '800', color: COLORS.text },
});